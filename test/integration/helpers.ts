/**
 * Test-local plumbing for the live integration suite (SLO-136).
 *
 * Everything here is deliberately self-contained so the suite works against
 * the SLO-127 base alone:
 *
 * - `pollUntil` / `waitForEnvironmentStatus` — a local poll helper instead of
 *   the SDK waiters. TODO(SLO-135): once the waiters branch merges, switch the
 *   lifecycle test to `environments.waitUntilReady`/`waitUntilStopped` and
 *   delete `waitForEnvironmentStatus`.
 * - `signWebhookPayload` / `verifyWebhookSignature` — a WebCrypto HMAC helper
 *   for the Standard-Webhooks `v1,<base64>` scheme. TODO(SLO-128): once the
 *   webhook verification toolkit merges, verify with the SDK helper instead.
 * - `CleanupStack` + `sweepFixtureLeftovers` — the guaranteed-teardown
 *   machinery. A leaked box is standing customer AWS spend, so teardown
 *   failures are suite failures.
 *
 * Pacing: the fixture org shares ONE compute rate tier (10/min, 60/hr across
 * launches and template writes). Lifecycle ops are serialized, polls are
 * ≥7 seconds apart, and there is never more than one launch per run.
 */

import {
  ConflictError,
  NotFoundError,
  RateLimitError,
  Slothbox,
  type components,
} from '../../src/index.js';

/** Prefix every created resource carries — the sweep keys off it. */
export const CI_RESOURCE_PREFIX = 'sdk-ci-';
/** env-config keys must match /^[A-Z_][A-Z0-9_]*$/i — this is the `sdk-ci-` prefix in that alphabet. */
export const CI_ENV_CONFIG_PREFIX = 'SDK_CI_';

/** Poll cadence — the ticketed floor is 7s; the org compute tier is the constraint, not GETs. */
export const POLL_INTERVAL_MS = 8_000;
/** Pause inserted before every compute-tier mutation (launch / template write). */
export const COMPUTE_PACING_MS = 7_000;

type Environment = components['schemas']['Environment'];

/* -------------------------------------------------------------------------- */
/* run id + names                                                             */
/* -------------------------------------------------------------------------- */

function envVar(name: string): string | undefined {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  const value = proc?.env?.[name];
  return value === undefined || value.trim() === '' ? undefined : value.trim();
}

/** Short unique id for this run — the GitHub run id/attempt in CI, time+random locally. */
export function makeRunId(): string {
  const ghRun = envVar('GITHUB_RUN_ID');
  if (ghRun !== undefined) {
    const attempt = envVar('GITHUB_RUN_ATTEMPT') ?? '1';
    return `gh${ghRun}-${attempt}`;
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** `sdk-ci-<runId>-<suffix>` — every created resource is named through this. */
export function ciName(runId: string, suffix: string): string {
  return `${CI_RESOURCE_PREFIX}${runId}-${suffix}`;
}

/** `SDK_CI_<RUNID>_<SUFFIX>` — the env-config-key spelling of {@link ciName}. */
export function ciEnvConfigKey(runId: string, suffix: string): string {
  const normalize = (s: string) => s.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  return `${CI_ENV_CONFIG_PREFIX}${normalize(runId)}_${normalize(suffix)}`;
}

/* -------------------------------------------------------------------------- */
/* polling                                                                    */
/* -------------------------------------------------------------------------- */

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface PollOptions {
  /** What is being awaited — used in the timeout error message. */
  description: string;
  timeoutMs: number;
  intervalMs?: number;
}

/**
 * Repeatedly run `probe` until it returns a non-undefined value. On
 * {@link RateLimitError} it honours `Retry-After` instead of the fixed
 * interval (the limiter sends delta-seconds). Times out with a descriptive
 * error. TODO(SLO-133): the retry layer may subsume the 429 handling here.
 */
export async function pollUntil<T>(
  probe: () => Promise<T | undefined>,
  options: PollOptions,
): Promise<T> {
  const intervalMs = options.intervalMs ?? POLL_INTERVAL_MS;
  const deadline = Date.now() + options.timeoutMs;
  for (;;) {
    let waitMs = intervalMs;
    try {
      const result = await probe();
      if (result !== undefined) return result;
    } catch (error) {
      if (!(error instanceof RateLimitError)) throw error;
      waitMs = Math.max(intervalMs, (error.retryAfter ?? 1) * 1000);
    }
    if (Date.now() + waitMs > deadline) {
      throw new Error(
        `Timed out after ${Math.round(options.timeoutMs / 1000)}s waiting for ${options.description}`,
      );
    }
    await sleep(waitMs);
  }
}

/** The lifecycle statuses an environment settles in. */
export type EnvTerminalStatus = 'running' | 'stopped' | 'terminated';

/**
 * Poll one environment until it reaches `until`. Fails fast on `failed`
 * (with `statusReason`) and on any status that can no longer lead to the
 * target (e.g. `terminated` while waiting for `running`). A 404 while waiting
 * for `terminated` counts as terminated.
 *
 * TODO(SLO-135): replace with the SDK waiters once that sibling PR merges.
 */
export async function waitForEnvironmentStatus(
  client: EnvironmentPoller,
  args: { orgId: string; envId: string },
  until: EnvTerminalStatus,
  options: { timeoutMs: number; intervalMs?: number; log?: (msg: string) => void },
): Promise<Environment | undefined> {
  // Which in-flight statuses are still on the way to the target.
  const enRoute: Record<EnvTerminalStatus, ReadonlySet<string>> = {
    running: new Set(['pending', 'provisioning']),
    stopped: new Set(['stopping', 'running']),
    terminated: new Set(['terminating', 'stopping', 'stopped', 'running', 'pending', 'provisioning']),
  };
  const settled = await pollUntil<{ env: Environment | undefined }>(
    async () => {
      let env: Environment;
      try {
        env = await client.environments.get(args);
      } catch (error) {
        if (until === 'terminated' && error instanceof NotFoundError) {
          options.log?.(`  ${args.envId}: 404 — treating as terminated`);
          return { env: undefined };
        }
        throw error;
      }
      options.log?.(`  ${args.envId}: status=${env.status}`);
      if (env.status === until) return { env };
      if (env.status === 'failed') {
        throw new Error(
          `Environment ${args.envId} entered 'failed' while waiting for '${until}': ${env.statusReason ?? 'no statusReason'}`,
        );
      }
      if (!enRoute[until].has(env.status)) {
        throw new Error(
          `Environment ${args.envId} is '${env.status}', which cannot reach '${until}'`,
        );
      }
      return undefined;
    },
    {
      description: `environment ${args.envId} to reach '${until}'`,
      timeoutMs: options.timeoutMs,
      ...(options.intervalMs !== undefined ? { intervalMs: options.intervalMs } : {}),
    },
  );
  return settled.env;
}

/* -------------------------------------------------------------------------- */
/* guaranteed teardown: the cleanup stack                                     */
/* -------------------------------------------------------------------------- */

export interface CleanupFailure {
  description: string;
  error: unknown;
}

/**
 * LIFO stack of teardown tasks. Register a task the moment a resource is
 * created — before any assertion can run — so `afterAll` tears everything
 * down even when the test body failed half-way.
 *
 * `runAll` attempts EVERY task even if earlier ones throw, and returns the
 * failures instead of throwing mid-way; the caller turns a non-empty failure
 * list into a loud suite failure. Tasks are popped as they run — failed tasks
 * are reported, not retried (catching what a failed task left behind is the
 * end-of-suite sweep's job).
 */
export class CleanupStack {
  #tasks: { description: string; run: () => Promise<void> }[] = [];

  /** Register a teardown task. Call this IMMEDIATELY after creating a resource. */
  push(description: string, run: () => Promise<void>): void {
    this.#tasks.push({ description, run });
  }

  /** Number of tasks still registered. */
  get size(): number {
    return this.#tasks.length;
  }

  /** Run every task, newest first. Never throws — returns the failures. */
  async runAll(log?: (msg: string) => void): Promise<CleanupFailure[]> {
    const failures: CleanupFailure[] = [];
    for (let task = this.#tasks.pop(); task !== undefined; task = this.#tasks.pop()) {
      log?.(`cleanup: ${task.description}`);
      try {
        await task.run();
      } catch (error) {
        failures.push({ description: task.description, error });
      }
    }
    return failures;
  }
}

/** True for "already gone" errors a teardown should treat as success. */
export function isAlreadyGone(error: unknown): boolean {
  return (
    error instanceof NotFoundError ||
    (error instanceof ConflictError && error.code === 'environment_terminated')
  );
}

/* -------------------------------------------------------------------------- */
/* belt-and-braces sweep                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The slice of the client the sweep + waiters need — structural, so the
 * dry-run tests can exercise the mechanics against a mock without network.
 * The real {@link Slothbox} client satisfies it as-is.
 */
export interface EnvironmentPoller {
  environments: {
    get(args: { orgId: string; envId: string }): Promise<Environment>;
  };
}

export interface SweepClient extends EnvironmentPoller {
  environments: {
    list(args: { orgId: string }): Promise<{ environments: Environment[] }>;
    get(args: { orgId: string; envId: string }): Promise<Environment>;
    terminate(args: { orgId: string; envId: string }): Promise<Environment>;
  };
  templates: {
    list(args: {
      orgId: string;
    }): Promise<{ templates: { templateId: string; name: string }[] }>;
    delete(args: { orgId: string; templateId: string }): Promise<void>;
  };
  webhooks: {
    listEndpoints(args: {
      orgId: string;
    }): Promise<{ endpoints: { endpointId: string; description?: string }[] }>;
    deleteEndpoint(args: { orgId: string; endpointId: string }): Promise<void>;
  };
  secrets: {
    listEnvConfig(args: { orgId: string }): Promise<{
      items: {
        key: string;
        scope: 'org' | 'repo' | 'template' | 'environment';
        kind: 'secret' | 'variable';
        repoId?: string;
        templateId?: string;
        environmentId?: string;
      }[];
    }>;
    deleteEnvConfig(args: {
      orgId: string;
      key: string;
      query: {
        scope: 'org' | 'repo' | 'template' | 'environment';
        kind: 'secret' | 'variable';
        repoId?: string;
        templateId?: string;
        environmentId?: string;
      };
    }): Promise<{ deleted: boolean }>;
  };
}

export interface SweepOptions {
  orgId: string;
  /**
   * The fixture's own template (it is named `sdk-ci-minimal` per the SLO-123
   * runbook, so the name-prefix match WOULD catch it) — never deleted.
   */
  protectedTemplateId: string;
  intervalMs?: number;
  /** How long to wait for a leftover box to reach `terminated`. */
  terminateTimeoutMs?: number;
  log?: (msg: string) => void;
}

/**
 * Terminate/delete every `sdk-ci-`-prefixed leftover in the fixture org:
 * environments (terminated AND verified terminal by polling), webhook
 * endpoints, draft/stray templates (except the protected fixture template),
 * and `SDK_CI_`-prefixed env-config entries.
 *
 * Run at suite start (catches leaks from a previous crashed/cancelled run)
 * and at suite end (catches anything the cleanup stack missed). Returns a
 * human-readable list of what it had to clean — non-empty at suite end means
 * a teardown-registration bug and is treated as a failure by the suite.
 *
 * Never touches resources without the prefix: a non-`sdk-ci-` box in the
 * fixture org is a human's (e.g. a manual `check-sdk-fixture.sh --smoke`).
 */
export async function sweepFixtureLeftovers(
  client: SweepClient,
  options: SweepOptions,
): Promise<string[]> {
  const { orgId, log } = options;
  const cleaned: string[] = [];

  // 1. Environments — the expensive leak. Terminate, then verify terminal.
  const { environments } = await client.environments.list({ orgId });
  const leftoverBoxes = environments.filter(
    (env) => env.name.startsWith(CI_RESOURCE_PREFIX) && env.status !== 'terminated',
  );
  for (const env of leftoverBoxes) {
    log?.(`sweep: leftover box ${env.envId} (${env.name}, ${env.status}) — terminating`);
    if (env.status !== 'terminating') {
      try {
        await client.environments.terminate({ orgId, envId: env.envId });
      } catch (error) {
        if (!isAlreadyGone(error)) throw error;
      }
    }
    cleaned.push(`environment ${env.envId} (${env.name}, was ${env.status})`);
  }
  // Serialize the waits (pacing) — and a box that won't die is a hard failure.
  for (const env of leftoverBoxes) {
    await waitForEnvironmentStatus(client, { orgId, envId: env.envId }, 'terminated', {
      timeoutMs: options.terminateTimeoutMs ?? 10 * 60_000,
      ...(options.intervalMs !== undefined ? { intervalMs: options.intervalMs } : {}),
      ...(log !== undefined ? { log } : {}),
    });
  }

  // 2. Webhook endpoints — matched on the sdk-ci- description prefix.
  const { endpoints } = await client.webhooks.listEndpoints({ orgId });
  for (const endpoint of endpoints) {
    if (!endpoint.description?.startsWith(CI_RESOURCE_PREFIX)) continue;
    log?.(`sweep: leftover webhook endpoint ${endpoint.endpointId} — deleting`);
    try {
      await client.webhooks.deleteEndpoint({ orgId, endpointId: endpoint.endpointId });
    } catch (error) {
      if (!isAlreadyGone(error)) throw error;
    }
    cleaned.push(`webhook endpoint ${endpoint.endpointId} (${endpoint.description})`);
  }

  // 3. Templates — except the fixture's own (protected by id, since its NAME
  //    carries the same prefix).
  const { templates } = await client.templates.list({ orgId });
  for (const template of templates) {
    if (template.templateId === options.protectedTemplateId) continue;
    if (!template.name.startsWith(CI_RESOURCE_PREFIX)) continue;
    log?.(`sweep: leftover template ${template.templateId} (${template.name}) — deleting`);
    try {
      await client.templates.delete({ orgId, templateId: template.templateId });
    } catch (error) {
      if (!isAlreadyGone(error)) throw error;
    }
    cleaned.push(`template ${template.templateId} (${template.name})`);
  }

  // 4. env-config entries.
  const { items } = await client.secrets.listEnvConfig({ orgId });
  for (const item of items) {
    if (!item.key.startsWith(CI_ENV_CONFIG_PREFIX)) continue;
    log?.(`sweep: leftover env-config ${item.key} (${item.scope}/${item.kind}) — deleting`);
    await client.secrets.deleteEnvConfig({
      orgId,
      key: item.key,
      query: {
        scope: item.scope,
        kind: item.kind,
        ...(item.repoId !== undefined ? { repoId: item.repoId } : {}),
        ...(item.templateId !== undefined ? { templateId: item.templateId } : {}),
        ...(item.environmentId !== undefined ? { environmentId: item.environmentId } : {}),
      },
    });
    cleaned.push(`env-config ${item.key} (${item.scope}/${item.kind})`);
  }

  return cleaned;
}

/* -------------------------------------------------------------------------- */
/* webhook signature helpers (test-local WebCrypto HMAC)                      */
/* -------------------------------------------------------------------------- */

/**
 * The Standard-Webhooks scheme the API uses (see docs/webhooks-consumers.md
 * in sloth-box/api): HMAC-SHA256 over `{id}.{timestamp}.{rawBody}`, keyed on
 * the base64-decoded secret after the `whsec_` prefix, presented as
 * `v1,<base64>`; during rotation the header is a space-delimited token list
 * and matching ANY token is valid.
 *
 * TODO(SLO-128): the SDK's webhook verification toolkit ships on a sibling
 * branch — swap these test-local helpers for it post-merge.
 */

function base64ToBytes(b64: string): Uint8Array {
  const raw = atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let raw = '';
  for (const b of bytes) raw += String.fromCharCode(b);
  return btoa(raw);
}

async function importWebhookKey(secret: string): Promise<CryptoKey> {
  const keyBytes = base64ToBytes(secret.replace(/^whsec_/, ''));
  return crypto.subtle.importKey('raw', keyBytes as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

/** Compute the `v1,<base64>` signature token for one delivery. */
export async function signWebhookPayload(
  secret: string,
  webhookId: string,
  timestampSeconds: number,
  payload: string,
): Promise<string> {
  const key = await importWebhookKey(secret);
  const signedContent = `${webhookId}.${timestampSeconds}.${payload}`;
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedContent));
  return `v1,${bytesToBase64(new Uint8Array(mac))}`;
}

/**
 * Verify a `webhook-signature` header value (possibly a space-delimited list
 * of `v1,…` tokens — any match is valid) against the signed content.
 * Comparison happens inside WebCrypto's `verify` (constant-time).
 */
export async function verifyWebhookSignature(
  secret: string,
  args: { webhookId: string; timestampSeconds: number; payload: string; signatureHeader: string },
): Promise<boolean> {
  const key = await importWebhookKey(secret);
  const signedContent = `${args.webhookId}.${args.timestampSeconds}.${args.payload}`;
  const data = new TextEncoder().encode(signedContent);
  for (const token of args.signatureHeader.split(' ')) {
    if (token === '') continue;
    const b64 = token.startsWith('v1,') ? token.slice(3) : token;
    let mac: Uint8Array;
    try {
      mac = base64ToBytes(b64);
    } catch {
      continue;
    }
    if (await crypto.subtle.verify('HMAC', key, mac as BufferSource, data)) return true;
  }
  return false;
}

/* -------------------------------------------------------------------------- */
/* client factory                                                             */
/* -------------------------------------------------------------------------- */

export function makeClient(env: { apiKey: string; baseUrl: string }): Slothbox {
  return new Slothbox({ apiKey: env.apiKey, baseUrl: env.baseUrl });
}
