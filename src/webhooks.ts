/**
 * Webhook toolkit (SLO-128): verify Slothbox webhook deliveries and narrow
 * them to typed events.
 *
 * Slothbox signs every delivery with the open Standard Webhooks scheme (the
 * same one the `svix` libraries implement). Three headers accompany the POST:
 *
 *   webhook-id         stable `msg_…` id, reused verbatim across retries —
 *                      use it as your idempotency key
 *   webhook-timestamp  unix SECONDS, re-stamped on every delivery attempt
 *   webhook-signature  `v1,<base64 HMAC-SHA256>` computed over
 *                      `${id}.${timestamp}.${rawBody}`. During a secret
 *                      rotation overlap it is a SPACE-DELIMITED list of
 *                      tokens; a match against any one of them is valid.
 *
 * The HMAC key is the base64-decode of your endpoint secret after stripping
 * its `whsec_` prefix. Verification rejects timestamps more than five minutes
 * from now (strictly greater than, in either direction) to bound replays.
 *
 * Implemented with WebCrypto (`crypto.subtle`) only — no `node:` imports — so
 * it runs on Node.js 18+, Cloudflare Workers, Deno, Bun, and browsers.
 *
 * IMPORTANT: always verify the EXACT raw body bytes you received. Parsing and
 * re-serializing JSON (e.g. `express.json()`) changes whitespace and key
 * order and the signature will not match. See the README for Express and
 * Cloudflare Workers examples.
 */

// ─── Minimal ambient typings ─────────────────────────────────────────────────
// The package compiles against lib.es2022 only (no lib.dom, no @types/node) so
// a platform-specific global can't sneak into the runtime surface. These are
// module-scoped structural declarations of the WHATWG globals we rely on —
// all of them exist on every supported runtime (Node 18+, Workers, Deno, Bun,
// browsers). They are not exported and do not leak into consumers' types.

declare const crypto: {
  subtle: {
    importKey(
      format: 'raw',
      keyData: Uint8Array,
      algorithm: { name: 'HMAC'; hash: 'SHA-256' },
      extractable: boolean,
      keyUsages: readonly ['sign'],
    ): Promise<unknown>;
    sign(algorithm: 'HMAC', key: unknown, data: Uint8Array): Promise<ArrayBuffer>;
  };
};
declare function atob(data: string): string;
declare function btoa(data: string): string;
declare class TextEncoder {
  encode(input?: string): Uint8Array;
}
declare class TextDecoder {
  decode(input?: Uint8Array): string;
}

// ─── Event catalogue ─────────────────────────────────────────────────────────

/** Every webhook event type Slothbox currently publishes. */
export const WEBHOOK_EVENT_TYPES = [
  'environment.created',
  'environment.started',
  'environment.stopped',
  'environment.terminated',
  'environment.failed',
  'member.added',
  'member.removed',
  'member.role_changed',
  'connection.verified',
  'connection.failed',
  'billing.trialing',
  'billing.active',
  'billing.past_due',
  'billing.canceled',
  'webhook.ping',
  'webhook.endpoint.disabled',
] as const;

/** A published webhook event type. */
export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

/** True if `value` is an event type this SDK version knows about. */
export function isWebhookEventType(value: string): value is WebhookEventType {
  return (WEBHOOK_EVENT_TYPES as readonly string[]).includes(value);
}

/** Reference to the environment an event is about. */
export interface EnvironmentResourceRef {
  type: 'environment';
  id: string;
  name?: string;
}

/** Reference to the organisation member an event is about. */
export interface MemberResourceRef {
  type: 'member';
  id: string;
  name?: string;
}

/** Reference to the AWS connection an event is about. */
export interface ConnectionResourceRef {
  type: 'connection';
  id: string;
  name?: string;
}

/** Organisation roles. */
export type OrgRole = 'owner' | 'member';

/** Subscription billing statuses. */
export type BillingStatus = 'trialing' | 'active' | 'past_due' | 'canceled';

/**
 * The envelope shape shared by every delivery. `id` doubles as your
 * idempotency key (delivery is at-least-once); `timestamp` is the ISO-8601
 * time the originating action occurred.
 */
export interface WebhookEventBase<TType extends string, TData> {
  id: string;
  type: TType;
  timestamp: string;
  data: TData;
}

/** A new environment was created (before the box boots). */
export type EnvironmentCreatedEvent = WebhookEventBase<
  'environment.created',
  { resource: EnvironmentResourceRef }
>;
/** An environment finished provisioning and is running. */
export type EnvironmentStartedEvent = WebhookEventBase<
  'environment.started',
  { resource: EnvironmentResourceRef }
>;
/** An environment was stopped (the box is paused). */
export type EnvironmentStoppedEvent = WebhookEventBase<
  'environment.stopped',
  { resource: EnvironmentResourceRef }
>;
/** An environment was terminated (the box is gone). */
export type EnvironmentTerminatedEvent = WebhookEventBase<
  'environment.terminated',
  { resource: EnvironmentResourceRef }
>;
/** An environment failed to launch. */
export type EnvironmentFailedEvent = WebhookEventBase<
  'environment.failed',
  { resource: EnvironmentResourceRef; reason?: string }
>;
/** A user joined the organisation. */
export type MemberAddedEvent = WebhookEventBase<
  'member.added',
  {
    resource: MemberResourceRef;
    member: { userId: string; email: string; name?: string; role: OrgRole };
  }
>;
/** A user was removed from the organisation. */
export type MemberRemovedEvent = WebhookEventBase<
  'member.removed',
  { resource: MemberResourceRef; member: { userId: string; email: string } }
>;
/** A member's role changed. */
export type MemberRoleChangedEvent = WebhookEventBase<
  'member.role_changed',
  { resource: MemberResourceRef; member: { userId: string; email: string; role: OrgRole } }
>;
/** An AWS connection was verified and is active. */
export type ConnectionVerifiedEvent = WebhookEventBase<
  'connection.verified',
  { resource: ConnectionResourceRef; awsAccountId?: string }
>;
/** An AWS connection failed verification. */
export type ConnectionFailedEvent = WebhookEventBase<
  'connection.failed',
  { resource: ConnectionResourceRef; reason?: string }
>;
/** The subscription entered the trial period. */
export type BillingTrialingEvent = WebhookEventBase<
  'billing.trialing',
  { orgId: string; billingStatus: 'trialing' }
>;
/** The subscription became active. */
export type BillingActiveEvent = WebhookEventBase<
  'billing.active',
  { orgId: string; billingStatus: 'active' }
>;
/** A subscription payment is past due. */
export type BillingPastDueEvent = WebhookEventBase<
  'billing.past_due',
  { orgId: string; billingStatus: 'past_due' }
>;
/** The subscription was canceled. */
export type BillingCanceledEvent = WebhookEventBase<
  'billing.canceled',
  { orgId: string; billingStatus: 'canceled' }
>;
/** A test event triggered from the dashboard. */
export type WebhookPingEvent = WebhookEventBase<
  'webhook.ping',
  { message?: string; endpointId?: string; triggeredBy?: string }
>;
/** An endpoint was auto-disabled after sustained delivery failures. */
export type WebhookEndpointDisabledEvent = WebhookEventBase<
  'webhook.endpoint.disabled',
  { endpointId: string; url: string; reason: string }
>;

/**
 * Discriminated union of every published Slothbox webhook event — switch on
 * `event.type` to narrow `event.data`.
 *
 * Forward compatibility: Slothbox adds event types over time, and endpoints
 * subscribed to `*` receive them immediately. A delivery whose `type` is
 * newer than this SDK still verifies and parses — handle it in your
 * `default` branch rather than treating it as an error.
 */
export type WebhookEvent =
  | EnvironmentCreatedEvent
  | EnvironmentStartedEvent
  | EnvironmentStoppedEvent
  | EnvironmentTerminatedEvent
  | EnvironmentFailedEvent
  | MemberAddedEvent
  | MemberRemovedEvent
  | MemberRoleChangedEvent
  | ConnectionVerifiedEvent
  | ConnectionFailedEvent
  | BillingTrialingEvent
  | BillingActiveEvent
  | BillingPastDueEvent
  | BillingCanceledEvent
  | WebhookPingEvent
  | WebhookEndpointDisabledEvent;

// ─── Errors ──────────────────────────────────────────────────────────────────

/** Machine-readable reason a verification failed. */
export type WebhookVerificationErrorCode =
  /** One of webhook-id / webhook-timestamp / webhook-signature is absent. */
  | 'missing_headers'
  /** webhook-timestamp is not a number. */
  | 'invalid_timestamp'
  /** webhook-timestamp is older than the tolerance allows (possible replay). */
  | 'timestamp_too_old'
  /** webhook-timestamp is further in the future than the tolerance allows. */
  | 'timestamp_too_new'
  /** The secret is empty or not base64. */
  | 'invalid_secret'
  /** No signature token matched (wrong secret, or the body was altered). */
  | 'no_matching_signature'
  /** The signature matched but the body is not a Slothbox webhook envelope. */
  | 'invalid_envelope';

/** Thrown by {@link verifyWebhook} / {@link parseWebhookEvent} on any failure. */
export class WebhookVerificationError extends Error {
  override readonly name = 'WebhookVerificationError';
  readonly code: WebhookVerificationErrorCode;

  constructor(code: WebhookVerificationErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

// ─── Verification ────────────────────────────────────────────────────────────

/** Structural subset of WHATWG `Headers` (so any fetch implementation works). */
export interface WebhookHeadersLike {
  get(name: string): string | null;
}

/**
 * Header input accepted by the verifier: a WHATWG `Headers` object (Workers,
 * Deno, `fetch`) or a plain record like Node/Express `req.headers`. Lookups
 * are case-insensitive either way.
 */
export type WebhookHeaders = WebhookHeadersLike | Record<string, string | string[] | undefined>;

/** Options for {@link verifyWebhook} / {@link parseWebhookEvent}. */
export interface VerifyWebhookOptions {
  /**
   * Maximum allowed difference between `webhook-timestamp` and the current
   * time, in seconds, in either direction. Matches the Standard Webhooks
   * default Slothbox documents.
   * @default 300
   */
  toleranceSeconds?: number;
}

const SECRET_PREFIX = 'whsec_';
const SIGNATURE_VERSION = 'v1';
const DEFAULT_TOLERANCE_SECONDS = 5 * 60;

function headerValue(headers: WebhookHeaders, name: string): string | undefined {
  const maybeGet = (headers as WebhookHeadersLike).get;
  if (typeof maybeGet === 'function') {
    return (headers as WebhookHeadersLike).get(name) ?? undefined;
  }
  const record = headers as Record<string, string | string[] | undefined>;
  for (const key of Object.keys(record)) {
    if (key.toLowerCase() === name) {
      const value = record[key];
      return Array.isArray(value) ? value[0] : value;
    }
  }
  return undefined;
}

function base64Decode(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64Encode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/** Constant-time comparison of two strings (over their UTF-8 bytes). */
function timingSafeEqualStrings(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

function parseAndCheckTimestamp(header: string, toleranceSeconds: number): number {
  const timestamp = Number.parseInt(header, 10);
  if (Number.isNaN(timestamp)) {
    throw new WebhookVerificationError(
      'invalid_timestamp',
      `The webhook-timestamp header is not a number: ${JSON.stringify(header)}`,
    );
  }
  const now = Math.floor(Date.now() / 1000);
  if (now - timestamp > toleranceSeconds) {
    throw new WebhookVerificationError(
      'timestamp_too_old',
      `Webhook timestamp ${timestamp} is more than ${toleranceSeconds}s old — rejecting a possible replay`,
    );
  }
  if (timestamp > now + toleranceSeconds) {
    throw new WebhookVerificationError(
      'timestamp_too_new',
      `Webhook timestamp ${timestamp} is more than ${toleranceSeconds}s in the future`,
    );
  }
  return timestamp;
}

async function computeSignature(secret: string, signedContent: string): Promise<string> {
  let keyBytes: Uint8Array;
  try {
    keyBytes = base64Decode(
      secret.startsWith(SECRET_PREFIX) ? secret.slice(SECRET_PREFIX.length) : secret,
    );
  } catch {
    throw new WebhookVerificationError(
      'invalid_secret',
      `The webhook secret must be base64, optionally prefixed with "${SECRET_PREFIX}"`,
    );
  }
  if (keyBytes.length === 0) {
    throw new WebhookVerificationError('invalid_secret', "The webhook secret can't be empty");
  }
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedContent));
  return base64Encode(new Uint8Array(mac));
}

/**
 * Verify a Slothbox webhook delivery and return its parsed JSON body.
 *
 * Pass the EXACT raw body you received (string or bytes), the request
 * headers (a WHATWG `Headers` or a plain record like Express `req.headers`),
 * and your endpoint's `whsec_…` signing secret. Throws a typed
 * {@link WebhookVerificationError} on any failure; on success returns
 * `JSON.parse(rawBody)`.
 *
 * Prefer {@link parseWebhookEvent} if you want the result narrowed to the
 * typed {@link WebhookEvent} union.
 */
export async function verifyWebhook(
  rawBody: string | Uint8Array,
  headers: WebhookHeaders,
  secret: string,
  options: VerifyWebhookOptions = {},
): Promise<unknown> {
  const body = typeof rawBody === 'string' ? rawBody : new TextDecoder().decode(rawBody);

  const id = headerValue(headers, 'webhook-id');
  const timestampHeader = headerValue(headers, 'webhook-timestamp');
  const signatureHeader = headerValue(headers, 'webhook-signature');
  if (!id || !timestampHeader || !signatureHeader) {
    throw new WebhookVerificationError(
      'missing_headers',
      'Missing required headers: webhook-id, webhook-timestamp and webhook-signature must all be present',
    );
  }

  const tolerance = options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  const timestamp = parseAndCheckTimestamp(timestampHeader, tolerance);

  // The signed content uses the PARSED timestamp, exactly like the reference
  // (svix / standardwebhooks) implementation re-signs during verification.
  const expected = await computeSignature(secret, `${id}.${timestamp}.${body}`);

  // During a secret rotation overlap the header carries multiple
  // space-delimited `v1,<sig>` tokens; a match against ANY of them is valid.
  for (const token of signatureHeader.split(' ')) {
    const [version, signature] = token.split(',');
    if (version !== SIGNATURE_VERSION || signature === undefined) continue;
    if (timingSafeEqualStrings(signature, expected)) {
      try {
        return JSON.parse(body) as unknown;
      } catch {
        throw new WebhookVerificationError(
          'invalid_envelope',
          'The webhook body verified but is not valid JSON',
        );
      }
    }
  }
  throw new WebhookVerificationError(
    'no_matching_signature',
    'No matching signature found — the secret is wrong or the body was altered in transit ' +
      '(did you pass the exact raw bytes, not re-serialized JSON?)',
  );
}

/**
 * Verify a delivery with {@link verifyWebhook}, then narrow it to the typed
 * {@link WebhookEvent} union.
 *
 * Throws {@link WebhookVerificationError} (`code: 'invalid_envelope'`) when a
 * verified body is not a Slothbox event envelope. Event types newer than this
 * SDK release still parse — see the forward-compatibility note on
 * {@link WebhookEvent}.
 */
export async function parseWebhookEvent(
  rawBody: string | Uint8Array,
  headers: WebhookHeaders,
  secret: string,
  options: VerifyWebhookOptions = {},
): Promise<WebhookEvent> {
  const payload = await verifyWebhook(rawBody, headers, secret, options);
  if (
    typeof payload !== 'object' ||
    payload === null ||
    Array.isArray(payload) ||
    typeof (payload as { id?: unknown }).id !== 'string' ||
    typeof (payload as { type?: unknown }).type !== 'string' ||
    typeof (payload as { timestamp?: unknown }).timestamp !== 'string' ||
    !('data' in payload)
  ) {
    throw new WebhookVerificationError(
      'invalid_envelope',
      'The verified payload is not a Slothbox webhook event envelope',
    );
  }
  return payload as WebhookEvent;
}
