/**
 * The Slothbox API client.
 *
 * ```ts
 * import { Slothbox } from '@slothbox/sdk';
 *
 * const slothbox = new Slothbox({ apiKey: 'sk_…' }); // or SLOTHBOX_API_KEY
 * const { environments } = await slothbox.environments.list({ orgId });
 * ```
 *
 * Runs anywhere a WHATWG `fetch` global exists (Node 18+, Cloudflare Workers,
 * Deno, Bun, browsers) — zero runtime dependencies, no `node:` imports.
 */

import {
  endpoints,
  type APIRequester,
  type ArgsOf,
  type HttpMethod,
  type ItemsFieldOf,
  type OperationId,
  type PageOf,
  type RequestOptions,
  type ResultOf,
} from './core.js';
import { APIConnectionError, SlothboxError, errorFromResponse } from './errors.js';
import { CursorPage } from './pagination.js';
import {
  DEFAULT_MAX_RETRIES,
  assertValidMaxRetries,
  canRetryRequest,
  withRetries,
} from './retry.js';
import { Audit } from './resources/audit.js';
import { AwsConnections } from './resources/aws-connections.js';
import { Environments } from './resources/environments.js';
import { Invites } from './resources/invites.js';
import { Members } from './resources/members.js';
import { Billing, Catalog, Connections, GitHub, Health, Me } from './resources/misc.js';
import { Organizations } from './resources/organizations.js';
import { RuntimeBundles } from './resources/runtime-bundles.js';
import { Secrets } from './resources/secrets.js';
import { SshKeys } from './resources/ssh-keys.js';
import { Templates } from './resources/templates.js';
import { Webhooks } from './resources/webhooks.js';

/** Default base URL — the spec's `servers` entry. */
export const DEFAULT_BASE_URL = 'https://api.slothbox.dev';

/**
 * A `fetch`-compatible function. The global `fetch` satisfies this; pass your
 * own to add middleware, proxying, or for testing.
 */
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/** Constructor options for {@link Slothbox}. */
export interface SlothboxOptions {
  /**
   * Slothbox API key (`sk_…`). Create one in the Slothbox dashboard. Falls
   * back to the `SLOTHBOX_API_KEY` environment variable (in runtimes that
   * expose a Node-style `process.env`).
   *
   * Sent as-is in the `Authorization` header — the API accepts the raw key
   * with or without a `Bearer ` prefix, so no prefix is added.
   */
  apiKey?: string;
  /**
   * Base URL of the Slothbox API.
   * @default "https://api.slothbox.dev"
   */
  baseUrl?: string;
  /** Custom `fetch` implementation. Defaults to the global `fetch`. */
  fetch?: FetchLike;
  /**
   * Maximum number of automatic retries after a request's initial attempt
   * (so `maxRetries: 3` allows up to 4 attempts). Set 0 to disable retries.
   * Overridable per request via `options.maxRetries`. Retries apply to
   * GET/HEAD/PUT/DELETE on 429s, 5xx responses, and network errors, with
   * capped full-jitter exponential backoff honoring `Retry-After` — POSTs
   * are never retried without an `Idempotency-Key` (see `src/retry.ts`).
   * @default 3
   */
  maxRetries?: number;
}

/** Options for the low-level {@link Slothbox.request} escape hatch. */
export interface RawRequestOptions extends RequestOptions {
  /** Values for `{placeholder}` segments in the path (URL-encoded for you). */
  pathParams?: Record<string, string | number>;
  /** Query parameters; `undefined`/`null` entries are skipped. */
  query?: Record<string, unknown>;
  /** JSON request body. */
  body?: unknown;
}

/** Read `SLOTHBOX_API_KEY` without assuming a Node runtime. */
function apiKeyFromEnv(): string | undefined {
  try {
    const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } })
      .process;
    return proc?.env?.SLOTHBOX_API_KEY;
  } catch {
    return undefined;
  }
}

/** Substitute `{name}` placeholders, URL-encoding the values. */
function interpolatePath(template: string, params: Record<string, unknown>): string {
  return template.replace(/\{([^{}]+)\}/g, (_match, name: string) => {
    const value = params[name];
    if (value === undefined || value === null) {
      throw new SlothboxError(`Missing required path parameter "${name}" for ${template}`);
    }
    return encodeURIComponent(String(value));
  });
}

/** `?a=1&b=2` (or `''`), skipping `undefined`/`null` values. */
function serializeQuery(query: Record<string, unknown> | undefined): string {
  if (!query) return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    search.append(key, String(value));
  }
  const serialized = search.toString();
  return serialized === '' ? '' : `?${serialized}`;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

/**
 * Client for the Slothbox API.
 *
 * Operations are grouped by resource family and named after the spec's
 * `operationId`s: `slothbox.environments.launch(…)`,
 * `slothbox.webhooks.rollSecret(…)`, `slothbox.templates.rebake(…)`, ….
 * Params and responses are typed end-to-end from the generated OpenAPI types.
 */
export class Slothbox implements APIRequester {
  /** Base URL requests are sent to (no trailing slash). */
  readonly baseUrl: string;

  readonly #apiKey: string;
  readonly #fetch: FetchLike | undefined;
  readonly #maxRetries: number;

  readonly audit: Audit;
  readonly awsConnections: AwsConnections;
  readonly billing: Billing;
  readonly catalog: Catalog;
  readonly connections: Connections;
  readonly environments: Environments;
  readonly github: GitHub;
  readonly health: Health;
  readonly invites: Invites;
  readonly me: Me;
  readonly members: Members;
  readonly organizations: Organizations;
  readonly runtimeBundles: RuntimeBundles;
  readonly secrets: Secrets;
  readonly sshKeys: SshKeys;
  readonly templates: Templates;
  readonly webhooks: Webhooks;

  constructor(options: SlothboxOptions = {}) {
    const apiKey = options.apiKey ?? apiKeyFromEnv();
    if (!apiKey) {
      throw new SlothboxError(
        'Missing Slothbox API key: pass `new Slothbox({ apiKey })` or set the SLOTHBOX_API_KEY environment variable.',
      );
    }
    this.#apiKey = apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.#fetch = options.fetch;
    this.#maxRetries = assertValidMaxRetries(options.maxRetries ?? DEFAULT_MAX_RETRIES);

    this.audit = new Audit(this);
    this.awsConnections = new AwsConnections(this);
    this.billing = new Billing(this);
    this.catalog = new Catalog(this);
    this.connections = new Connections(this);
    this.environments = new Environments(this);
    this.github = new GitHub(this);
    this.health = new Health(this);
    this.invites = new Invites(this);
    this.me = new Me(this);
    this.members = new Members(this);
    this.organizations = new Organizations(this);
    this.runtimeBundles = new RuntimeBundles(this);
    this.secrets = new Secrets(this);
    this.sshKeys = new SshKeys(this);
    this.templates = new Templates(this);
    this.webhooks = new Webhooks(this);
  }

  /**
   * Perform one published operation by `operationId`, fully typed. The
   * resource methods are thin wrappers over this.
   */
  call<K extends OperationId>(
    op: K,
    args?: ArgsOf<K>,
    options?: RequestOptions,
  ): Promise<ResultOf<K>> {
    const [method, template] = endpoints[op];
    const { query, body, ...pathParams } = (args ?? {}) as {
      query?: Record<string, unknown>;
      body?: unknown;
      [key: string]: unknown;
    };
    return this.request(method, template, {
      pathParams: pathParams as Record<string, string>,
      ...(query !== undefined ? { query } : {}),
      ...(body !== undefined ? { body } : {}),
      ...(options?.signal !== undefined ? { signal: options.signal } : {}),
      ...(options?.headers !== undefined ? { headers: options.headers } : {}),
      ...(options?.maxRetries !== undefined ? { maxRetries: options.maxRetries } : {}),
    }) as Promise<ResultOf<K>>;
  }

  /**
   * Perform a cursor-paginated list operation. Resolves to a
   * {@link CursorPage}: the typed page body plus `for await` auto-iteration
   * across pages (the next-page fetches reuse `options`, so an `AbortSignal`
   * also cancels auto-pagination).
   */
  async page<K extends OperationId, F extends ItemsFieldOf<K>>(
    op: K,
    itemsField: F,
    args?: ArgsOf<K>,
    options?: RequestOptions,
  ): Promise<PageOf<K, F>> {
    const data = (await this.call(op, args, options)) as Record<string, unknown> & {
      cursor?: string;
    };
    const items = (data[itemsField] ?? []) as readonly unknown[];
    const fetchNext = (cursor: string) => {
      const previous = (args ?? {}) as { query?: Record<string, unknown> };
      const nextArgs = { ...previous, query: { ...previous.query, cursor } } as ArgsOf<K>;
      return this.page(op, itemsField, nextArgs, options);
    };
    return new CursorPage(data, items, fetchNext) as PageOf<K, F>;
  }

  /**
   * Low-level escape hatch: send a request to any path under {@link baseUrl}
   * with the client's auth and error mapping. Prefer the typed resource
   * methods.
   *
   * JSON responses are parsed; non-JSON responses (e.g. the CloudFormation
   * template YAML) resolve to the raw body string; 204s resolve to
   * `undefined`. Non-2xx responses throw the typed error hierarchy.
   *
   * Retryable requests (idempotent method, or any method carrying an
   * `Idempotency-Key` header) are retried on 429/5xx/network errors per the
   * policy in `src/retry.ts`.
   */
  async request<T = unknown>(
    method: HttpMethod,
    path: string,
    options: RawRequestOptions = {},
  ): Promise<T> {
    const url =
      this.baseUrl + interpolatePath(path, options.pathParams ?? {}) + serializeQuery(options.query);

    const headers = new Headers();
    // The raw key, no `Bearer ` prefix — the API takes the key verbatim and
    // strips an optional prefix itself, so both forms work.
    headers.set('authorization', this.#apiKey);
    const hasBody = options.body !== undefined;
    if (hasBody) headers.set('content-type', 'application/json');
    for (const [name, value] of Object.entries(options.headers ?? {})) {
      headers.set(name, value);
    }

    const fetchImpl = this.#fetch ?? globalThis.fetch;
    if (typeof fetchImpl !== 'function') {
      throw new SlothboxError(
        'No fetch implementation available: this runtime has no global fetch — pass one via `new Slothbox({ fetch })`.',
      );
    }

    const body = hasBody ? JSON.stringify(options.body) : undefined;
    const attempt = async (): Promise<T> => {
      let response: Response;
      try {
        response = await fetchImpl(url, {
          method,
          headers,
          ...(body !== undefined ? { body } : {}),
          signal: options.signal ?? null,
        });
      } catch (error) {
        // Deliberate cancellation is the caller's — re-throw untouched.
        if (isAbortError(error)) throw error;
        const reason = error instanceof Error ? error.message : String(error);
        throw new APIConnectionError(`Request to ${url} failed: ${reason}`, { cause: error });
      }

      if (!response.ok) {
        const raw = await response.text().catch(() => '');
        let parsed: unknown = raw;
        try {
          parsed = raw === '' ? undefined : JSON.parse(raw);
        } catch {
          // not JSON — keep the raw text for the error message fallback
        }
        throw errorFromResponse(response.status, parsed, response.headers);
      }

      if (response.status === 204) return undefined as T;
      const text = await response.text();
      if (text === '') return undefined as T;
      const contentType = response.headers.get('content-type') ?? '';
      if (!/\bjson\b/i.test(contentType)) {
        // The API's only non-JSON success is the CloudFormation template
        // (application/yaml) — surface it as a string, never JSON.parse it.
        return text as T;
      }
      try {
        return JSON.parse(text) as T;
      } catch (error) {
        throw new SlothboxError(`Failed to parse JSON response from ${url}`, { cause: error });
      }
    };

    const maxRetries =
      options.maxRetries === undefined
        ? this.#maxRetries
        : assertValidMaxRetries(options.maxRetries);
    return withRetries(attempt, {
      // The POST rule: a non-idempotent request without an Idempotency-Key
      // header gets 0 retries — a duplicated launch would provision a second
      // EC2 box on the customer's bill.
      maxRetries: canRetryRequest(method, headers) ? maxRetries : 0,
      ...(options.signal !== undefined ? { signal: options.signal } : {}),
    });
  }
}
