/**
 * Webhook verifier tests (SLO-128).
 *
 * The core of this suite is the SHARED vector file
 * src/webhook-signing-vectors.json — a verbatim copy of
 * sloth-box/api/src/lib/webhookSigningVectors.json, generated there from the
 * PRODUCTION signing code (`npm run vectors:webhooks` in sloth-box/api). The
 * api repo's webhookSigningVectors.test.ts asserts its signer still produces
 * exactly those bytes; this suite asserts our verifier accepts/rejects them
 * as expected. Together they make silent drift between signer and verifier
 * impossible. Never edit the JSON by hand — regenerate it in the api repo and
 * copy it here.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import vectorsJson from './webhook-signing-vectors.json';
import {
  WEBHOOK_EVENT_TYPES,
  WebhookVerificationError,
  isWebhookEventType,
  parseWebhookEvent,
  verifyWebhook,
  type WebhookEvent,
  type WebhookEventType,
} from './webhooks.js';

// The package compiles against lib.es2022 only (no lib.dom / @types/node), so
// declare the WHATWG globals this suite uses; they exist at runtime on Node 18+.
declare const Headers: new (init?: Record<string, string>) => {
  get(name: string): string | null;
};
declare class TextEncoder {
  encode(input?: string): Uint8Array;
}

interface VectorCase {
  name: string;
  description: string;
  secret: string;
  body: string;
  headers: Record<string, string>;
  now: number;
  valid: boolean;
  envelope: boolean;
  error?: string;
  signing: unknown;
}

const vectors = vectorsJson as { toleranceSeconds: number; cases: VectorCase[] };

function pinClock(unixSeconds: number): void {
  vi.useFakeTimers();
  vi.setSystemTime(unixSeconds * 1000);
}

afterEach(() => {
  vi.useRealTimers();
});

describe('verifyWebhook against the shared api-signed vectors', () => {
  it('the vector file documents the 5-minute tolerance we default to', () => {
    expect(vectors.toleranceSeconds).toBe(300);
  });

  for (const c of vectors.cases) {
    it(`${c.name}: ${c.valid ? 'verifies' : `rejects with ${c.error}`}`, async () => {
      pinClock(c.now);
      const run = verifyWebhook(c.body, c.headers, c.secret);
      if (c.valid) {
        await expect(run).resolves.toEqual(JSON.parse(c.body));
      } else {
        await expect(run).rejects.toMatchObject({
          name: 'WebhookVerificationError',
          code: c.error,
        });
        await expect(run).rejects.toBeInstanceOf(WebhookVerificationError);
      }
    });
  }
});

describe('input flexibility (same vectors, different shapes)', () => {
  const basic = vectors.cases.find((c) => c.name === 'valid-basic-single-signature')!;

  it('accepts a WHATWG Headers object', async () => {
    pinClock(basic.now);
    const headers = new Headers(basic.headers);
    await expect(verifyWebhook(basic.body, headers, basic.secret)).resolves.toEqual(
      JSON.parse(basic.body),
    );
  });

  it('accepts the raw body as a Uint8Array', async () => {
    pinClock(basic.now);
    const bytes = new TextEncoder().encode(basic.body);
    await expect(verifyWebhook(bytes, basic.headers, basic.secret)).resolves.toEqual(
      JSON.parse(basic.body),
    );
  });

  it('header lookup in plain records is case-insensitive', async () => {
    pinClock(basic.now);
    const mixedCase = {
      'Webhook-Id': basic.headers['webhook-id'],
      'Webhook-Timestamp': basic.headers['webhook-timestamp'],
      'WEBHOOK-SIGNATURE': basic.headers['webhook-signature'],
    };
    await expect(verifyWebhook(basic.body, mixedCase, basic.secret)).resolves.toEqual(
      JSON.parse(basic.body),
    );
  });

  it('takes the first value when a header arrives as an array', async () => {
    pinClock(basic.now);
    const headers = {
      'webhook-id': [basic.headers['webhook-id']],
      'webhook-timestamp': basic.headers['webhook-timestamp'],
      'webhook-signature': basic.headers['webhook-signature'],
    };
    await expect(verifyWebhook(basic.body, headers, basic.secret)).resolves.toEqual(
      JSON.parse(basic.body),
    );
  });
});

describe('timestamp tolerance option', () => {
  it('a custom toleranceSeconds widens the replay window', async () => {
    const stale = vectors.cases.find((c) => c.name === 'invalid-timestamp-too-old')!;
    pinClock(stale.now);
    // Rejected at the default 300s…
    await expect(verifyWebhook(stale.body, stale.headers, stale.secret)).rejects.toMatchObject({
      code: 'timestamp_too_old',
    });
    // …accepted when the caller explicitly allows 10 minutes.
    await expect(
      verifyWebhook(stale.body, stale.headers, stale.secret, { toleranceSeconds: 600 }),
    ).resolves.toEqual(JSON.parse(stale.body));
  });

  it('a custom toleranceSeconds also narrows it', async () => {
    const basic = vectors.cases.find((c) => c.name === 'valid-basic-single-signature')!;
    pinClock(basic.now); // the vector was signed 60s before `now`
    await expect(
      verifyWebhook(basic.body, basic.headers, basic.secret, { toleranceSeconds: 30 }),
    ).rejects.toMatchObject({ code: 'timestamp_too_old' });
  });
});

describe('invalid secret input', () => {
  const basic = vectors.cases.find((c) => c.name === 'valid-basic-single-signature')!;

  it('rejects a non-base64 secret with invalid_secret', async () => {
    pinClock(basic.now);
    await expect(
      verifyWebhook(basic.body, basic.headers, 'whsec_!!!not-base64!!!'),
    ).rejects.toMatchObject({ code: 'invalid_secret' });
  });

  it('rejects an empty secret with invalid_secret', async () => {
    pinClock(basic.now);
    await expect(verifyWebhook(basic.body, basic.headers, 'whsec_')).rejects.toMatchObject({
      code: 'invalid_secret',
    });
  });
});

describe('parseWebhookEvent', () => {
  it('verifies then narrows to the typed union', async () => {
    const c = vectors.cases.find((v) => v.name === 'valid-rotation-verifies-with-current-secret')!;
    pinClock(c.now);
    const event = await parseWebhookEvent(c.body, c.headers, c.secret);
    expect(event.type).toBe('environment.started');
    if (event.type === 'environment.started') {
      // Type-level narrowing: `data` is the environment payload here.
      expect(event.data.resource.id).toBe('env_vector0001');
      expect(event.data.resource.type).toBe('environment');
    }
    expect(event.id).toMatch(/^msg_/);
    expect(typeof event.timestamp).toBe('string');
  });

  it('narrows webhook.ping payloads', async () => {
    const c = vectors.cases.find((v) => v.name === 'valid-basic-single-signature')!;
    pinClock(c.now);
    const event = await parseWebhookEvent(c.body, c.headers, c.secret);
    expect(event.type).toBe('webhook.ping');
    if (event.type === 'webhook.ping') {
      expect(event.data.endpointId).toBe('whep_vector0001');
    }
  });

  it('rejects a correctly signed body that is not an envelope', async () => {
    const c = vectors.cases.find((v) => v.name === 'valid-signature-but-not-an-envelope')!;
    expect(c.valid).toBe(true); // the signature itself is fine…
    pinClock(c.now);
    await expect(verifyWebhook(c.body, c.headers, c.secret)).resolves.toEqual([1, 2, 3]);
    // …but it is not a Slothbox event envelope.
    await expect(parseWebhookEvent(c.body, c.headers, c.secret)).rejects.toMatchObject({
      code: 'invalid_envelope',
    });
  });

  it('propagates verification failures unchanged', async () => {
    const c = vectors.cases.find((v) => v.name === 'invalid-tampered-body')!;
    pinClock(c.now);
    await expect(parseWebhookEvent(c.body, c.headers, c.secret)).rejects.toMatchObject({
      code: 'no_matching_signature',
    });
  });
});

describe('typed event union', () => {
  it('the runtime catalogue includes every published type', () => {
    expect(WEBHOOK_EVENT_TYPES).toContain('webhook.endpoint.disabled');
    expect(WEBHOOK_EVENT_TYPES).toHaveLength(16);
    expect(isWebhookEventType('environment.started')).toBe(true);
    expect(isWebhookEventType('not.a.real.event')).toBe(false);
  });

  it('the WebhookEvent union covers exactly the published event types', () => {
    // Type-level assertion: WebhookEvent['type'] and WebhookEventType must be
    // the same set. If a type is added to one side only, this stops compiling.
    type UnionTypes = WebhookEvent['type'];
    type Covered = [UnionTypes] extends [WebhookEventType]
      ? [WebhookEventType] extends [UnionTypes]
        ? true
        : never
      : never;
    const covered: Covered = true;
    expect(covered).toBe(true);
  });
});
