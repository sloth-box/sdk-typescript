import type { APIRequester, ArgsOf, RequestOptions, ResultOf } from '../core.js';

/**
 * Private-registry credentials — used by custom template services to pull
 * images from non-public registries (a `token` credential's secret lives in
 * the org's own AWS account; `ecr` credentials use the box's instance role).
 */
export class RegistryCredentials {
  readonly #client: APIRequester;

  constructor(client: APIRequester) {
    this.#client = client;
  }

  /** `listRegistryCredentials` — GET /organizations/{orgId}/registry-credentials */
  list(args: ArgsOf<'listRegistryCredentials'>, options?: RequestOptions): Promise<ResultOf<'listRegistryCredentials'>> {
    return this.#client.call('listRegistryCredentials', args, options);
  }

  /** `createRegistryCredential` — POST /organizations/{orgId}/registry-credentials */
  create(args: ArgsOf<'createRegistryCredential'>, options?: RequestOptions): Promise<ResultOf<'createRegistryCredential'>> {
    return this.#client.call('createRegistryCredential', args, options);
  }

  /**
   * `deleteRegistryCredential` — DELETE /organizations/{orgId}/registry-credentials/{credentialId}
   *
   * Resolves to `undefined` on the plain delete (204). A force-delete
   * (`?force=true`, via the raw `request` escape hatch) returns 200 with the
   * affected-templates report; templates still referencing the credential
   * otherwise make the API reject with a 409 `ConflictError`.
   */
  delete(args: ArgsOf<'deleteRegistryCredential'>, options?: RequestOptions): Promise<ResultOf<'deleteRegistryCredential'>> {
    return this.#client.call('deleteRegistryCredential', args, options);
  }
}
