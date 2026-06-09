/**
 * Dry-run tests for the teardown machinery (SLO-136 acceptance: the
 * cleanup-stack mechanics are themselves tested against a mock client, no
 * network). These run on every `npm run test:integration` — with or without
 * fixture credentials — so the guaranteed-teardown logic is exercised even
 * while the live fixture org doesn't exist yet.
 */

import { describe, expect, it } from 'vitest';

import { NotFoundError } from '../../src/index.js';
import {
  CI_ENV_CONFIG_PREFIX,
  CI_RESOURCE_PREFIX,
  ciEnvConfigKey,
  ciName,
  CleanupStack,
  isAlreadyGone,
  pollUntil,
  signWebhookPayload,
  sweepFixtureLeftovers,
  verifyWebhookSignature,
  waitForEnvironmentStatus,
  type SweepClient,
} from './helpers.js';

const notFound = () => new NotFoundError('not found', { status: 404 });

describe('CleanupStack', () => {
  it('runs tasks LIFO so dependents tear down before their dependencies', async () => {
    const stack = new CleanupStack();
    const order: string[] = [];
    stack.push('delete template', async () => void order.push('template'));
    stack.push('terminate box launched from template', async () => void order.push('box'));

    const failures = await stack.runAll();

    expect(failures).toEqual([]);
    expect(order).toEqual(['box', 'template']);
    expect(stack.size).toBe(0);
  });

  it('keeps running after a task fails and reports every failure', async () => {
    const stack = new CleanupStack();
    const ran: string[] = [];
    stack.push('first registered (runs last)', async () => void ran.push('first'));
    stack.push('exploding task', async () => {
      throw new Error('boom');
    });
    stack.push('last registered (runs first)', async () => void ran.push('last'));

    const failures = await stack.runAll();

    // The failure did not stop the remaining (older) tasks from running.
    expect(ran).toEqual(['last', 'first']);
    expect(failures).toHaveLength(1);
    expect(failures[0]?.description).toBe('exploding task');
    expect((failures[0]?.error as Error).message).toBe('boom');
  });

  it('is empty after runAll — a second invocation is a no-op', async () => {
    const stack = new CleanupStack();
    let runs = 0;
    stack.push('count', async () => void runs++);
    await stack.runAll();
    await stack.runAll();
    expect(runs).toBe(1);
  });

  it('treats 404s and environment_terminated conflicts as already-gone', () => {
    expect(isAlreadyGone(notFound())).toBe(true);
    expect(isAlreadyGone(new Error('boom'))).toBe(false);
  });
});

describe('pollUntil', () => {
  it('resolves with the first non-undefined probe result', async () => {
    let calls = 0;
    const result = await pollUntil(
      async () => (++calls >= 3 ? 'ready' : undefined),
      { description: 'three probes', timeoutMs: 1_000, intervalMs: 1 },
    );
    expect(result).toBe('ready');
    expect(calls).toBe(3);
  });

  it('times out with a descriptive error', async () => {
    await expect(
      pollUntil(async () => undefined, {
        description: "environment env_x to reach 'running'",
        timeoutMs: 5,
        intervalMs: 2,
      }),
    ).rejects.toThrow(/Timed out .* environment env_x to reach 'running'/);
  });
});

/** A mutable in-memory fixture org for sweep/waiter dry-runs. */
function mockOrg() {
  const state = {
    environments: [
      // leftover from a crashed previous run — must be terminated + verified
      { envId: 'env_leak', name: `${CI_RESOURCE_PREFIX}gh1-1-box`, status: 'running' },
      // already gone — must be left alone
      { envId: 'env_done', name: `${CI_RESOURCE_PREFIX}gh1-1-old`, status: 'terminated' },
      // a human's box (no prefix) — must NEVER be touched
      { envId: 'env_human', name: 'oliver-debug', status: 'running' },
    ],
    templates: [
      // the fixture template ITSELF matches the name prefix — protected by id
      { templateId: 'tpl_fixture', name: `${CI_RESOURCE_PREFIX}minimal` },
      { templateId: 'tpl_leak', name: `${CI_RESOURCE_PREFIX}gh1-1-tpl` },
      { templateId: 'tpl_real', name: 'checkout-stack' },
    ],
    endpoints: [
      { endpointId: 'we_leak', description: `${CI_RESOURCE_PREFIX}gh1-1 integration test` },
      { endpointId: 'we_real', description: 'production alerts' },
      { endpointId: 'we_blank' }, // no description at all
    ],
    envConfig: [
      { key: `${CI_ENV_CONFIG_PREFIX}GH1_1_VAR`, scope: 'org' as const, kind: 'variable' as const },
      { key: 'DATABASE_URL', scope: 'org' as const, kind: 'secret' as const },
    ],
    terminated: [] as string[],
    deletedTemplates: [] as string[],
    deletedEndpoints: [] as string[],
    deletedEnvConfig: [] as string[],
  };

  const client: SweepClient = {
    environments: {
      list: async () => ({ environments: state.environments as never }),
      get: async ({ envId }) => {
        const env = state.environments.find((e) => e.envId === envId);
        if (!env) throw notFound();
        return env as never;
      },
      terminate: async ({ envId }) => {
        const env = state.environments.find((e) => e.envId === envId);
        if (!env) throw notFound();
        state.terminated.push(envId);
        env.status = 'terminated'; // instant termination keeps the dry-run fast
        return env as never;
      },
    },
    templates: {
      list: async () => ({ templates: state.templates }),
      delete: async ({ templateId }) => void state.deletedTemplates.push(templateId),
    },
    webhooks: {
      listEndpoints: async () => ({ endpoints: state.endpoints }),
      deleteEndpoint: async ({ endpointId }) => void state.deletedEndpoints.push(endpointId),
    },
    secrets: {
      listEnvConfig: async () => ({ items: state.envConfig }),
      deleteEnvConfig: async ({ key }) => {
        state.deletedEnvConfig.push(key);
        return { deleted: true };
      },
    },
  };

  return { state, client };
}

describe('sweepFixtureLeftovers (mock client dry-run)', () => {
  it('terminates only sdk-ci- boxes, deletes sdk-ci- webhooks/templates/env-config, protects the fixture template', async () => {
    const { state, client } = mockOrg();

    const cleaned = await sweepFixtureLeftovers(client, {
      orgId: 'org_fixture',
      protectedTemplateId: 'tpl_fixture',
      intervalMs: 1,
      terminateTimeoutMs: 1_000,
    });

    expect(state.terminated).toEqual(['env_leak']); // not env_done, NEVER env_human
    expect(state.deletedEndpoints).toEqual(['we_leak']);
    expect(state.deletedTemplates).toEqual(['tpl_leak']); // fixture + real templates untouched
    expect(state.deletedEnvConfig).toEqual([`${CI_ENV_CONFIG_PREFIX}GH1_1_VAR`]);
    expect(cleaned).toHaveLength(4);
    expect(cleaned.join('\n')).toMatch(/env_leak/);
  });

  it('returns an empty list when the org is already clean', async () => {
    const { state, client } = mockOrg();
    state.environments = state.environments.filter((e) => e.envId === 'env_human');
    state.templates = state.templates.filter((t) => t.templateId !== 'tpl_leak');
    state.endpoints = state.endpoints.filter((e) => e.endpointId !== 'we_leak');
    state.envConfig = state.envConfig.filter((i) => !i.key.startsWith(CI_ENV_CONFIG_PREFIX));

    const cleaned = await sweepFixtureLeftovers(client, {
      orgId: 'org_fixture',
      protectedTemplateId: 'tpl_fixture',
      intervalMs: 1,
    });

    expect(cleaned).toEqual([]);
    expect(state.terminated).toEqual([]);
  });

  it('fails loudly when a leftover box never reaches terminated', async () => {
    const { state, client } = mockOrg();
    // terminate() "succeeds" but the box sticks in `terminating`.
    client.environments.terminate = async ({ envId }) => {
      const env = state.environments.find((e) => e.envId === envId)!;
      env.status = 'terminating';
      return env as never;
    };

    await expect(
      sweepFixtureLeftovers(client, {
        orgId: 'org_fixture',
        protectedTemplateId: 'tpl_fixture',
        intervalMs: 1,
        terminateTimeoutMs: 10,
      }),
    ).rejects.toThrow(/Timed out .* env_leak .*terminated/);
  });
});

describe('waitForEnvironmentStatus (mock client dry-run)', () => {
  const poller = (statuses: string[]) => {
    let i = 0;
    return {
      environments: {
        get: async () => {
          const status = statuses[Math.min(i++, statuses.length - 1)]!;
          return { envId: 'env_1', status } as never;
        },
      },
    };
  };

  it('walks pending → provisioning → running', async () => {
    const env = await waitForEnvironmentStatus(
      poller(['pending', 'provisioning', 'running']),
      { orgId: 'org_1', envId: 'env_1' },
      'running',
      { timeoutMs: 1_000, intervalMs: 1 },
    );
    expect(env?.status).toBe('running');
  });

  it('fails fast with statusReason when the box enters failed', async () => {
    const failing = {
      environments: {
        get: async () => ({ envId: 'env_1', status: 'failed', statusReason: 'quota' }) as never,
      },
    };
    await expect(
      waitForEnvironmentStatus(failing, { orgId: 'org_1', envId: 'env_1' }, 'running', {
        timeoutMs: 1_000,
        intervalMs: 1,
      }),
    ).rejects.toThrow(/failed.*quota/);
  });

  it('fails fast on a status that cannot reach the target', async () => {
    await expect(
      waitForEnvironmentStatus(poller(['terminated']), { orgId: 'org_1', envId: 'env_1' }, 'running', {
        timeoutMs: 1_000,
        intervalMs: 1,
      }),
    ).rejects.toThrow(/'terminated', which cannot reach 'running'/);
  });

  it('treats a 404 as terminated when waiting for terminated', async () => {
    const gone = {
      environments: {
        get: async () => {
          throw notFound();
        },
      },
    };
    const env = await waitForEnvironmentStatus(gone, { orgId: 'org_1', envId: 'env_1' }, 'terminated', {
      timeoutMs: 1_000,
      intervalMs: 1,
    });
    expect(env).toBeUndefined();
  });
});

describe('webhook signature helpers (test-local WebCrypto HMAC)', () => {
  // A synthetic whsec_ secret: base64 of 24 known bytes.
  const secret = `whsec_${btoa('0123456789abcdef01234567')}`;
  const webhookId = 'msg_01HTEST';
  const ts = 1_780_000_000;
  const payload = JSON.stringify({ id: webhookId, type: 'webhook.ping', data: {} });

  it('signs and verifies the {id}.{timestamp}.{payload} content', async () => {
    const token = await signWebhookPayload(secret, webhookId, ts, payload);
    expect(token).toMatch(/^v1,[A-Za-z0-9+/]+=*$/);
    await expect(
      verifyWebhookSignature(secret, { webhookId, timestampSeconds: ts, payload, signatureHeader: token }),
    ).resolves.toBe(true);
  });

  it('rejects a tampered payload, id, or timestamp', async () => {
    const token = await signWebhookPayload(secret, webhookId, ts, payload);
    await expect(
      verifyWebhookSignature(secret, {
        webhookId,
        timestampSeconds: ts,
        payload: payload.replace('ping', 'pong'),
        signatureHeader: token,
      }),
    ).resolves.toBe(false);
    await expect(
      verifyWebhookSignature(secret, {
        webhookId: 'msg_OTHER',
        timestampSeconds: ts,
        payload,
        signatureHeader: token,
      }),
    ).resolves.toBe(false);
    await expect(
      verifyWebhookSignature(secret, {
        webhookId,
        timestampSeconds: ts + 1,
        payload,
        signatureHeader: token,
      }),
    ).resolves.toBe(false);
  });

  it('accepts any token in a space-delimited rotation list', async () => {
    const oldSecret = `whsec_${btoa('fedcba9876543210fedcba98')}`;
    const goodToken = await signWebhookPayload(secret, webhookId, ts, payload);
    const staleToken = await signWebhookPayload(oldSecret, webhookId, ts, payload);
    await expect(
      verifyWebhookSignature(secret, {
        webhookId,
        timestampSeconds: ts,
        payload,
        signatureHeader: `${staleToken} ${goodToken}`,
      }),
    ).resolves.toBe(true);
    await expect(
      verifyWebhookSignature(secret, {
        webhookId,
        timestampSeconds: ts,
        payload,
        signatureHeader: staleToken,
      }),
    ).resolves.toBe(false);
  });
});

describe('resource naming', () => {
  it('prefixes every name with sdk-ci- and the run id', () => {
    expect(ciName('gh42-1', 'box')).toBe('sdk-ci-gh42-1-box');
    expect(ciName('gh42-1', 'box').startsWith(CI_RESOURCE_PREFIX)).toBe(true);
  });

  it('spells env-config keys in the key alphabet ([A-Z0-9_])', () => {
    const key = ciEnvConfigKey('gh42-1', 'var');
    expect(key).toBe('SDK_CI_GH42_1_VAR');
    expect(key).toMatch(/^[A-Z_][A-Z0-9_]*$/);
    expect(key.startsWith(CI_ENV_CONFIG_PREFIX)).toBe(true);
  });
});
