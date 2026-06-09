/**
 * Slothbox webhook receiver — Cloudflare Workers variant.
 *
 * The SDK's webhook toolkit is WebCrypto-only (no `node:` imports), so it
 * runs on Workers as-is. The same three rules as the Express variant:
 *
 *   1. RAW BODY — read the body with `request.text()`, which preserves the
 *      exact bytes the signature covers. NEVER `request.json()` +
 *      re-stringify: key order and whitespace change and verification fails.
 *   2. FAST ACK — return the 2xx immediately and do the work after the
 *      response via `ctx.waitUntil()`. Slow responses count as failed
 *      deliveries and get retried; sustained failures auto-disable the
 *      endpoint.
 *   3. IDEMPOTENT — delivery is at-least-once. Worker isolates are ephemeral
 *      and you'll run in many at once, so dedupe in a SHARED store (KV with
 *      an expirationTtl, a Durable Object, D1, …) keyed on `event.id`, which
 *      is stable across retries.
 *
 * Environment contract (Worker bindings, not process env):
 *   SLOTHBOX_WEBHOOK_SECRET  required   the endpoint's whsec_… signing secret,
 *                                       stored as a Worker secret:
 *                                       `wrangler secret put SLOTHBOX_WEBHOOK_SECRET`
 *
 * Deploy: from a Worker project, set `main` in wrangler.toml to this file
 * (and `npm install @slothbox/sdk`); `wrangler dev` to run locally. This repo
 * typechecks the file in CI but deliberately ships no wrangler config.
 */

import { parseWebhookEvent, WebhookVerificationError, type WebhookEvent } from '@slothbox/sdk';

// In a real Worker project these come from @cloudflare/workers-types (which
// would conflict with @types/node in this examples package, so the two
// members we use are declared structurally — they match the real ones).
interface Env {
  SLOTHBOX_WEBHOOK_SECRET: string;
  // For production dedupe, bind a KV namespace in wrangler.toml:
  // SEEN_EVENTS: KVNamespace;
}
interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

/** Runs after the 200 has been returned (kept alive by ctx.waitUntil). */
async function handleEvent(event: WebhookEvent): Promise<void> {
  switch (event.type) {
    case 'environment.started':
      console.log(`box ${event.data.resource.id} is running`);
      break;
    case 'environment.stopped':
      // Fires for manual stops AND auto-sleep stops.
      console.log(`box ${event.data.resource.id} stopped`);
      break;
    case 'environment.failed':
      console.warn(
        `box ${event.data.resource.id} failed to launch: ${event.data.reason ?? 'unknown'}`,
      );
      break;
    case 'webhook.endpoint.disabled':
      // Slothbox auto-disabled THIS endpoint after sustained delivery
      // failures: you are no longer receiving events until it is re-enabled.
      // Treat it as an incident — page a human, don't just log.
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

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('method not allowed', { status: 405 });
    }

    const rawBody = await request.text(); // rule 1: exact bytes — NOT request.json()

    let event: WebhookEvent;
    try {
      event = await parseWebhookEvent(rawBody, request.headers, env.SLOTHBOX_WEBHOOK_SECRET);
    } catch (error) {
      if (error instanceof WebhookVerificationError) {
        // Wrong secret, altered body, replayed/expired timestamp, missing
        // headers — reject; the 4xx marks the delivery failed on the
        // Slothbox side.
        return new Response(`invalid webhook: ${error.code}`, { status: 400 });
      }
      throw error;
    }

    // Rule 3: dedupe before acting — with a KV binding it looks like:
    //
    //   if (await env.SEEN_EVENTS.get(event.id)) return new Response('ok');
    //   await env.SEEN_EVENTS.put(event.id, '1', { expirationTtl: 86_400 });

    // Rule 2: ack now, work after the response. waitUntil keeps the isolate
    // alive past the return; for work that must survive a crash, enqueue to
    // Cloudflare Queues here instead.
    ctx.waitUntil(
      handleEvent(event).catch((error) => {
        console.error(`failed handling ${event.type} (${event.id}):`, error);
      }),
    );
    return new Response('ok', { status: 200 });
  },
};
