import type { APIRequester, ArgsOf, RequestOptions, ResultOf } from '../core.js';

/** Organizations — CRUD and ownership transfer. */
export class Organizations {
  readonly #client: APIRequester;

  constructor(client: APIRequester) {
    this.#client = client;
  }

  /** `listOrganizations` — GET /organizations */
  list(args?: ArgsOf<'listOrganizations'>, options?: RequestOptions): Promise<ResultOf<'listOrganizations'>> {
    return this.#client.call('listOrganizations', args, options);
  }

  /** `createOrganization` — POST /organizations */
  create(args?: ArgsOf<'createOrganization'>, options?: RequestOptions): Promise<ResultOf<'createOrganization'>> {
    return this.#client.call('createOrganization', args, options);
  }

  /** `getOrganization` — GET /organizations/{orgId} */
  get(args: ArgsOf<'getOrganization'>, options?: RequestOptions): Promise<ResultOf<'getOrganization'>> {
    return this.#client.call('getOrganization', args, options);
  }

  /** `updateOrganization` — PATCH /organizations/{orgId} */
  update(args: ArgsOf<'updateOrganization'>, options?: RequestOptions): Promise<ResultOf<'updateOrganization'>> {
    return this.#client.call('updateOrganization', args, options);
  }

  /** `deleteOrganization` — DELETE /organizations/{orgId} */
  delete(args: ArgsOf<'deleteOrganization'>, options?: RequestOptions): Promise<ResultOf<'deleteOrganization'>> {
    return this.#client.call('deleteOrganization', args, options);
  }

  /** `transferOwnership` — POST /organizations/{orgId}/transfer-ownership */
  transferOwnership(args: ArgsOf<'transferOwnership'>, options?: RequestOptions): Promise<ResultOf<'transferOwnership'>> {
    return this.#client.call('transferOwnership', args, options);
  }
}
