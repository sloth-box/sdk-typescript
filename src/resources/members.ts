import type { APIRequester, ArgsOf, RequestOptions, ResultOf } from '../core.js';

/**
 * Organization members — membership, permissions, and this-org connection
 * bindings. (A member's connections in *other* orgs are private and never
 * visible here.)
 */
export class Members {
  readonly #client: APIRequester;

  constructor(client: APIRequester) {
    this.#client = client;
  }

  /** `listMembers` — GET /organizations/{orgId}/members */
  list(args: ArgsOf<'listMembers'>, options?: RequestOptions): Promise<ResultOf<'listMembers'>> {
    return this.#client.call('listMembers', args, options);
  }

  /** `removeMember` — DELETE /organizations/{orgId}/members/{userId} */
  remove(args: ArgsOf<'removeMember'>, options?: RequestOptions): Promise<ResultOf<'removeMember'>> {
    return this.#client.call('removeMember', args, options);
  }

  /** `setMemberPermissions` — PATCH /organizations/{orgId}/members/{userId} */
  setPermissions(args: ArgsOf<'setMemberPermissions'>, options?: RequestOptions): Promise<ResultOf<'setMemberPermissions'>> {
    return this.#client.call('setMemberPermissions', args, options);
  }

  /** `listMemberConnections` — GET /organizations/{orgId}/members/{userId}/connections */
  listConnections(args: ArgsOf<'listMemberConnections'>, options?: RequestOptions): Promise<ResultOf<'listMemberConnections'>> {
    return this.#client.call('listMemberConnections', args, options);
  }

  /** `setMemberConnection` — PUT /organizations/{orgId}/members/{userId}/connections/{provider} */
  setConnection(args: ArgsOf<'setMemberConnection'>, options?: RequestOptions): Promise<ResultOf<'setMemberConnection'>> {
    return this.#client.call('setMemberConnection', args, options);
  }

  /** `clearMemberConnection` — DELETE /organizations/{orgId}/members/{userId}/connections/{provider} */
  clearConnection(args: ArgsOf<'clearMemberConnection'>, options?: RequestOptions): Promise<ResultOf<'clearMemberConnection'>> {
    return this.#client.call('clearMemberConnection', args, options);
  }
}
