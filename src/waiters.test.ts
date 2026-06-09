/**
 * Waiter unit tests (SLO-135): mocked fetch sequences over the status enums
 * from the registry schemas — transitional progressions, terminal-state
 * short-circuits, deadline timeouts, aborts, and the safe-launch composition
 * with its auto-generated Idempotency-Key. Fake timers drive the backoff, so
 * the pacing assertions are exact.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment, pendingEnvironment } from './__fixtures__/fixtures.js';
import { createMockFetch, jsonResponse } from './__fixtures__/mock-fetch.js';
import type { components } from './generated/api.js';
import {
  DEFAULT_POLL_INTERVAL_MS,
  Slothbox,
  WaiterStateError,
  WaiterTimeoutError,
} from './index.js';

type Schemas = components['schemas'];

const ENV_PATH = `/organizations/org_1/environments/${environment.envId}`;

function envResponse(status: Schemas['Environment']['status'], statusReason?: string) {
  return jsonResponse(200, {
    ...environment,
    status,
    ...(statusReason === undefined ? {} : { statusReason }),
  });
}

const templateWithChildren = (
  status: Schemas['Template']['status'],
): Schemas['TemplateWithChildren'] => ({
  template: {
    templateId: 'tpl_01HXYZABCD',
    name: 'checkout-stack',
    region: 'eu-west-2',
    status,
    runtimeBundleHash: 'a2f9c4d8e1b7',
    needsRebake: false,
    createdByUserId: 'usr_01HVVV5678',
    createdAt: '2026-06-08T10:15:00.000Z',
    updatedAt: '2026-06-08T10:21:42.000Z',
  },
  services: [],
  projects: [],
});

function clientWith(...responses: Response[]) {
  const mock = createMockFetch(...responses);
  return { client: new Slothbox({ apiKey: 'sk_test', fetch: mock.fetch }), mock };
}

const envArgs = { orgId: 'org_1', envId: environment.envId };

describe('waiters (fake timers)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('environments.waitUntilReady', () => {
    it('polls pending → provisioning → running and resolves with the running box', async () => {
      const { client, mock } = clientWith(
        envResponse('pending'),
        envResponse('provisioning'),
        envResponse('running'),
      );
      const promise = client.environments.waitUntilReady(envArgs);

      await vi.advanceTimersByTimeAsync(0); // immediate first poll
      expect(mock.requests).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(7_000); // initial interval
      expect(mock.requests).toHaveLength(2);
      await vi.advanceTimersByTimeAsync(10_500); // 7s × 1.5

      const box = await promise;
      expect(box.status).toBe('running');
      expect(mock.requests).toHaveLength(3);
      for (const request of mock.requests) {
        expect(request.method).toBe('GET');
        expect(request.url.pathname).toBe(ENV_PATH);
      }
    });

    it('backs off 7s → ×1.5 → capped at 30s', async () => {
      const { client, mock } = clientWith(
        ...Array.from({ length: 7 }, () => envResponse('provisioning')),
      );
      const controller = new AbortController();
      const settled = client.environments
        .waitUntilReady(envArgs, { signal: controller.signal })
        .catch((error: unknown) => error);

      // Polls land at 0, 7s, 17.5s, 33.25s, 56.875s, 86.875s (interval capped
      // at 30s from there on), 116.875s.
      const pollAt = [0, 7_000, 17_500, 33_250, 56_875, 86_875, 116_875];
      let elapsed = 0;
      for (const [i, at] of pollAt.entries()) {
        await vi.advanceTimersByTimeAsync(at - elapsed);
        elapsed = at;
        expect(mock.requests).toHaveLength(i + 1);
        if (at > 0) {
          // one tick earlier there must NOT have been a poll yet
          expect(mock.requests.length).toBe(i + 1);
        }
      }
      // First minute: 5 polls — comfortably under the org compute tier's 10/min.
      expect(pollAt.filter((at) => at < 60_000)).toHaveLength(5);

      controller.abort();
      await settled;
    });

    it('short-circuits on failed with the observed status and reason', async () => {
      const { client, mock } = clientWith(
        envResponse('pending'),
        envResponse('failed', 'RunInstances rejected: insufficient capacity'),
      );
      const settled = client.environments
        .waitUntilReady(envArgs)
        .catch((error: unknown) => error);

      await vi.advanceTimersByTimeAsync(DEFAULT_POLL_INTERVAL_MS);
      const error = await settled;
      expect(error).toBeInstanceOf(WaiterStateError);
      const stateError = error as WaiterStateError;
      expect(stateError.status).toBe('failed');
      expect(stateError.target).toBe('running');
      expect(stateError.resource).toBe('environment');
      expect(stateError.resourceId).toBe(environment.envId);
      expect(stateError.statusReason).toBe('RunInstances rejected: insufficient capacity');
      expect(stateError.message).toContain('insufficient capacity');
      // Threw on the second poll — did not keep spinning to the deadline.
      expect(mock.requests).toHaveLength(2);
    });

    it.each(['stopped', 'stopping', 'terminating', 'terminated'] as const)(
      'fails fast when the box is %s (wrong direction — e.g. auto-sleep beat us)',
      async (status) => {
        const { client, mock } = clientWith(envResponse(status));
        const error = await client.environments
          .waitUntilReady(envArgs)
          .catch((e: unknown) => e);
        expect(error).toBeInstanceOf(WaiterStateError);
        expect((error as WaiterStateError).status).toBe(status);
        expect(mock.requests).toHaveLength(1);
      },
    );

    it('throws WaiterTimeoutError after a final poll at the deadline', async () => {
      // timeoutMs 20s → polls at 0, 7s, 17.5s, and a clamped final one at 20s.
      const { client, mock } = clientWith(
        ...Array.from({ length: 4 }, () => envResponse('provisioning')),
      );
      const settled = client.environments
        .waitUntilReady(envArgs, { timeoutMs: 20_000 })
        .catch((error: unknown) => error);

      await vi.advanceTimersByTimeAsync(20_000);
      const error = await settled;
      expect(error).toBeInstanceOf(WaiterTimeoutError);
      const timeoutError = error as WaiterTimeoutError;
      expect(timeoutError.lastStatus).toBe('provisioning');
      expect(timeoutError.timeoutMs).toBe(20_000);
      expect(timeoutError.target).toBe('running');
      expect(timeoutError.resourceId).toBe(environment.envId);
      expect(mock.requests).toHaveLength(4);
    });

    it('aborting the signal cancels the wait between polls', async () => {
      const { client, mock } = clientWith(envResponse('provisioning'));
      const controller = new AbortController();
      const settled = client.environments
        .waitUntilReady(envArgs, { signal: controller.signal })
        .catch((error: unknown) => error);

      await vi.advanceTimersByTimeAsync(0);
      expect(mock.requests).toHaveLength(1);
      controller.abort();
      const error = await settled;
      expect((error as Error).name).toBe('AbortError');

      // The pending sleep was cleared — no further polls ever fire.
      await vi.advanceTimersByTimeAsync(120_000);
      expect(mock.requests).toHaveLength(1);
    });

    it('rejects immediately on an already-aborted signal without polling', async () => {
      const { client, mock } = clientWith();
      const controller = new AbortController();
      controller.abort();
      const error = await client.environments
        .waitUntilReady(envArgs, { signal: controller.signal })
        .catch((e: unknown) => e);
      expect((error as Error).name).toBe('AbortError');
      expect(mock.requests).toHaveLength(0);
    });
  });

  describe('environments.waitUntilStopped', () => {
    it('tolerates running, polls through stopping, resolves on stopped', async () => {
      const { client, mock } = clientWith(
        envResponse('running'),
        envResponse('stopping'),
        envResponse('stopped'),
      );
      const promise = client.environments.waitUntilStopped(envArgs);
      await vi.advanceTimersByTimeAsync(7_000 + 10_500);
      const box = await promise;
      expect(box.status).toBe('stopped');
      expect(mock.requests).toHaveLength(3);
    });

    it.each(['terminating', 'terminated', 'failed'] as const)(
      'short-circuits on %s — a terminated box will never be stopped',
      async (status) => {
        const { client, mock } = clientWith(envResponse(status));
        const error = await client.environments
          .waitUntilStopped(envArgs)
          .catch((e: unknown) => e);
        expect(error).toBeInstanceOf(WaiterStateError);
        expect((error as WaiterStateError).status).toBe(status);
        expect((error as WaiterStateError).target).toBe('stopped');
        expect(mock.requests).toHaveLength(1);
      },
    );
  });

  describe('templates.waitUntilBaked', () => {
    const templateArgs = { orgId: 'org_1', templateId: 'tpl_01HXYZABCD' };

    it('polls bundle_building → ready, reading status from template.status', async () => {
      const { client, mock } = clientWith(
        jsonResponse(200, templateWithChildren('bundle_building')),
        jsonResponse(200, templateWithChildren('ready')),
      );
      const promise = client.templates.waitUntilBaked(templateArgs);
      await vi.advanceTimersByTimeAsync(7_000);
      const baked = await promise;
      expect(baked.template.status).toBe('ready');
      expect(mock.requests).toHaveLength(2);
      expect(mock.requests[0]!.url.pathname).toBe('/organizations/org_1/templates/tpl_01HXYZABCD');
    });

    it('short-circuits on bundle_failed', async () => {
      const { client, mock } = clientWith(
        jsonResponse(200, templateWithChildren('bundle_building')),
        jsonResponse(200, templateWithChildren('bundle_failed')),
      );
      const settled = client.templates.waitUntilBaked(templateArgs).catch((e: unknown) => e);
      await vi.advanceTimersByTimeAsync(7_000);
      const error = await settled;
      expect(error).toBeInstanceOf(WaiterStateError);
      expect((error as WaiterStateError).status).toBe('bundle_failed');
      expect((error as WaiterStateError).resource).toBe('template');
      expect(mock.requests).toHaveLength(2);
    });

    it('fails fast on draft — no bake is in flight, so waiting could only time out', async () => {
      const { client, mock } = clientWith(jsonResponse(200, templateWithChildren('draft')));
      const error = await client.templates
        .waitUntilBaked(templateArgs)
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(WaiterStateError);
      expect((error as WaiterStateError).status).toBe('draft');
      expect(mock.requests).toHaveLength(1);
    });
  });

  describe('environments.launchAndWait', () => {
    it('waits out the launched box and surfaces launch failures typed', async () => {
      const { client, mock } = clientWith(
        jsonResponse(201, pendingEnvironment),
        jsonResponse(200, { ...pendingEnvironment, status: 'provisioning' }),
        jsonResponse(200, {
          ...pendingEnvironment,
          status: 'failed',
          statusReason: 'assume-role denied',
        }),
      );
      const settled = client.environments
        .launchAndWait({ orgId: 'org_1', body: { templateId: 'tpl_01HXYZABCD' } })
        .catch((error: unknown) => error);

      await vi.advanceTimersByTimeAsync(7_000);
      const error = await settled;
      expect(error).toBeInstanceOf(WaiterStateError);
      expect((error as WaiterStateError).statusReason).toBe('assume-role denied');
      expect(mock.requests).toHaveLength(3);
    });
  });
});

// These resolve on the immediate first poll — no timer control needed.
describe('launchAndWait idempotency (real timers)', () => {
  it('auto-generates a UUID Idempotency-Key and polls the returned envId', async () => {
    const { client, mock } = clientWith(
      jsonResponse(201, pendingEnvironment),
      jsonResponse(200, { ...pendingEnvironment, status: 'running' }),
    );
    const box = await client.environments.launchAndWait({
      orgId: 'org_1',
      body: { templateId: 'tpl_01HXYZABCD', name: 'checkout-dev' },
    });
    expect(box.status).toBe('running');

    const [launch, poll] = mock.requests;
    expect(launch!.method).toBe('POST');
    expect(launch!.url.pathname).toBe('/organizations/org_1/environments');
    expect(launch!.headers.get('idempotency-key')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(poll!.method).toBe('GET');
    // Polls the box the launch returned — not anything caller-supplied.
    expect(poll!.url.pathname).toBe(
      `/organizations/org_1/environments/${pendingEnvironment.envId}`,
    );
  });

  it('passes a caller-supplied Idempotency-Key through verbatim', async () => {
    const { client, mock } = clientWith(
      jsonResponse(201, pendingEnvironment),
      jsonResponse(200, { ...pendingEnvironment, status: 'running' }),
    );
    await client.environments.launchAndWait(
      { orgId: 'org_1', body: { templateId: 'tpl_01HXYZABCD' } },
      { idempotencyKey: 'deploy-1234-attempt' },
    );
    expect(mock.requests[0]!.headers.get('idempotency-key')).toBe('deploy-1234-attempt');
  });

  it('standalone waiter resolves immediately when the box is already running', async () => {
    const { client, mock } = clientWith(envResponse('running'));
    const box = await client.environments.waitUntilReady(envArgs);
    expect(box.status).toBe('running');
    expect(mock.requests).toHaveLength(1);
  });
});
