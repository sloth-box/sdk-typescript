/**
 * @slothbox/sdk — Official TypeScript SDK for the Slothbox API.
 *
 * This package is a scaffold (SLO-124). The real client runtime lands in
 * SLO-127; until then everything here is a placeholder and the package is
 * not published to npm.
 */

/**
 * The version of this package. Kept in sync with `package.json` (enforced by
 * a unit test).
 */
export const VERSION = '0.1.0';

/** Options accepted by {@link SlothboxClient}. */
export interface SlothboxClientOptions {
  /**
   * Slothbox API key (`sk_...`). Create one in the Slothbox dashboard.
   * Sent verbatim in the `Authorization` header — no `Bearer ` prefix.
   */
  apiKey: string;
  /**
   * Base URL of the Slothbox API.
   * @default "https://api.slothbox.dev"
   */
  baseUrl?: string;
}

/**
 * Client for the Slothbox API.
 *
 * **NOT YET IMPLEMENTED.** This is a placeholder so the package shape, build,
 * and typings can be validated ahead of the real runtime (SLO-127). Every
 * method throws until then. The implementation will use the global `fetch`
 * available in Node 18+, Cloudflare Workers, Deno, Bun, and browsers — no
 * runtime dependencies.
 */
export class SlothboxClient {
  readonly baseUrl: string;
  readonly #apiKey: string;

  constructor(options: SlothboxClientOptions) {
    if (!options?.apiKey) {
      throw new Error('SlothboxClient requires an apiKey');
    }
    this.#apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? 'https://api.slothbox.dev';
  }

  /**
   * Placeholder. The request layer ships in SLO-127.
   * @throws Always.
   */
  request(): never {
    // Reference the key so the stub carries the same private state the real
    // client will, without tripping noUnusedLocals-style checks later.
    void this.#apiKey;
    throw new Error(
      '@slothbox/sdk is not implemented yet — this is a scaffold (SLO-124). ' +
        'The client runtime arrives in SLO-127.',
    );
  }
}
