import type { APIRequester, ArgsOf, RequestOptions, ResultOf } from '../core.js';

/** Organization invites — create/revoke (owner) and preview/accept (invitee). */
export class Invites {
  readonly #client: APIRequester;

  constructor(client: APIRequester) {
    this.#client = client;
  }

  /** `listInvites` — GET /organizations/{orgId}/invites */
  list(args: ArgsOf<'listInvites'>, options?: RequestOptions): Promise<ResultOf<'listInvites'>> {
    return this.#client.call('listInvites', args, options);
  }

  /** `createInvite` — POST /organizations/{orgId}/invites */
  create(args: ArgsOf<'createInvite'>, options?: RequestOptions): Promise<ResultOf<'createInvite'>> {
    return this.#client.call('createInvite', args, options);
  }

  /** `previewInvite` — GET /invites/{token} */
  preview(args: ArgsOf<'previewInvite'>, options?: RequestOptions): Promise<ResultOf<'previewInvite'>> {
    return this.#client.call('previewInvite', args, options);
  }

  /** `acceptInvite` — POST /invites/{token}/accept */
  accept(args: ArgsOf<'acceptInvite'>, options?: RequestOptions): Promise<ResultOf<'acceptInvite'>> {
    return this.#client.call('acceptInvite', args, options);
  }

  /** `revokeInvite` — DELETE /organizations/{orgId}/invites/{token} */
  revoke(args: ArgsOf<'revokeInvite'>, options?: RequestOptions): Promise<ResultOf<'revokeInvite'>> {
    return this.#client.call('revokeInvite', args, options);
  }
}
