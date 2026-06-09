import type { APIRequester, ArgsOf, RequestOptions, ResultOf } from '../core.js';

/** Billing — the org's seat/plan summary. */
export class Billing {
  readonly #client: APIRequester;

  constructor(client: APIRequester) {
    this.#client = client;
  }

  /** `getBillingSummary` — GET /organizations/{orgId}/billing */
  getSummary(args: ArgsOf<'getBillingSummary'>, options?: RequestOptions): Promise<ResultOf<'getBillingSummary'>> {
    return this.#client.call('getBillingSummary', args, options);
  }
}

/** Catalog — the supported services and language runtimes. */
export class Catalog {
  readonly #client: APIRequester;

  constructor(client: APIRequester) {
    this.#client = client;
  }

  /** `listCatalogServices` — GET /catalog/services */
  listServices(args?: ArgsOf<'listCatalogServices'>, options?: RequestOptions): Promise<ResultOf<'listCatalogServices'>> {
    return this.#client.call('listCatalogServices', args, options);
  }

  /** `listCatalogRuntimes` — GET /catalog/runtimes */
  listRuntimes(args?: ArgsOf<'listCatalogRuntimes'>, options?: RequestOptions): Promise<ResultOf<'listCatalogRuntimes'>> {
    return this.#client.call('listCatalogRuntimes', args, options);
  }
}

/**
 * The caller's own third-party connections (GitHub, Linear, …) across the
 * providers Slothbox integrates with. Connections are user-private.
 */
export class Connections {
  readonly #client: APIRequester;

  constructor(client: APIRequester) {
    this.#client = client;
  }

  /** `listMyConnections` — GET /me/connections */
  list(args?: ArgsOf<'listMyConnections'>, options?: RequestOptions): Promise<ResultOf<'listMyConnections'>> {
    return this.#client.call('listMyConnections', args, options);
  }
}

/** The caller's GitHub account link. */
export class GitHub {
  readonly #client: APIRequester;

  constructor(client: APIRequester) {
    this.#client = client;
  }

  /** `getGithubLink` — GET /me/github */
  getLink(args?: ArgsOf<'getGithubLink'>, options?: RequestOptions): Promise<ResultOf<'getGithubLink'>> {
    return this.#client.call('getGithubLink', args, options);
  }
}

/** The authenticated caller and their org memberships. */
export class Me {
  readonly #client: APIRequester;

  constructor(client: APIRequester) {
    this.#client = client;
  }

  /** `getMe` — GET /me */
  get(args?: ArgsOf<'getMe'>, options?: RequestOptions): Promise<ResultOf<'getMe'>> {
    return this.#client.call('getMe', args, options);
  }
}

/** API health check. */
export class Health {
  readonly #client: APIRequester;

  constructor(client: APIRequester) {
    this.#client = client;
  }

  /** `getHealth` — GET /hello */
  get(args?: ArgsOf<'getHealth'>, options?: RequestOptions): Promise<ResultOf<'getHealth'>> {
    return this.#client.call('getHealth', args, options);
  }
}
