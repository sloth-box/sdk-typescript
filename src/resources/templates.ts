import type { APIRequester, ArgsOf, RequestOptions, ResultOf } from '../core.js';

/** Environment templates — CRUD plus AMI rebake. */
export class Templates {
  readonly #client: APIRequester;

  constructor(client: APIRequester) {
    this.#client = client;
  }

  /** `listTemplates` — GET /organizations/{orgId}/templates */
  list(args: ArgsOf<'listTemplates'>, options?: RequestOptions): Promise<ResultOf<'listTemplates'>> {
    return this.#client.call('listTemplates', args, options);
  }

  /** `createTemplate` — POST /organizations/{orgId}/templates */
  create(args: ArgsOf<'createTemplate'>, options?: RequestOptions): Promise<ResultOf<'createTemplate'>> {
    return this.#client.call('createTemplate', args, options);
  }

  /** `getTemplate` — GET /organizations/{orgId}/templates/{templateId} */
  get(args: ArgsOf<'getTemplate'>, options?: RequestOptions): Promise<ResultOf<'getTemplate'>> {
    return this.#client.call('getTemplate', args, options);
  }

  /** `replaceTemplate` — PATCH /organizations/{orgId}/templates/{templateId} */
  replace(args: ArgsOf<'replaceTemplate'>, options?: RequestOptions): Promise<ResultOf<'replaceTemplate'>> {
    return this.#client.call('replaceTemplate', args, options);
  }

  /** `deleteTemplate` — DELETE /organizations/{orgId}/templates/{templateId} */
  delete(args: ArgsOf<'deleteTemplate'>, options?: RequestOptions): Promise<ResultOf<'deleteTemplate'>> {
    return this.#client.call('deleteTemplate', args, options);
  }

  /** `rebakeTemplate` — POST /organizations/{orgId}/templates/{templateId}/rebake */
  rebake(args: ArgsOf<'rebakeTemplate'>, options?: RequestOptions): Promise<ResultOf<'rebakeTemplate'>> {
    return this.#client.call('rebakeTemplate', args, options);
  }
}
