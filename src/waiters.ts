/**
 * Lifecycle waiters and safe launch (SLO-135).
 *
 * Status-polling helpers that encode the environment and template lifecycles
 * so integrators don't have to reverse-engineer them. The status graphs come
 * from the pinned OpenAPI spec (which mirrors the API's repositories):
 *
 * **Environment** (`status` on the `Environment` schema):
 *
 * ```
 * launch → pending → provisioning → running
 * stop   → stopping → stopped         start → provisioning → running
 * terminate → terminating → terminated
 * failed (launch failure — see statusReason)
 * ```
 *
 * **Template** (`status` on the `Template` schema):
 *
 * ```
 * create/publish → bundle_building → ready | bundle_failed
 * draft (saved builder state — no bake in flight)
 * ```
 *
 * Waiters poll the resource's GET endpoint until it reaches the target
 * status. Landing in a state the lifecycle can never leave on its own (e.g.
 * `failed`, `terminated`, or `bundle_failed`) throws a {@link WaiterStateError}
 * immediately instead of spinning to the deadline; exhausting the overall
 * timeout throws a {@link WaiterTimeoutError}.
 *
 * **Polling pace.** Launches and bakes sit in the API's org-wide *compute*
 * rate tier (10 requests/min, 60/hr — they spin up real EC2 in the customer
 * account), and the status reads the waiters issue assume-role into that same
 * account. Polling therefore starts at 7s (≤ 9 requests in the first minute,
 * under the 10/min tier) and backs off ×1.5 toward a 30s ceiling, so a full
 * default-timeout wait costs ~24 reads over 10 minutes — leaving the org's
 * hourly compute budget for actual launches, not polling.
 *
 * **Auto-sleep.** "Ready once" ≠ "running forever": the org's auto-sleep
 * policy (idle auto-stop and scheduled sleep windows, SLO-22) can stop a
 * `running` box later. After {@link waitUntilEnvironmentReady} resolves, treat
 * the box as ready *now* — re-check with `environments.get()` before relying
 * on it later, or subscribe to `environment.stopped` webhook events
 * (`slothbox.webhooks`) to observe sleeps as they happen.
 */

import type { APIRequester, ArgsOf, RequestOptions } from './core.js';
import { SlothboxError } from './errors.js';
import type { components } from './generated/api.js';

type Environment = components['schemas']['Environment'];
type TemplateWithChildren = components['schemas']['TemplateWithChildren'];

/** `status` of the `Environment` schema in the pinned spec. */
export type EnvironmentStatus = Environment['status'];
/** `status` of the `Template` schema in the pinned spec. */
export type TemplateStatus = components['schemas']['Template']['status'];

/** Which kind of resource a waiter was watching when it threw. */
export type WaiterResource = 'environment' | 'template';

/**
 * Initial delay between polls (7s). Chosen so a waiter never bursts past the
 * org-wide compute rate tier (10/min): at 7s the first minute holds at most
 * 9 requests, even before backoff kicks in.
 */
export const DEFAULT_POLL_INTERVAL_MS = 7_000;

/**
 * Ceiling the poll interval backs off toward (30s). Long waits settle at two
 * status reads a minute — a 10-minute wait costs ~24 requests total, keeping
 * a comfortable margin inside the org's 60/hr compute tier for the launches
 * and bakes themselves.
 */
export const DEFAULT_MAX_POLL_INTERVAL_MS = 30_000;

/** Multiplier applied to the poll interval after each poll (deterministic — no jitter). */
export const POLL_BACKOFF_FACTOR = 1.5;

/**
 * Default overall deadline for environment waiters (10 minutes). A real EC2
 * launch — RunInstances, boot, daemon ready — usually completes in 2–4
 * minutes; 10 minutes absorbs slow instance types and AWS weather.
 */
export const DEFAULT_ENVIRONMENT_TIMEOUT_MS = 10 * 60_000;

/**
 * Default overall deadline for {@link waitUntilTemplateBaked} (20 minutes).
 * Bakes usually finish in 4–6 minutes, but AMI capture on a large root volume
 * can run far longer.
 */
export const DEFAULT_BAKE_TIMEOUT_MS = 20 * 60_000;

/** Options accepted by every waiter. */
export interface WaiterOptions {
  /**
   * Abort the waiter: cancels the in-flight status read and any pending
   * sleep, rejecting with the signal's reason (an `AbortError` by default).
   */
  signal?: AbortSignal;
  /**
   * Overall deadline in milliseconds. Defaults to
   * {@link DEFAULT_ENVIRONMENT_TIMEOUT_MS} (environment waiters) or
   * {@link DEFAULT_BAKE_TIMEOUT_MS} ({@link waitUntilTemplateBaked}). A final
   * poll is always made at the deadline before {@link WaiterTimeoutError} is
   * thrown.
   */
  timeoutMs?: number;
  /**
   * Initial delay between polls. Defaults to
   * {@link DEFAULT_POLL_INTERVAL_MS} (7s) — see the module docs for why this
   * floor matters against the org compute rate tier. Lower it only against
   * non-production stacks.
   */
  pollIntervalMs?: number;
  /**
   * Ceiling the interval backs off toward (×{@link POLL_BACKOFF_FACTOR} per
   * poll). Defaults to {@link DEFAULT_MAX_POLL_INTERVAL_MS} (30s).
   */
  maxPollIntervalMs?: number;
}

/**
 * Options for {@link launchEnvironmentAndWait} / `environments.launchAndWait`.
 */
export interface LaunchAndWaitOptions extends WaiterOptions {
  /**
   * `Idempotency-Key` header for the launch POST. **Auto-generated**
   * (`crypto.randomUUID()`) when omitted, so every launch through this helper
   * is replay-safe: retrying with the same key returns the original box
   * instead of starting a duplicate.
   *
   * This is also what makes the launch retryable by the SDK's retry
   * middleware (SLO-133), which only ever retries POSTs that carry an
   * Idempotency-Key. Pass your own stable key to deduplicate launches across
   * process restarts.
   */
  idempotencyKey?: string;
}

/**
 * The waiter observed a status the lifecycle can never leave on its own
 * (e.g. `failed`, `terminated`, `bundle_failed`) — thrown immediately, not at
 * the deadline. `status` carries the observed status; for environments,
 * `statusReason` carries the API's failure detail when present.
 */
export class WaiterStateError extends SlothboxError {
  /** What was being watched. */
  readonly resource: WaiterResource;
  /** The envId / templateId being watched. */
  readonly resourceId: string;
  /** The terminal status that was observed. */
  readonly status: string;
  /** The status the waiter was trying to reach. */
  readonly target: string;
  /** The environment's `statusReason`, when the API provided one. */
  readonly statusReason: string | undefined;

  constructor(details: {
    resource: WaiterResource;
    resourceId: string;
    status: string;
    target: string;
    statusReason?: string | undefined;
  }) {
    const reason = details.statusReason ? `: ${details.statusReason}` : '';
    super(
      `${details.resource} ${details.resourceId} reached terminal status "${details.status}" ` +
        `while waiting for "${details.target}"${reason}`,
    );
    this.name = 'WaiterStateError';
    this.resource = details.resource;
    this.resourceId = details.resourceId;
    this.status = details.status;
    this.target = details.target;
    this.statusReason = details.statusReason;
  }
}

/**
 * The waiter's overall deadline passed without the resource reaching the
 * target status. `lastStatus` is the most recently observed status — the
 * resource may still get there on its own; the waiter just stopped watching.
 */
export class WaiterTimeoutError extends SlothboxError {
  /** What was being watched. */
  readonly resource: WaiterResource;
  /** The envId / templateId being watched. */
  readonly resourceId: string;
  /** The status the waiter was trying to reach. */
  readonly target: string;
  /** The status observed on the final poll. */
  readonly lastStatus: string;
  /** The deadline that was exhausted, in milliseconds. */
  readonly timeoutMs: number;

  constructor(details: {
    resource: WaiterResource;
    resourceId: string;
    target: string;
    lastStatus: string;
    timeoutMs: number;
  }) {
    super(
      `Timed out after ${details.timeoutMs}ms waiting for ${details.resource} ` +
        `${details.resourceId} to reach "${details.target}" (last status: "${details.lastStatus}")`,
    );
    this.name = 'WaiterTimeoutError';
    this.resource = details.resource;
    this.resourceId = details.resourceId;
    this.target = details.target;
    this.lastStatus = details.lastStatus;
    this.timeoutMs = details.timeoutMs;
  }
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('This operation was aborted', 'AbortError');
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw abortReason(signal);
}

/** A `setTimeout` sleep that rejects (and clears the timer) on abort. */
function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
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

/** Everything a concrete waiter needs from its lifecycle. */
interface WaitSpec<T> {
  resource: WaiterResource;
  resourceId: string;
  /** The status being waited for (for error messages). */
  target: string;
  /** One status read (the resource's GET endpoint). */
  poll: () => Promise<T>;
  statusOf: (value: T) => string;
  reasonOf?: (value: T) => string | undefined;
  /** Statuses the lifecycle can never leave on its own → fail fast. */
  failureStatuses: ReadonlySet<string>;
  defaultTimeoutMs: number;
}

/**
 * The shared polling loop: poll immediately, then sleep with multiplicative
 * backoff between polls. The final sleep is clamped to the deadline so one
 * last poll always lands at (not past) it.
 */
async function waitForStatus<T>(spec: WaitSpec<T>, options: WaiterOptions): Promise<T> {
  const timeoutMs = options.timeoutMs ?? spec.defaultTimeoutMs;
  const maxIntervalMs = options.maxPollIntervalMs ?? DEFAULT_MAX_POLL_INTERVAL_MS;
  let intervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const signal = options.signal;
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    throwIfAborted(signal);
    const value = await spec.poll();
    const status = spec.statusOf(value);
    if (status === spec.target) return value;
    if (spec.failureStatuses.has(status)) {
      throw new WaiterStateError({
        resource: spec.resource,
        resourceId: spec.resourceId,
        status,
        target: spec.target,
        statusReason: spec.reasonOf?.(value),
      });
    }
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      throw new WaiterTimeoutError({
        resource: spec.resource,
        resourceId: spec.resourceId,
        target: spec.target,
        lastStatus: status,
        timeoutMs,
      });
    }
    await sleep(Math.min(intervalMs, remainingMs), signal);
    intervalMs = Math.min(intervalMs * POLL_BACKOFF_FACTOR, maxIntervalMs);
  }
}

function requestOptions(signal: AbortSignal | undefined): RequestOptions {
  return signal === undefined ? {} : { signal };
}

/**
 * Poll `getEnvironment` until the box is `running`.
 *
 * Transitional statuses (`pending`, `provisioning`) keep polling. Statuses
 * the box cannot leave on its own from the waiter's point of view —
 * `stopping`, `stopped`, `terminating`, `terminated`, `failed` — throw a
 * {@link WaiterStateError} immediately. (A `stopped` observation usually
 * means auto-sleep or another actor stopped the box; call
 * `environments.start()` and wait again.)
 *
 * Note that auto-sleep means a resolved waiter is a statement about *now*,
 * not forever — see the module docs.
 *
 * @returns the final `Environment` (status `running`).
 */
export function waitUntilEnvironmentReady(
  client: APIRequester,
  args: ArgsOf<'getEnvironment'>,
  options: WaiterOptions = {},
): Promise<Environment> {
  return waitForStatus<Environment>(
    {
      resource: 'environment',
      resourceId: args.envId,
      target: 'running' satisfies EnvironmentStatus,
      poll: () => client.call('getEnvironment', args, requestOptions(options.signal)),
      statusOf: (env) => env.status,
      reasonOf: (env) => env.statusReason,
      failureStatuses: new Set<EnvironmentStatus>([
        'stopping',
        'stopped',
        'terminating',
        'terminated',
        'failed',
      ]),
      defaultTimeoutMs: DEFAULT_ENVIRONMENT_TIMEOUT_MS,
    },
    options,
  );
}

/**
 * Poll `getEnvironment` until the box is `stopped`.
 *
 * `stopping` is the expected transitional status; `pending`, `provisioning`
 * and `running` are tolerated too (a stop request races with the live-state
 * refresh, and auto-sleep can stop a box that is still settling). `failed`,
 * `terminating` and `terminated` throw a {@link WaiterStateError} immediately
 * — a terminated box will never be `stopped`.
 *
 * @returns the final `Environment` (status `stopped`).
 */
export function waitUntilEnvironmentStopped(
  client: APIRequester,
  args: ArgsOf<'getEnvironment'>,
  options: WaiterOptions = {},
): Promise<Environment> {
  return waitForStatus<Environment>(
    {
      resource: 'environment',
      resourceId: args.envId,
      target: 'stopped' satisfies EnvironmentStatus,
      poll: () => client.call('getEnvironment', args, requestOptions(options.signal)),
      statusOf: (env) => env.status,
      reasonOf: (env) => env.statusReason,
      failureStatuses: new Set<EnvironmentStatus>(['terminating', 'terminated', 'failed']),
      defaultTimeoutMs: DEFAULT_ENVIRONMENT_TIMEOUT_MS,
    },
    options,
  );
}

/**
 * Poll `getTemplate` until the template's runtime bundle is baked
 * (status `ready`).
 *
 * `bundle_building` keeps polling. `bundle_failed` throws a
 * {@link WaiterStateError} immediately — fix the underlying issue and call
 * `templates.rebake()`. `draft` also fails fast: a draft has no bake in
 * flight, so waiting on it would only ever time out (publish the template
 * first).
 *
 * Until a template is `ready`, `environments.launch` rejects with a 409
 * (`template_not_baked`) — this waiter is the "safe launch" gate after
 * `templates.create` / `templates.rebake`.
 *
 * @returns the final `TemplateWithChildren` (`template.status === 'ready'`).
 */
export function waitUntilTemplateBaked(
  client: APIRequester,
  args: ArgsOf<'getTemplate'>,
  options: WaiterOptions = {},
): Promise<TemplateWithChildren> {
  return waitForStatus<TemplateWithChildren>(
    {
      resource: 'template',
      resourceId: args.templateId,
      target: 'ready' satisfies TemplateStatus,
      poll: () => client.call('getTemplate', args, requestOptions(options.signal)),
      statusOf: (result) => result.template.status,
      failureStatuses: new Set<TemplateStatus>(['draft', 'bundle_failed']),
      defaultTimeoutMs: DEFAULT_BAKE_TIMEOUT_MS,
    },
    options,
  );
}

/**
 * Generate an `Idempotency-Key` value. Uses `crypto.randomUUID()` where the
 * WebCrypto global exists (Node 19+, workers, browsers, Deno, Bun) with a
 * `Math.random`-based RFC 4122 v4 fallback for Node 18, where the `crypto`
 * global is not exposed by default (no `node:` imports in this package).
 * Idempotency keys only need uniqueness, not cryptographic strength.
 */
function generateIdempotencyKey(): string {
  const webCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof webCrypto?.randomUUID === 'function') return webCrypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.trunc(Math.random() * 16);
    const v = c === 'x' ? r : (r % 4) + 8;
    return v.toString(16);
  });
}

/**
 * Safe launch: `launchEnvironment` + {@link waitUntilEnvironmentReady}.
 *
 * The launch POST **always** carries an `Idempotency-Key` header — the one in
 * `options.idempotencyKey`, or a generated `crypto.randomUUID()` value. That
 * makes the launch replay-safe (a retried launch with the same key returns
 * the original box, never a duplicate) and is exactly the condition under
 * which the SDK's retry middleware (SLO-133) will retry a POST after a
 * transient failure. Pass your own stable key to deduplicate across process
 * restarts.
 *
 * The waiter half polls under the same pacing/timeout rules as
 * {@link waitUntilEnvironmentReady}; `options.signal` aborts whichever half
 * is in flight.
 *
 * @returns the launched `Environment` once it reaches `running`.
 */
export async function launchEnvironmentAndWait(
  client: APIRequester,
  args: ArgsOf<'launchEnvironment'>,
  options: LaunchAndWaitOptions = {},
): Promise<Environment> {
  const { idempotencyKey, ...waiterOptions } = options;
  const launched = await client.call('launchEnvironment', args, {
    ...requestOptions(waiterOptions.signal),
    headers: { 'Idempotency-Key': idempotencyKey ?? generateIdempotencyKey() },
  });
  return waitUntilEnvironmentReady(
    client,
    { orgId: args.orgId, envId: launched.envId },
    waiterOptions,
  );
}
