/**
 * Slothbox webhook receiver — Express variant.
 *
 * Verifies every delivery's signature with the SDK toolkit, acks fast, and
 * handles events idempotently. The three rules of webhook receiving:
 *
 *   1. RAW BODY — the signature covers the EXACT bytes Slothbox sent. Mount
 *      `express.raw()` on the webhook route, never `express.json()`: parsing
 *      and re-serializing changes whitespace/key order and verification
 *      fails. (If the rest of your app uses a global `express.json()`, mount
 *      this route's raw parser first or exclude the webhook path from it —
 *      once express.json() has consumed the stream the original bytes are
 *      gone.)
 *   2. FAST ACK — respond 2xx as soon as the event is verified and recorded,
 *      and do slow work after the response. Slow responses count as failed
 *      deliveries and get retried; sustained failures auto-disable the
 *      endpoint.
 *   3. IDEMPOTENT — delivery is at-least-once, so retries WILL re-deliver
 *      events you already processed. Dedupe on `event.id` (stable across
 *      retries; the `webhook-id` header carries the same guarantee) before
 *      acting.
 *
 * Environment contract:
 *   SLOTHBOX_WEBHOOK_SECRET  required   the endpoint's whsec_… signing secret
 *                                       (dashboard → webhooks → endpoint, or
 *                                       `slothbox.webhooks.getSecret()`)
 *   PORT                     optional   listen port (default 3000)
 *
 * Run (from examples/):  npm run webhook-receiver-express
 * Test: point a Slothbox webhook endpoint at this host (tunnel localhost in
 * dev) and send a test event from the dashboard — it arrives as a
 * `webhook.ping`.
 */

import { parseWebhookEvent, WebhookVerificationError, type WebhookEvent } from '@slothbox/sdk';
import express from 'express';

const secret = process.env.SLOTHBOX_WEBHOOK_SECRET;
if (!secret) {
  console.error('Missing required environment variable SLOTHBOX_WEBHOOK_SECRET');
  process.exit(1);
}
const port = Number(process.env.PORT ?? 3000);

// ── Idempotency (rule 3) ─────────────────────────────────────────────────────
// In-memory is fine for a demo. In production use a shared store with a TTL —
// Redis `SET key 1 NX EX 86400`, a DynamoDB conditional put, … — so restarts
// and multiple replicas dedupe too. A 24h window comfortably covers the
// retry schedule.
const SEEN_TTL_MS = 24 * 60 * 60 * 1000;
const seen = new Map<string, number>(); // event.id → first-handled epoch ms

function alreadyHandled(eventId: string): boolean {
  const now = Date.now();
  for (const [id, at] of seen) {
    if (now - at > SEEN_TTL_MS) seen.delete(id);
  }
  if (seen.has(eventId)) return true;
  seen.set(eventId, now);
  return false;
}

// ── The actual event handling (runs AFTER the 200 is sent) ──────────────────
async function handleEvent(event: WebhookEvent): Promise<void> {
  switch (event.type) {
    case 'environment.started':
      console.log(`box ${event.data.resource.id} is running`);
      break;
    case 'environment.stopped':
      // Fires for manual stops AND auto-sleep stops — scale your tooling down.
      console.log(`box ${event.data.resource.id} stopped`);
      break;
    case 'environment.failed':
      console.warn(
        `box ${event.data.resource.id} failed to launch: ${event.data.reason ?? 'unknown'}`,
      );
      break;
    case 'webhook.endpoint.disabled':
      // Slothbox auto-disabled THIS endpoint after sustained delivery
      // failures: you are no longer receiving events, and deliveries stay
      // paused until it is re-enabled. Treat it as an incident — page a
      // human, don't just log.
      console.error(
        `endpoint ${event.data.endpointId} (${event.data.url}) disabled: ${event.data.reason}`,
      );
      break;
    case 'webhook.ping':
      console.log(`ping: ${event.data.message ?? 'test event from the dashboard'}`);
      break;
    default:
      // Slothbox adds event types over time, and '*' subscriptions receive
      // them immediately. They verify and parse fine — log and move on,
      // never treat an unknown type as an error.
      console.log(`unhandled event type: ${event.type}`);
  }
}

// ── The receiver ─────────────────────────────────────────────────────────────
const app = express();

app.post(
  '/webhooks/slothbox',
  express.raw({ type: 'application/json' }), // rule 1: req.body stays a Buffer
  async (req, res) => {
    let event: WebhookEvent;
    try {
      event = await parseWebhookEvent(
        req.body, // the raw bytes — NEVER JSON.stringify(req.body)
        req.headers,
        secret,
      );
    } catch (error) {
      if (error instanceof WebhookVerificationError) {
        // Wrong secret, altered body, replayed/expired timestamp, missing
        // headers — reject; the 4xx marks the delivery failed on the
        // Slothbox side.
        res.status(400).send(`invalid webhook: ${error.code}`);
        return;
      }
      throw error; // not a verification failure — let Express 500
    }

    if (alreadyHandled(event.id)) {
      // A retry of an event we already processed — ack it and do nothing.
      res.sendStatus(200);
      return;
    }

    // Rule 2: verified and recorded → ack NOW, work AFTER the response. For
    // anything that must not be lost on a crash, enqueue to a durable queue
    // here instead of calling the handler inline.
    res.sendStatus(200);
    handleEvent(event).catch((error) => {
      console.error(`failed handling ${event.type} (${event.id}):`, error);
    });
  },
);

app.listen(port, () => {
  console.log(`listening on :${port} — POST /webhooks/slothbox`);
});
