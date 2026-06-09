/**
 * Typed error hierarchy for the Slothbox API.
 *
 * Every non-2xx response is mapped to a subclass of {@link APIError} (itself a
 * {@link SlothboxError}). Mapping is driven by the machine-readable
 * `error.code` in the response envelope when present (SLO-116), falling back
 * to the HTTP status. Network-level failures (DNS, TLS, socket resets, …)
 * surface as {@link APIConnectionError}.
 *
 * The API's error envelope is:
 *
 * ```json
 * { "error": { "message": "…", "code": "…", "issues": { } } }
 * ```
 *
 * `code` and `issues` are optional — message-only errors remain valid, and
 * API Gateway-generated responses (authorizer denials, gateway throttling)
 * use a bare `{ "message": "…" }` shape which is also handled here.
 */

/**
 * Known machine-readable error codes emitted by the API (SLO-116/SLO-121).
 * The union is open (`string & {}`) so new server-side codes never break
 * compilation — but known codes autocomplete and narrow.
 */
export type SlothboxErrorCode =
  // launch 409 trio
  | 'seat_ceiling_exceeded'
  | 'no_active_aws_connection'
  | 'template_not_baked'
  // lifecycle 409 guards
  | 'environment_terminated'
  | 'environment_launching'
  // API plan (402)
  | 'api_plan_required'
  | 'api_plan_lapsed'
  // SDK traffic on a non-service-account credential (403) — the SDK
  // identifies itself via the `x-slothbox-sdk` header on every request, and
  // the API requires an org service-account key for SDK-identified traffic
  | 'sdk_requires_service_key'
  // throttling (429)
  | 'rate_limited'
  // forward compatibility: any other stable code the API may add
  | (string & {});

import type { RetryContext } from './retry.js';

/** Base class for every error thrown by `@slothbox/sdk`. */
export class SlothboxError extends Error {
  /**
   * Attached by the retry middleware (SLO-133) when this error ended a
   * retryable request: attempts made, retries permitted, last `Retry-After`,
   * total backoff time. `undefined` on errors that were never retry
   * candidates (4xx other than 429, aborts, parse failures, …).
   */
  retryContext?: RetryContext;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'SlothboxError';
  }
}

/**
 * The request never produced an HTTP response — DNS failure, connection
 * refused/reset, TLS error, etc. The underlying error is on `cause`.
 * Deliberate aborts (`AbortSignal`) are NOT wrapped — they re-throw as-is so
 * callers can distinguish their own cancellation.
 */
export class APIConnectionError extends SlothboxError {
  constructor(message = 'Connection error', options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'APIConnectionError';
  }
}

/** Detail bag shared by all HTTP error constructors. */
export interface APIErrorDetails {
  /** HTTP status code of the response. */
  status: number;
  /** Machine-readable error code from the envelope, when the API sent one. */
  code?: SlothboxErrorCode | undefined;
  /**
   * Request id assigned by the API gateway, for support/correlation.
   * Read from the `x-amzn-requestid` response header (AWS API Gateway
   * REST API), with graceful fallbacks (`apigw-requestid`, `x-amz-apigw-id`,
   * `x-request-id`).
   */
  requestId?: string | undefined;
  /** Validation details (`error.issues`) on 400 responses, when present. */
  issues?: unknown;
  /** Seconds to wait before retrying — only meaningful on 429s. */
  retryAfter?: number | undefined;
}

/** An HTTP error response from the Slothbox API. */
export class APIError extends SlothboxError {
  readonly status: number;
  readonly code: SlothboxErrorCode | undefined;
  readonly requestId: string | undefined;
  readonly issues: unknown;

  constructor(message: string, details: APIErrorDetails) {
    super(message);
    this.name = 'APIError';
    this.status = details.status;
    this.code = details.code;
    this.requestId = details.requestId;
    this.issues = details.issues;
  }
}

/** 400 — the request was malformed; `issues` carries validation details. */
export class BadRequestError extends APIError {
  constructor(message: string, details: APIErrorDetails) {
    super(message, details);
    this.name = 'BadRequestError';
  }
}

/** 401 — missing or invalid credentials. */
export class AuthenticationError extends APIError {
  constructor(message: string, details: APIErrorDetails) {
    super(message, details);
    this.name = 'AuthenticationError';
  }
}

/**
 * 402 — the operation needs an active API plan
 * (`api_plan_required` / `api_plan_lapsed`).
 */
export class PlanRequiredError extends APIError {
  constructor(message: string, details: APIErrorDetails) {
    super(message, details);
    this.name = 'PlanRequiredError';
  }
}

/**
 * 403 — authenticated, but not allowed to perform this operation.
 * Discriminate on {@link APIError.code}: `sdk_requires_service_key` means the
 * request carried the SDK's `x-slothbox-sdk` identification header but the
 * credential was not an org service-account key — the SDK only supports
 * API-plan service-account keys (`sk_…`), not personal seat keys or
 * browser-session auth.
 */
export class PermissionDeniedError extends APIError {
  constructor(message: string, details: APIErrorDetails) {
    super(message, details);
    this.name = 'PermissionDeniedError';
  }
}

/** 404 — the resource does not exist (or is not visible to the caller). */
export class NotFoundError extends APIError {
  constructor(message: string, details: APIErrorDetails) {
    super(message, details);
    this.name = 'NotFoundError';
  }
}

/**
 * 409 — the operation conflicts with current state. Discriminate on
 * {@link APIError.code}: `seat_ceiling_exceeded`, `no_active_aws_connection`,
 * `template_not_baked`, `environment_terminated`, `environment_launching`.
 * (`code` may be `undefined` until the API's error-code rollout reaches the
 * route — fall back to `status`/`message` in that case.)
 */
export class ConflictError extends APIError {
  constructor(message: string, details: APIErrorDetails) {
    super(message, details);
    this.name = 'ConflictError';
  }
}

/**
 * 429 — rate limited. `retryAfter` is the number of whole seconds to wait
 * before retrying, parsed from the `Retry-After` response header.
 */
export class RateLimitError extends APIError {
  readonly retryAfter: number | undefined;

  constructor(message: string, details: APIErrorDetails) {
    super(message, details);
    this.name = 'RateLimitError';
    this.retryAfter = details.retryAfter;
  }
}

type APIErrorConstructor = new (message: string, details: APIErrorDetails) => APIError;

/**
 * code → class. Codes win over the status fallback so that, e.g., a
 * `rate_limited` body always produces a RateLimitError even if a proxy
 * rewrote the status.
 */
const ERROR_CLASS_BY_CODE: Record<string, APIErrorConstructor> = {
  seat_ceiling_exceeded: ConflictError,
  no_active_aws_connection: ConflictError,
  template_not_baked: ConflictError,
  environment_terminated: ConflictError,
  environment_launching: ConflictError,
  api_plan_required: PlanRequiredError,
  api_plan_lapsed: PlanRequiredError,
  sdk_requires_service_key: PermissionDeniedError,
  rate_limited: RateLimitError,
};

const ERROR_CLASS_BY_STATUS: Record<number, APIErrorConstructor> = {
  400: BadRequestError,
  401: AuthenticationError,
  402: PlanRequiredError,
  403: PermissionDeniedError,
  404: NotFoundError,
  409: ConflictError,
  429: RateLimitError,
};

interface ParsedEnvelope {
  message: string | undefined;
  code: string | undefined;
  issues: unknown;
}

/**
 * Extract `{message, code, issues}` from a (possibly already JSON-parsed)
 * error body. Handles the API envelope `{error: {message, code?, issues?}}`,
 * the API Gateway-generated `{message}` shape, and anything else (→ empty).
 */
function parseEnvelope(body: unknown): ParsedEnvelope {
  const none: ParsedEnvelope = { message: undefined, code: undefined, issues: undefined };
  if (typeof body !== 'object' || body === null) return none;
  const outer = body as { error?: unknown; message?: unknown };
  if (typeof outer.error === 'object' && outer.error !== null) {
    const inner = outer.error as { message?: unknown; code?: unknown; issues?: unknown };
    return {
      message: typeof inner.message === 'string' ? inner.message : undefined,
      code: typeof inner.code === 'string' ? inner.code : undefined,
      issues: inner.issues,
    };
  }
  // API Gateway-generated responses (authorizer 401s, gateway 429s) are a
  // bare `{"message": "…"}` — no envelope, no code.
  if (typeof outer.message === 'string') {
    return { message: outer.message, code: undefined, issues: undefined };
  }
  return none;
}

/**
 * The request-id headers to look for, in order. The Slothbox API runs on an
 * AWS API Gateway REST API, which echoes `x-amzn-RequestId` on every
 * response; the rest are graceful fallbacks (HTTP API v2's `apigw-requestid`,
 * the REST extended id `x-amz-apigw-id`, and the conventional `x-request-id`).
 */
const REQUEST_ID_HEADERS = [
  'x-amzn-requestid',
  'apigw-requestid',
  'x-amz-apigw-id',
  'x-request-id',
] as const;

/** Pull the request id out of response headers (case-insensitive). */
export function requestIdFromHeaders(headers: Headers): string | undefined {
  for (const name of REQUEST_ID_HEADERS) {
    const value = headers.get(name);
    if (value) return value;
  }
  return undefined;
}

/**
 * Parse a `Retry-After` header value into whole seconds. The API always sends
 * delta-seconds (see its 429 builder), but HTTP-date is parsed too for
 * robustness. Returns `undefined` when absent/unparseable.
 */
export function parseRetryAfter(value: string | null): number | undefined {
  if (value === null || value.trim() === '') return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, Math.ceil(seconds));
  const date = Date.parse(value);
  if (Number.isNaN(date)) return undefined;
  return Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

/**
 * Build the right {@link APIError} subclass for a non-2xx response.
 *
 * @param status response status code
 * @param body the response body, JSON-parsed when possible (raw text or
 *   `undefined` otherwise)
 * @param headers the response headers (request id, `Retry-After`)
 */
export function errorFromResponse(status: number, body: unknown, headers: Headers): APIError {
  const envelope = parseEnvelope(body);
  const message = envelope.message ?? `Request failed with status ${status}`;
  const ErrorClass =
    (envelope.code !== undefined ? ERROR_CLASS_BY_CODE[envelope.code] : undefined) ??
    ERROR_CLASS_BY_STATUS[status] ??
    APIError;
  return new ErrorClass(message, {
    status,
    code: envelope.code,
    requestId: requestIdFromHeaders(headers),
    issues: envelope.issues,
    retryAfter: parseRetryAfter(headers.get('retry-after')),
  });
}
