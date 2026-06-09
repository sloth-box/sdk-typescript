import type { APIRequester, ArgsOf, RequestOptions, ResultOf } from '../core.js';

/** Runtime bundles — baked AMI bundles and their bake event streams. */
export class RuntimeBundles {
  readonly #client: APIRequester;

  constructor(client: APIRequester) {
    this.#client = client;
  }

  /** `listRuntimeBundles` — GET /organizations/{orgId}/runtime-bundles */
  list(args: ArgsOf<'listRuntimeBundles'>, options?: RequestOptions): Promise<ResultOf<'listRuntimeBundles'>> {
    return this.#client.call('listRuntimeBundles', args, options);
  }

  /** `listBakeEvents` — GET /organizations/{orgId}/runtime-bundles/{hash}/events */
  listBakeEvents(args: ArgsOf<'listBakeEvents'>, options?: RequestOptions): Promise<ResultOf<'listBakeEvents'>> {
    return this.#client.call('listBakeEvents', args, options);
  }
}
