/**
 * @slothbox/sdk — Official TypeScript SDK for the Slothbox API.
 *
 * ```ts
 * import { Slothbox } from '@slothbox/sdk';
 *
 * const slothbox = new Slothbox(); // reads SLOTHBOX_API_KEY
 * const { environments } = await slothbox.environments.list({ orgId });
 * ```
 */

export * from './webhooks.js';

/**
 * The version of this package. Kept in sync with `package.json` (enforced by
 * a unit test).
 */
export const VERSION = '0.1.0';

// Client
export { DEFAULT_BASE_URL, Slothbox } from './client.js';
export type { FetchLike, RawRequestOptions, SlothboxOptions } from './client.js';

/** @deprecated Renamed — use {@link Slothbox}. */
export { Slothbox as SlothboxClient } from './client.js';
/** @deprecated Renamed — use {@link SlothboxOptions}. */
export type { SlothboxOptions as SlothboxClientOptions } from './client.js';

// Per-request options & operation-keyed helper types
export type {
  ArgsOf,
  BodyOf,
  IdempotentRequestOptions,
  OperationId,
  RequestOptions,
  ResultOf,
} from './core.js';

// Errors
export {
  APIConnectionError,
  APIError,
  AuthenticationError,
  BadRequestError,
  ConflictError,
  NotFoundError,
  PermissionDeniedError,
  PlanRequiredError,
  RateLimitError,
  SlothboxError,
} from './errors.js';
export type { APIErrorDetails, SlothboxErrorCode } from './errors.js';

// Pagination
export { CursorPage } from './pagination.js';

// Retry & rate-limit middleware (SLO-133)
export {
  DEFAULT_MAX_RETRIES,
  DEFAULT_RETRY_BASE_DELAY_MS,
  DEFAULT_RETRY_MAX_DELAY_MS,
} from './retry.js';
export type { RetryContext } from './retry.js';

// Generated OpenAPI types (schemas under `components['schemas']`)
export type { components, operations, paths } from './generated/api.js';
