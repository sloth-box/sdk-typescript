/**
 * Retry and rate-limit middleware (SLO-133).
 *
 * The default policy, applied by the client's request path:
 *
 * - **GET / HEAD / PUT / DELETE** requests are retried on 429s, 5xx
 *   responses, and network errors ({@link APIConnectionError}), up to
 *   `maxRetries` times (default {@link DEFAULT_MAX_RETRIES}) with capped,
 *   full-jitter exponential backoff: the nth retry sleeps a uniform-random
 *   time in `[0, min(maxDelayMs, baseDelayMs * 2^n))` — defaults
 *   {@link DEFAULT_RETRY_BASE_DELAY_MS} / {@link DEFAULT_RETRY_MAX_DELAY_MS}.
 * - A `Retry-After` on a 429 (whole seconds — the API always sends
 *   delta-seconds) is honored exactly instead of the computed backoff,
 *   capped by the same `maxDelayMs`.
 * - **POST and PATCH requests are never blind-retried.** A POST that timed
 *   out may still have gone through, and a duplicated `launchEnvironment`
 *   provisions a second EC2 box on the customer's AWS bill. They become
 *   retryable only when the request carries an `Idempotency-Key` header
 *   (the launch op accepts `idempotencyKey`), which makes a server-side
 *   replay return the original result instead of acting twice.
 * - Aborts are never retried, and an `AbortSignal` cancels a backoff sleep
 *   promptly.
 * - When retries exhaust (or were not permitted for a retryable failure),
 *   the normal typed error is rethrown with a {@link RetryContext} attached
 *   as `error.retryContext` — so an exhausted `RateLimitError` reports the
 *   attempts made and the last `Retry-After` the API sent.
 */

import {
  APIConnectionError,
  APIError,
  RateLimitError,
  SlothboxError,
} from './errors.js';

/** Default number of retries after the initial attempt. */
export const DEFAULT_MAX_RETRIES = 3;

/** Default exponential-backoff base, in milliseconds. */
export const DEFAULT_RETRY_BASE_DELAY_MS = 500;

/**
 * Default backoff ceiling, in milliseconds. Also caps a server-sent
 * `Retry-After`.
 */
export const DEFAULT_RETRY_MAX_DELAY_MS = 30_000;

/**
 * Retry state attached to the error thrown once retries are exhausted
 * (`error.retryContext` on any {@link SlothboxError}).
 */
export interface RetryContext {
  /** Total HTTP attempts made, including the first. */
  attempts: number;
  /**
   * Retries that were permitted for this request — 0 when retries were
   * disabled, or when the method made the request non-retryable (a POST
   * without an `Idempotency-Key`).
   */
  maxRetries: number;
  /**
   * Whole seconds from the most recent `Retry-After` header seen on a 429
   * during this request, if any.
   */
  lastRetryAfter: number | undefined;
  /** Total time spent sleeping between attempts, in milliseconds. */
  totalDelayMs: number;
}

/** Backoff tuning. The `random` seam keeps jitter deterministic in tests. */
export interface BackoffOptions {
  /** @default DEFAULT_RETRY_BASE_DELAY_MS */
  baseDelayMs?: number;
  /** @default DEFAULT_RETRY_MAX_DELAY_MS */
  maxDelayMs?: number;
  /** Uniform RNG over `[0, 1)`. @default Math.random */
  random?: () => number;
}

/** Options for {@link withRetries}. */
export interface RetryRunOptions extends BackoffOptions {
  /** Retries permitted after the initial attempt (0 = single attempt). */
  maxRetries: number;
  /** Honored during backoff sleeps — aborting cancels the sleep promptly. */
  signal?: AbortSignal | undefined;
  /** Injectable sleep, for deterministic tests. @default abortableSleep */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'PUT', 'DELETE']);

/**
 * Is the HTTP method idempotent, and therefore safe to blind-retry?
 * GET/HEAD/PUT/DELETE are; POST and PATCH are not (see module docs — a
 * duplicated launch provisions a second EC2 box).
 */
export function isRetryableMethod(method: string): boolean {
  return IDEMPOTENT_METHODS.has(method.toUpperCase());
}

/**
 * The POST rule: a request may be retried when its method is idempotent, or
 * when it carries an `Idempotency-Key` header — the server then dedupes a
 * replay, so retrying cannot act twice.
 */
export function canRetryRequest(method: string, headers: Headers): boolean {
  return isRetryableMethod(method) || headers.has('idempotency-key');
}

/**
 * Is this failure worth retrying? 429s, 5xx responses, and network errors
 * are; other HTTP errors (4xx) and non-HTTP failures (aborts, JSON parse
 * errors) are not.
 */
export function isRetryableError(error: unknown): error is APIError | APIConnectionError {
  if (error instanceof APIConnectionError) return true;
  if (error instanceof RateLimitError) return true;
  if (error instanceof APIError) return error.status === 429 || error.status >= 500;
  return false;
}

/**
 * The delay before the next retry, in milliseconds.
 *
 * With a server-sent `Retry-After` (whole seconds), that wait is honored
 * exactly — capped by `maxDelayMs`. Otherwise: capped full-jitter
 * exponential backoff, uniform in `[0, min(maxDelayMs, baseDelayMs * 2^n))`
 * where `n` is the number of retries already made.
 */
export function retryDelayMs(
  retriesMade: number,
  retryAfterSeconds: number | undefined,
  options: BackoffOptions = {},
): number {
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_RETRY_MAX_DELAY_MS;
  if (retryAfterSeconds !== undefined) {
    return Math.min(Math.max(0, retryAfterSeconds) * 1000, maxDelayMs);
  }
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
  const random = options.random ?? Math.random;
  const ceiling = Math.min(maxDelayMs, baseDelayMs * 2 ** retriesMade);
  return Math.floor(random() * ceiling);
}

/**
 * `setTimeout` as a promise, cancelled promptly by the signal: aborting
 * clears the timer and rejects with the signal's reason (an `AbortError`
 * `DOMException` by default), exactly like an aborted `fetch`.
 */
export function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortReason(signal));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortReason(signal as AbortSignal));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('This operation was aborted', 'AbortError');
}

/** Validate a `maxRetries` value (constructor option or per-request). */
export function assertValidMaxRetries(value: number): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new SlothboxError(`maxRetries must be a non-negative integer (got ${value})`);
  }
  return value;
}

/**
 * Run `attempt` with the retry policy described in the module docs. The
 * caller decides *whether* the request may be retried at all (the POST rule,
 * via {@link canRetryRequest}) by passing `maxRetries: 0` when it may not;
 * this function decides *which failures* are retryable and how long to wait.
 */
export async function withRetries<T>(
  attempt: () => Promise<T>,
  options: RetryRunOptions,
): Promise<T> {
  const sleep = options.sleep ?? abortableSleep;
  let lastRetryAfter: number | undefined;
  let totalDelayMs = 0;

  for (let attemptsMade = 1; ; attemptsMade++) {
    try {
      return await attempt();
    } catch (error) {
      // Aborts and non-retryable failures (4xx, parse errors, …) pass
      // through untouched — no retries, no context.
      if (!isRetryableError(error)) throw error;

      const retryAfter = error instanceof RateLimitError ? error.retryAfter : undefined;
      if (retryAfter !== undefined) lastRetryAfter = retryAfter;

      if (attemptsMade > options.maxRetries) {
        error.retryContext = {
          attempts: attemptsMade,
          maxRetries: options.maxRetries,
          lastRetryAfter,
          totalDelayMs,
        };
        throw error;
      }

      const delayMs = retryDelayMs(attemptsMade - 1, retryAfter, options);
      await sleep(delayMs, options.signal);
      totalDelayMs += delayMs;
    }
  }
}
