import type { APIRequester, ArgsOf, RequestOptions, ResultOf } from '../core.js';

/**
 * Per-org Git SSH keys. Method names derive from the `operationId`s with the
 * shared `GitSshKey` noun dropped (`generateGitSshKey` → `generate`).
 */
export class SshKeys {
  readonly #client: APIRequester;

  constructor(client: APIRequester) {
    this.#client = client;
  }

  /** `getGitSshKey` — GET /organizations/{orgId}/members/{userId}/git-ssh-key */
  get(args: ArgsOf<'getGitSshKey'>, options?: RequestOptions): Promise<ResultOf<'getGitSshKey'>> {
    return this.#client.call('getGitSshKey', args, options);
  }

  /** `generateGitSshKey` — POST /organizations/{orgId}/members/{userId}/git-ssh-key */
  generate(args: ArgsOf<'generateGitSshKey'>, options?: RequestOptions): Promise<ResultOf<'generateGitSshKey'>> {
    return this.#client.call('generateGitSshKey', args, options);
  }

  /** `revokeGitSshKey` — DELETE /organizations/{orgId}/members/{userId}/git-ssh-key */
  revoke(args: ArgsOf<'revokeGitSshKey'>, options?: RequestOptions): Promise<ResultOf<'revokeGitSshKey'>> {
    return this.#client.call('revokeGitSshKey', args, options);
  }
}
