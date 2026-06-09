import type { APIRequester, ArgsOf, RequestOptions, ResultOf } from '../core.js';

/**
 * Org secrets & environment variables (scoped env-config), the secrets
 * backend settings, and the repo registry the `repo` scope binds to.
 */
export class Secrets {
  readonly #client: APIRequester;

  constructor(client: APIRequester) {
    this.#client = client;
  }

  /** `listEnvConfig` — GET /organizations/{orgId}/env-config */
  listEnvConfig(args: ArgsOf<'listEnvConfig'>, options?: RequestOptions): Promise<ResultOf<'listEnvConfig'>> {
    return this.#client.call('listEnvConfig', args, options);
  }

  /** `upsertEnvConfig` — PUT /organizations/{orgId}/env-config/{key} */
  upsertEnvConfig(args: ArgsOf<'upsertEnvConfig'>, options?: RequestOptions): Promise<ResultOf<'upsertEnvConfig'>> {
    return this.#client.call('upsertEnvConfig', args, options);
  }

  /** `deleteEnvConfig` — DELETE /organizations/{orgId}/env-config/{key} */
  deleteEnvConfig(args: ArgsOf<'deleteEnvConfig'>, options?: RequestOptions): Promise<ResultOf<'deleteEnvConfig'>> {
    return this.#client.call('deleteEnvConfig', args, options);
  }

  /** `setSecretsConfig` — PUT /organizations/{orgId}/secrets-settings */
  setConfig(args: ArgsOf<'setSecretsConfig'>, options?: RequestOptions): Promise<ResultOf<'setSecretsConfig'>> {
    return this.#client.call('setSecretsConfig', args, options);
  }

  /** `listOrgRepos` — GET /organizations/{orgId}/repos */
  listOrgRepos(args: ArgsOf<'listOrgRepos'>, options?: RequestOptions): Promise<ResultOf<'listOrgRepos'>> {
    return this.#client.call('listOrgRepos', args, options);
  }
}
