import type {
  APIRequester,
  ArgsOf,
  IdempotentRequestOptions,
  RequestOptions,
  ResultOf,
} from '../core.js';
import {
  launchEnvironmentAndWait,
  waitUntilEnvironmentReady,
  waitUntilEnvironmentStopped,
  type LaunchAndWaitOptions,
  type WaiterOptions,
} from '../waiters.js';

/**
 * Environments ("boxes") — launch, lifecycle, metrics, and the org's
 * auto-sleep policy. Method names derive from the spec's `operationId`s with
 * the resource noun dropped (`launchEnvironment` → `launch`).
 */
export class Environments {
  readonly #client: APIRequester;

  constructor(client: APIRequester) {
    this.#client = client;
  }

  /** `listEnvironments` — GET /organizations/{orgId}/environments */
  list(args: ArgsOf<'listEnvironments'>, options?: RequestOptions): Promise<ResultOf<'listEnvironments'>> {
    return this.#client.call('listEnvironments', args, options);
  }

  /**
   * `launchEnvironment` — POST /organizations/{orgId}/environments
   *
   * Accepts an optional `idempotencyKey` (sent as the `Idempotency-Key`
   * header): retrying a launch with the same key returns the original box
   * instead of starting a duplicate.
   */
  launch(args: ArgsOf<'launchEnvironment'>, options?: IdempotentRequestOptions): Promise<ResultOf<'launchEnvironment'>> {
    const { idempotencyKey, ...rest } = options ?? {};
    return this.#client.call(
      'launchEnvironment',
      args,
      idempotencyKey === undefined
        ? rest
        : { ...rest, headers: { 'Idempotency-Key': idempotencyKey, ...rest.headers } },
    );
  }

  /** `getEnvironment` — GET /organizations/{orgId}/environments/{envId} */
  get(args: ArgsOf<'getEnvironment'>, options?: RequestOptions): Promise<ResultOf<'getEnvironment'>> {
    return this.#client.call('getEnvironment', args, options);
  }

  /** `stopEnvironment` — POST /organizations/{orgId}/environments/{envId}/stop */
  stop(args: ArgsOf<'stopEnvironment'>, options?: RequestOptions): Promise<ResultOf<'stopEnvironment'>> {
    return this.#client.call('stopEnvironment', args, options);
  }

  /** `startEnvironment` — POST /organizations/{orgId}/environments/{envId}/start */
  start(args: ArgsOf<'startEnvironment'>, options?: RequestOptions): Promise<ResultOf<'startEnvironment'>> {
    return this.#client.call('startEnvironment', args, options);
  }

  /** `terminateEnvironment` — DELETE /organizations/{orgId}/environments/{envId} */
  terminate(args: ArgsOf<'terminateEnvironment'>, options?: RequestOptions): Promise<ResultOf<'terminateEnvironment'>> {
    return this.#client.call('terminateEnvironment', args, options);
  }

  /** `getEnvironmentMetrics` — GET /organizations/{orgId}/environments/{envId}/metrics */
  getMetrics(args: ArgsOf<'getEnvironmentMetrics'>, options?: RequestOptions): Promise<ResultOf<'getEnvironmentMetrics'>> {
    return this.#client.call('getEnvironmentMetrics', args, options);
  }

  /** `getAutoSleepPolicy` — GET /organizations/{orgId}/auto-sleep */
  getAutoSleepPolicy(args: ArgsOf<'getAutoSleepPolicy'>, options?: RequestOptions): Promise<ResultOf<'getAutoSleepPolicy'>> {
    return this.#client.call('getAutoSleepPolicy', args, options);
  }

  /** `setAutoSleepPolicy` — PUT /organizations/{orgId}/auto-sleep */
  setAutoSleepPolicy(args: ArgsOf<'setAutoSleepPolicy'>, options?: RequestOptions): Promise<ResultOf<'setAutoSleepPolicy'>> {
    return this.#client.call('setAutoSleepPolicy', args, options);
  }

  /** `setTemplateAutoSleep` — PUT /organizations/{orgId}/templates/{templateId}/auto-sleep */
  setTemplateAutoSleep(args: ArgsOf<'setTemplateAutoSleep'>, options?: RequestOptions): Promise<ResultOf<'setTemplateAutoSleep'>> {
    return this.#client.call('setTemplateAutoSleep', args, options);
  }

  /**
   * Poll `getEnvironment` until the box is `running` (SLO-135 waiter).
   * Terminal statuses (`failed`, `terminated`, …) throw `WaiterStateError`
   * immediately; the overall deadline throws `WaiterTimeoutError`.
   *
   * Auto-sleep caveat: a ready box can later be stopped by the org's idle /
   * scheduled auto-sleep policy — "ready once" is not "running forever". See
   * the `waiters` module docs.
   */
  waitUntilReady(args: ArgsOf<'getEnvironment'>, options?: WaiterOptions): Promise<ResultOf<'getEnvironment'>> {
    return waitUntilEnvironmentReady(this.#client, args, options);
  }

  /** Poll `getEnvironment` until the box is `stopped` (SLO-135 waiter). */
  waitUntilStopped(args: ArgsOf<'getEnvironment'>, options?: WaiterOptions): Promise<ResultOf<'getEnvironment'>> {
    return waitUntilEnvironmentStopped(this.#client, args, options);
  }

  /**
   * Safe launch: `launch` + `waitUntilReady` (SLO-135). Always sends an
   * `Idempotency-Key` (auto-generated via `crypto.randomUUID()` when
   * `options.idempotencyKey` is omitted), which is what makes the launch POST
   * retry-safe — and eligible for the SDK retry middleware (SLO-133), which
   * only retries POSTs that carry an idempotency key.
   */
  launchAndWait(args: ArgsOf<'launchEnvironment'>, options?: LaunchAndWaitOptions): Promise<ResultOf<'getEnvironment'>> {
    return launchEnvironmentAndWait(this.#client, args, options);
  }
}
