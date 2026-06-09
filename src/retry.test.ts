/**
 * Retry & rate-limit middleware (SLO-133).
 *
 * The backoff math and the retry loop are tested deterministically with an
 * injected RNG/sleep; the client integration runs against the mock fetch
 * under fake timers (only `setTimeout`/`clearTimeout` are faked, so promise
 * plumbing stays real).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from './__fixtures__/fixtures.js';
import { createMockFetch, jsonResponse } from './__fixtures__/mock-fetch.js';
import {
  APIConnectionError,
  APIError,
  DEFAULT_MAX_RETRIES,
  DEFAULT_RETRY_BASE_DELAY_MS,
  DEFAULT_RETRY_MAX_DELAY_MS,
  NotFoundError,
  RateLimitError,
  Slothbox,
  SlothboxError,
} from './index.js';
import {
  abortableSleep,
  canRetryRequest,
  isRetryableError,
  isRetryableMethod,
  retryDelayMs,
  withRetries,
  type RetryContext,
} from './retry.js';

const API_KEY = 'sk_test_retry';

/** A 429 with the API's envelope (and optionally a Retry-After header). */
const rateLimited = (retryAfter?: string) =>
  jsonResponse(
    429,
    { error: { message: 'rate limited', code: 'rate_limited' } },
    retryAfter === undefined ? {} : { 'retry-after': retryAfter },
  );

const serverError = () => jsonResponse(500, { error: { message: 'internal error' } });
const ok = () => jsonResponse(200, { hello: 'world' });

/**
 * Drain pending microtask generations so an in-flight attempt (fetch →
 * body read → throw → backoff scheduling) fully settles before we touch
 * the fake clock. Pure-microtask, so it works with timers faked.
 */
async function settle(): Promise<void> {
  for (let i = 0; i < 50; i++) await Promise.resolve();
}

/** Await a promise's failure without ever leaving the rejection unhandled. */
function captureFailure(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('expected the promise to reject');
    },
    (error: unknown) => error,
  );
}

describe('exported defaults', () => {
  it('documents the policy: 3 retries, 500ms base, 30s cap', () => {
    expect(DEFAULT_MAX_RETRIES).toBe(3);
    expect(DEFAULT_RETRY_BASE_DELAY_MS).toBe(500);
    expect(DEFAULT_RETRY_MAX_DELAY_MS).toBe(30_000);
  });
});

describe('isRetryableMethod / canRetryRequest — the POST rule', () => {
  it('treats GET/HEAD/PUT/DELETE as retryable, POST/PATCH as not', () => {
    for (const method of ['GET', 'HEAD', 'PUT', 'DELETE', 'get', 'delete']) {
      expect(isRetryableMethod(method)).toBe(true);
    }
    for (const method of ['POST', 'PATCH', 'post', 'patch']) {
      expect(isRetryableMethod(method)).toBe(false);
    }
  });

  it('never allows a blind POST/PATCH retry', () => {
    expect(canRetryRequest('POST', new Headers())).toBe(false);
    expect(canRetryRequest('PATCH', new Headers())).toBe(false);
  });

  it('allows POST/PATCH retries only with an Idempotency-Key header (any case)', () => {
    expect(canRetryRequest('POST', new Headers({ 'Idempotency-Key': 'k' }))).toBe(true);
    expect(canRetryRequest('POST', new Headers({ 'idempotency-key': 'k' }))).toBe(true);
    expect(canRetryRequest('PATCH', new Headers({ 'IDEMPOTENCY-KEY': 'k' }))).toBe(true);
  });
});

describe('isRetryableError', () => {
  it('retries 429s, 5xx, and connection errors', () => {
    expect(isRetryableError(new APIConnectionError())).toBe(true);
    expect(isRetryableError(new RateLimitError('slow down', { status: 429 }))).toBe(true);
    expect(isRetryableError(new APIError('boom', { status: 500 }))).toBe(true);
    expect(isRetryableError(new APIError('unavailable', { status: 503 }))).toBe(true);
    expect(isRetryableError(new APIError('throttled upstream', { status: 429 }))).toBe(true);
  });

  it('never retries other 4xx, aborts, or non-HTTP failures', () => {
    expect(isRetryableError(new NotFoundError('nope', { status: 404 }))).toBe(false);
    expect(isRetryableError(new APIError('bad', { status: 400 }))).toBe(false);
    expect(isRetryableError(new SlothboxError('parse failure'))).toBe(false);
    expect(isRetryableError(new DOMException('aborted', 'AbortError'))).toBe(false);
    expect(isRetryableError(new Error('misc'))).toBe(false);
    expect(isRetryableError(undefined)).toBe(false);
  });
});

describe('retryDelayMs — capped, full-jitter exponential backoff', () => {
  it('is uniform over [0, base * 2^n) with the injected RNG', () => {
    const half = { random: () => 0.5 };
    expect(retryDelayMs(0, undefined, half)).toBe(250);
    expect(retryDelayMs(1, undefined, half)).toBe(500);
    expect(retryDelayMs(2, undefined, half)).toBe(1000);
    expect(retryDelayMs(0, undefined, { random: () => 0 })).toBe(0);
    expect(retryDelayMs(0, undefined, { random: () => 0.999999 })).toBe(499);
  });

  it('caps the exponential ceiling at maxDelayMs', () => {
    // base 500 * 2^10 = 512_000 — capped at 30_000, so RNG 0.5 → 15_000
    expect(retryDelayMs(10, undefined, { random: () => 0.5 })).toBe(15_000);
    expect(retryDelayMs(10, undefined, { random: () => 0.5, maxDelayMs: 4000 })).toBe(2000);
  });

  it('respects custom baseDelayMs', () => {
    expect(retryDelayMs(1, undefined, { random: () => 0.5, baseDelayMs: 100 })).toBe(100);
  });

  it('honors Retry-After exactly (whole seconds), ignoring the RNG', () => {
    const random = vi.fn(() => 0.123);
    expect(retryDelayMs(0, 7, { random })).toBe(7000);
    expect(retryDelayMs(5, 0, { random })).toBe(0);
    expect(random).not.toHaveBeenCalled();
  });

  it('caps Retry-After by the same maximum', () => {
    expect(retryDelayMs(0, 3600, {})).toBe(DEFAULT_RETRY_MAX_DELAY_MS);
    expect(retryDelayMs(0, 3600, { maxDelayMs: 5000 })).toBe(5000);
  });
});

describe('withRetries — deterministic via injected RNG and sleep', () => {
  function recordingSleep() {
    const sleeps: number[] = [];
    const sleep = (ms: number) => {
      sleeps.push(ms);
      return Promise.resolve();
    };
    return { sleeps, sleep };
  }

  it('retries 5xx and connection errors until success', async () => {
    const { sleeps, sleep } = recordingSleep();
    let attempts = 0;
    const result = await withRetries(
      () => {
        attempts++;
        if (attempts === 1) return Promise.reject(new APIError('boom', { status: 502 }));
        if (attempts === 2) return Promise.reject(new APIConnectionError('reset'));
        return Promise.resolve('ok');
      },
      { maxRetries: 3, random: () => 0.5, sleep },
    );
    expect(result).toBe('ok');
    expect(attempts).toBe(3);
    expect(sleeps).toEqual([250, 500]); // full jitter at RNG 0.5: base/2, base
  });

  it('gives up after maxRetries and attaches the retry context', async () => {
    const { sleeps, sleep } = recordingSleep();
    let attempts = 0;
    const failure = await captureFailure(
      withRetries(
        () => {
          attempts++;
          return Promise.reject(new APIError('boom', { status: 500 }));
        },
        { maxRetries: 2, random: () => 0.5, sleep },
      ),
    );
    expect(attempts).toBe(3);
    expect(sleeps).toEqual([250, 500]);
    expect(failure).toBeInstanceOf(APIError);
    expect((failure as APIError).retryContext).toEqual({
      attempts: 3,
      maxRetries: 2,
      lastRetryAfter: undefined,
      totalDelayMs: 750,
    } satisfies RetryContext);
  });

  it('lets Retry-After drive each wait and reports the last one on exhaustion', async () => {
    const { sleeps, sleep } = recordingSleep();
    const retryAfters = [2, 5, 9];
    let attempts = 0;
    const failure = await captureFailure(
      withRetries(
        () => {
          const retryAfter = retryAfters[attempts++];
          return Promise.reject(
            new RateLimitError('rate limited', { status: 429, retryAfter }),
          );
        },
        { maxRetries: 2, random: () => 0.5, sleep },
      ),
    );
    expect(sleeps).toEqual([2000, 5000]);
    expect(failure).toBeInstanceOf(RateLimitError);
    expect((failure as RateLimitError).retryContext).toEqual({
      attempts: 3,
      maxRetries: 2,
      lastRetryAfter: 9,
      totalDelayMs: 7000,
    } satisfies RetryContext);
  });

  it('does not retry non-retryable failures, and leaves them unenriched', async () => {
    const { sleeps, sleep } = recordingSleep();
    let attempts = 0;
    const notFound = new NotFoundError('nope', { status: 404 });
    const failure = await captureFailure(
      withRetries(
        () => {
          attempts++;
          return Promise.reject(notFound);
        },
        { maxRetries: 3, sleep },
      ),
    );
    expect(failure).toBe(notFound);
    expect(attempts).toBe(1);
    expect(sleeps).toEqual([]);
    expect((failure as NotFoundError).retryContext).toBeUndefined();
  });

  it('rethrows aborts untouched', async () => {
    const abort = new DOMException('aborted', 'AbortError');
    let attempts = 0;
    const failure = await captureFailure(
      withRetries(
        () => {
          attempts++;
          return Promise.reject(abort);
        },
        { maxRetries: 3 },
      ),
    );
    expect(failure).toBe(abort);
    expect(attempts).toBe(1);
  });

  it('maxRetries: 0 makes a single attempt but still attaches context', async () => {
    const { sleeps, sleep } = recordingSleep();
    const failure = await captureFailure(
      withRetries(
        () => Promise.reject(new RateLimitError('rate limited', { status: 429, retryAfter: 4 })),
        { maxRetries: 0, sleep },
      ),
    );
    expect(sleeps).toEqual([]);
    expect((failure as RateLimitError).retryContext).toEqual({
      attempts: 1,
      maxRetries: 0,
      lastRetryAfter: 4,
      totalDelayMs: 0,
    } satisfies RetryContext);
  });
});

describe('abortableSleep', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves after the given delay', async () => {
    let resolved = false;
    const promise = abortableSleep(50).then(() => {
      resolved = true;
    });
    await vi.advanceTimersByTimeAsync(49);
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await promise;
    expect(resolved).toBe(true);
  });

  it('rejects immediately on a pre-aborted signal', async () => {
    const controller = new AbortController();
    controller.abort();
    const failure = await captureFailure(abortableSleep(10_000, controller.signal));
    expect((failure as Error).name).toBe('AbortError');
    expect(vi.getTimerCount()).toBe(0); // no timer was ever scheduled
  });

  it('aborting mid-sleep rejects promptly and clears the timer', async () => {
    const controller = new AbortController();
    const failure = captureFailure(abortableSleep(60_000, controller.signal));
    controller.abort();
    expect(((await failure) as Error).name).toBe('AbortError'); // no clock advancement
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('client integration (mock fetch + fake timers)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('honors Retry-After exactly on a 429 (whole seconds)', async () => {
    const mock = createMockFetch(rateLimited('7'), ok());
    const client = new Slothbox({ apiKey: API_KEY, fetch: mock.fetch });
    const promise = client.health.get();
    await settle();
    expect(mock.requests).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(6_999); // 1ms early — still waiting
    await settle();
    expect(mock.requests).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(promise).resolves.toEqual({ hello: 'world' });
    expect(mock.requests).toHaveLength(2);
  });

  it('caps a huge Retry-After at the 30s backoff ceiling', async () => {
    const mock = createMockFetch(rateLimited('3600'), ok());
    const client = new Slothbox({ apiKey: API_KEY, fetch: mock.fetch });
    const promise = client.health.get();
    await settle();
    await vi.advanceTimersByTimeAsync(29_999);
    await settle();
    expect(mock.requests).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(promise).resolves.toEqual({ hello: 'world' });
    expect(mock.requests).toHaveLength(2);
  });

  it('retries GETs on 5xx and network errors', async () => {
    const mock = createMockFetch(
      serverError(),
      () => {
        throw new TypeError('socket hang up');
      },
      ok(),
    );
    const client = new Slothbox({ apiKey: API_KEY, fetch: mock.fetch });
    const promise = client.health.get();
    await settle();
    await vi.advanceTimersByTimeAsync(5_000); // jittered waits: <500ms then <1s
    await expect(promise).resolves.toEqual({ hello: 'world' });
    expect(mock.requests).toHaveLength(3);
  });

  it('makes 1 + DEFAULT_MAX_RETRIES attempts by default, then throws with context', async () => {
    const mock = createMockFetch(
      rateLimited('1'),
      rateLimited('1'),
      rateLimited('1'),
      rateLimited('2'),
    );
    const client = new Slothbox({ apiKey: API_KEY, fetch: mock.fetch });
    const failure = captureFailure(client.health.get());
    await settle();
    await vi.advanceTimersByTimeAsync(3_000); // 1s + 1s + 1s of Retry-After
    const error = (await failure) as RateLimitError;
    expect(mock.requests).toHaveLength(4);
    expect(error).toBeInstanceOf(RateLimitError);
    expect(error.retryAfter).toBe(2);
    expect(error.retryContext).toEqual({
      attempts: 4,
      maxRetries: DEFAULT_MAX_RETRIES,
      lastRetryAfter: 2,
      totalDelayMs: 3000,
    } satisfies RetryContext);
  });

  it('NEVER blind-retries a POST on 429 — a duplicate launch is a second box', async () => {
    const mock = createMockFetch(rateLimited('1'));
    const client = new Slothbox({ apiKey: API_KEY, fetch: mock.fetch });
    const failure = (await captureFailure(
      client.environments.launch({ orgId: 'org_1', body: { templateId: 'tpl_1' } }),
    )) as RateLimitError;
    expect(mock.requests).toHaveLength(1); // exactly one launch attempt
    expect(failure).toBeInstanceOf(RateLimitError);
    expect(failure.retryContext).toEqual({
      attempts: 1,
      maxRetries: 0, // the POST rule zeroed the budget
      lastRetryAfter: 1,
      totalDelayMs: 0,
    } satisfies RetryContext);
  });

  it('NEVER blind-retries a POST on 5xx or network errors either', async () => {
    const mock = createMockFetch(serverError());
    const client = new Slothbox({ apiKey: API_KEY, fetch: mock.fetch });
    const failure = await captureFailure(
      client.environments.launch({ orgId: 'org_1', body: { templateId: 'tpl_1' } }),
    );
    expect(failure).toBeInstanceOf(APIError);
    expect(mock.requests).toHaveLength(1);

    const connMock = createMockFetch(() => {
      throw new TypeError('fetch failed');
    });
    const connClient = new Slothbox({ apiKey: API_KEY, fetch: connMock.fetch });
    const connFailure = await captureFailure(
      connClient.environments.launch({ orgId: 'org_1', body: { templateId: 'tpl_1' } }),
    );
    expect(connFailure).toBeInstanceOf(APIConnectionError);
    expect(connMock.requests).toHaveLength(1);
  });

  it('an Idempotency-Key makes the launch POST retryable', async () => {
    const mock = createMockFetch(serverError(), rateLimited(), jsonResponse(201, environment));
    const client = new Slothbox({ apiKey: API_KEY, fetch: mock.fetch });
    const promise = client.environments.launch(
      { orgId: 'org_1', body: { templateId: 'tpl_1' } },
      { idempotencyKey: 'launch-7c2a' },
    );
    await settle();
    await vi.advanceTimersByTimeAsync(5_000);
    await expect(promise).resolves.toMatchObject({ envId: environment.envId });
    expect(mock.requests).toHaveLength(3);
    for (const request of mock.requests) {
      expect(request.headers.get('idempotency-key')).toBe('launch-7c2a'); // every replay dedupes
    }
  });

  it('does not retry PATCH by default (conservative)', async () => {
    const mock = createMockFetch(serverError());
    const client = new Slothbox({ apiKey: API_KEY, fetch: mock.fetch });
    const failure = await captureFailure(
      client.request('PATCH', '/organizations/{orgId}', {
        pathParams: { orgId: 'org_1' },
        body: { name: 'renamed' },
      }),
    );
    expect(failure).toBeInstanceOf(APIError);
    expect(mock.requests).toHaveLength(1);
  });

  it('a manual Idempotency-Key header unlocks retries on any method', async () => {
    const mock = createMockFetch(serverError(), ok());
    const client = new Slothbox({ apiKey: API_KEY, fetch: mock.fetch });
    const promise = client.request('PATCH', '/organizations/{orgId}', {
      pathParams: { orgId: 'org_1' },
      body: { name: 'renamed' },
      headers: { 'Idempotency-Key': 'patch-1' },
    });
    await settle();
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(promise).resolves.toEqual({ hello: 'world' });
    expect(mock.requests).toHaveLength(2);
  });

  it('retries PUT and DELETE', async () => {
    const mock = createMockFetch(serverError(), ok(), serverError(), jsonResponse(204, null));
    const client = new Slothbox({ apiKey: API_KEY, fetch: mock.fetch });

    const put = client.request('PUT', '/organizations/{orgId}/auto-sleep', {
      pathParams: { orgId: 'org_1' },
      body: { idleMinutes: 30 },
    });
    await settle();
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(put).resolves.toEqual({ hello: 'world' });

    const del = client.organizations.delete({ orgId: 'org_1' });
    await settle();
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(del).resolves.toBeUndefined();

    expect(mock.requests).toHaveLength(4);
  });

  it('per-request maxRetries: 0 disables retries', async () => {
    const mock = createMockFetch(rateLimited('1'));
    const client = new Slothbox({ apiKey: API_KEY, fetch: mock.fetch });
    const failure = (await captureFailure(
      client.health.get(undefined, { maxRetries: 0 }),
    )) as RateLimitError;
    expect(mock.requests).toHaveLength(1);
    expect(failure.retryContext).toEqual({
      attempts: 1,
      maxRetries: 0,
      lastRetryAfter: 1,
      totalDelayMs: 0,
    } satisfies RetryContext);
  });

  it('client-level maxRetries: 0 disables retries globally', async () => {
    const mock = createMockFetch(serverError());
    const client = new Slothbox({ apiKey: API_KEY, fetch: mock.fetch, maxRetries: 0 });
    const failure = await captureFailure(client.health.get());
    expect(failure).toBeInstanceOf(APIError);
    expect(mock.requests).toHaveLength(1);
  });

  it('per-request maxRetries overrides the client default', async () => {
    const mock = createMockFetch(rateLimited('1'), rateLimited('1'), ok());
    const client = new Slothbox({ apiKey: API_KEY, fetch: mock.fetch, maxRetries: 0 });
    const promise = client.health.get(undefined, { maxRetries: 2 });
    await settle();
    await vi.advanceTimersByTimeAsync(2_000);
    await expect(promise).resolves.toEqual({ hello: 'world' });
    expect(mock.requests).toHaveLength(3);
  });

  it('aborting during the backoff sleep cancels promptly', async () => {
    const controller = new AbortController();
    const mock = createMockFetch(rateLimited('60'));
    const client = new Slothbox({ apiKey: API_KEY, fetch: mock.fetch });
    const failure = captureFailure(client.health.get(undefined, { signal: controller.signal }));
    await settle();
    expect(mock.requests).toHaveLength(1); // waiting out the 60s Retry-After
    controller.abort();
    const error = (await failure) as Error; // resolves with NO clock advancement
    expect(error.name).toBe('AbortError');
    expect(error).not.toBeInstanceOf(SlothboxError);
    expect(vi.getTimerCount()).toBe(0); // the backoff timer was cleared
  });

  it('never retries non-retryable statuses like 404', async () => {
    const mock = createMockFetch(jsonResponse(404, { error: { message: 'no such org' } }));
    const client = new Slothbox({ apiKey: API_KEY, fetch: mock.fetch });
    const failure = (await captureFailure(
      client.organizations.get({ orgId: 'org_missing' }),
    )) as NotFoundError;
    expect(failure).toBeInstanceOf(NotFoundError);
    expect(failure.retryContext).toBeUndefined();
    expect(mock.requests).toHaveLength(1);
  });

  it('validates maxRetries at the constructor and per request', async () => {
    expect(() => new Slothbox({ apiKey: API_KEY, maxRetries: -1 })).toThrow(SlothboxError);
    expect(() => new Slothbox({ apiKey: API_KEY, maxRetries: 1.5 })).toThrow(
      /non-negative integer/,
    );
    const mock = createMockFetch();
    const client = new Slothbox({ apiKey: API_KEY, fetch: mock.fetch });
    await expect(client.health.get(undefined, { maxRetries: -2 })).rejects.toThrow(
      /non-negative integer/,
    );
    expect(mock.requests).toHaveLength(0); // rejected before any attempt
  });
});
