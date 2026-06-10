# @slothbox/sdk

Official TypeScript SDK for the [Slothbox](https://slothbox.dev) API.

> **Status: 0.x pre-GA.** Published to npm as
> [`@slothbox/sdk`](https://www.npmjs.com/package/@slothbox/sdk). The API
> surface may change between minor versions until 1.0.0 — pin an exact
> version.

## Versioning

The package is on **0.x pre-GA [semver](https://semver.org/#spec-item-4)**:
anything may change between minor versions until 1.0.0. Pin an exact version.

## Runtime support

Built for any runtime with a WHATWG `fetch` global — Node.js 18+, Cloudflare
Workers, Deno, Bun, and modern browsers. Zero runtime dependencies, dual
ESM + CJS builds.

## Installation

```sh
npm install @slothbox/sdk
```

## Quickstart

```ts
import { Slothbox } from '@slothbox/sdk';

// Reads the SLOTHBOX_API_KEY environment variable when apiKey is omitted.
const slothbox = new Slothbox({ apiKey: 'sk_…' });

const { environments } = await slothbox.environments.list({ orgId: 'org_…' });
```

The client works anywhere `fetch` does — pass `baseUrl` to target another
stack, or `fetch` to supply your own implementation.

### Authentication

The API key is sent **as-is** in the `Authorization` header — the API accepts
the raw key, and also strips an optional `Bearer ` prefix server-side, so both
forms work. The SDK sends the raw key and never assumes a prefix.

#### SDKs require a service-account key

The SDK requires an **org service-account key** from the API plan (`sk_…`,
created in the dashboard). Personal seat keys and browser-session auth are
**not supported** through the SDK.

This is enforced server-side: the SDK identifies itself on **every** request —
including the raw `request()` escape hatch — with an identification header:

```
x-slothbox-sdk: slothbox-sdk-typescript/<version>
```

The header is always on, by design. There is no option to disable it, and it
is applied **after** the per-request `headers` merge, so a user-supplied
header cannot override or remove it. The API uses it to identify SDK traffic,
and SDK-identified requests on any other credential are rejected with a 403
`PermissionDeniedError` carrying `code: 'sdk_requires_service_key'`. (The SDK
deliberately does not set `User-Agent` — browsers and some runtimes forbid
it, so it is skipped everywhere for consistency.)

### Resource surface

Every published operation is exposed, grouped by resource family and named
after the spec's `operationId`s: `slothbox.environments.launch(…)`,
`slothbox.webhooks.rollSecret(…)`, `slothbox.templates.rebake(…)`, ….
Path params sit at the top of the args object, with `query` and `body` keys
where the operation defines them — all typed from the generated spec types.

```ts
const box = await slothbox.environments.launch(
  { orgId, body: { templateId, name: 'checkout-dev' } },
  { idempotencyKey: 'launch-7c2a' }, // retried launches return the original box
);
```

Every method also takes per-request options: `signal` (an `AbortSignal`) and
`headers` (merged over the SDK's defaults — except the `x-slothbox-sdk`
identification header, which always wins; see
[Authentication](#sdks-require-a-service-account-key)).

The one non-JSON operation, `awsConnections.getTemplate()`, resolves to the
CloudFormation template as a raw YAML string.

### Error handling

Non-2xx responses throw a typed hierarchy mapped from the API's
`{ error: { message, code? } }` envelope (with a status-only fallback), all
extending `SlothboxError`. HTTP errors expose `status`, `code`, `message`,
and `requestId` (from the gateway's `x-amzn-requestid` header); network
failures throw `APIConnectionError`.

```ts
import { ConflictError, RateLimitError } from '@slothbox/sdk';

try {
  await slothbox.environments.launch({ orgId, body: { templateId } });
} catch (err) {
  if (err instanceof ConflictError && err.code === 'seat_ceiling_exceeded') {
    // …stop fanning out
  } else if (err instanceof RateLimitError) {
    await sleep((err.retryAfter ?? 1) * 1000); // seconds, from Retry-After
  } else {
    throw err;
  }
}
```

Also available: `AuthenticationError` (401), `PlanRequiredError` (402),
`PermissionDeniedError` (403), `NotFoundError` (404), `BadRequestError`
(400, carries `issues`), and the `APIError` base for everything else.

### Retries and rate limits

Requests with **idempotent methods — GET, HEAD, PUT, DELETE —** are retried
automatically on 429s, 5xx responses, and network errors, with capped,
full-jitter exponential backoff. When a 429 carries a `Retry-After` header
(whole seconds — the API always sends delta-seconds), that wait is honored
exactly instead of the computed backoff, capped by the same maximum.

| Setting                                          | Default                                                      |
| ------------------------------------------------ | ------------------------------------------------------------ |
| `maxRetries` (retries after the initial attempt) | `3`                                                          |
| Backoff base                                     | `500 ms`                                                      |
| Backoff cap (also caps `Retry-After`)            | `30 s`                                                        |
| Jitter                                           | full — each wait is uniform in `[0, min(cap, base × 2ⁿ))`   |

`maxRetries` is configurable on the client and per request (`0` disables
retries either way):

```ts
const slothbox = new Slothbox({ apiKey, maxRetries: 5 });

await slothbox.environments.get({ orgId, envId }, { maxRetries: 0 }); // single shot
```

Backoff sleeps respect your `AbortSignal` — aborting cancels a pending retry
immediately.

#### Why POST is special

**POSTs are never blind-retried.** A POST that timed out may still have gone
through — and a duplicated `environments.launch` provisions a **second EC2
box on your AWS bill**. A POST becomes retryable only when the request
carries an `Idempotency-Key` header, which makes a server-side replay return
the original result instead of acting twice. `environments.launch` supports
this via `idempotencyKey`:

```ts
await slothbox.environments.launch(
  { orgId, body: { templateId } },
  { idempotencyKey: 'launch-7c2a' }, // safe to retry — and now the SDK will
);
```

PATCH gets the same conservative treatment: not retried unless you attach an
`Idempotency-Key` header yourself (via per-request `headers`).

When retries exhaust, the normal typed error is thrown with `retryContext`
attached — `{ attempts, maxRetries, lastRetryAfter, totalDelayMs }` — so an
exhausted `RateLimitError` tells you how many attempts were made and the last
`Retry-After` the API sent.

#### Rate limits are a normal operating condition

Service-account keys get a much higher per-key request budget than personal
keys, but the **org-scoped tiers still bite** under automation: compute
operations are limited to 10/min **and 60/hr** per org, assume-role to
20/min, GitHub operations to 30/min (see the
[rate-limiting docs](https://docs.slothbox.dev/rate-limiting)). A queue
worker fanning out launches will see 429s in routine operation — that is what
this middleware is for. One caveat: when the hourly compute tier trips, the
API can send a `Retry-After` far above the 30 s backoff cap; retries will
exhaust quickly, so catch the `RateLimitError`, read `err.retryAfter` (and
`err.retryContext`), and schedule the work instead of spinning.

### Pagination

Cursor-based lists (`audit.listOrgEvents`, `audit.listMyEvents`,
`audit.listApiKeyEvents`, `webhooks.listDeliveries`) resolve to a
`CursorPage`: the typed page body plus `for await` auto-iteration across
pages.

```ts
const page = await slothbox.audit.listOrgEvents({ orgId, query: { limit: 100 } });

page.items;          // this page's events
page.hasNextPage();  // and page.getNextPage() for manual paging

for await (const event of page) {
  // transparently fetches subsequent pages
}
```

### Lifecycle waiters & safe launch

Launching a box or baking a template is asynchronous on the API side — the
SDK ships waiters that encode each lifecycle so you don't have to:

```ts
// "launch a box and use it when ready", in one call:
const box = await slothbox.environments.launchAndWait({
  orgId,
  body: { templateId, name: 'ci-runner' },
});

// or compose the pieces yourself:
await slothbox.templates.waitUntilBaked({ orgId, templateId });   // after create/rebake
await slothbox.environments.waitUntilReady({ orgId, envId });     // after launch/start
await slothbox.environments.waitUntilStopped({ orgId, envId });   // after stop
```

The status graphs the waiters encode (from the pinned spec):

| Resource | Transitional (keeps polling) | Target | Terminal → `WaiterStateError` |
| --- | --- | --- | --- |
| `waitUntilReady` | `pending`, `provisioning` | `running` | `stopping`, `stopped`, `terminating`, `terminated`, `failed` |
| `waitUntilStopped` | `pending`, `provisioning`, `running`, `stopping` | `stopped` | `terminating`, `terminated`, `failed` |
| `waitUntilBaked` | `bundle_building` | `ready` | `bundle_failed`, `draft` (no bake in flight) |

Landing in a terminal state throws a `WaiterStateError` **immediately**
(carrying the observed `status`, plus the environment's `statusReason` when
the API sent one) instead of spinning to the deadline. Exhausting the overall
timeout throws a `WaiterTimeoutError` (carrying `lastStatus`); a final poll is
always made at the deadline first. Every waiter takes an `AbortSignal` via
`options.signal`.

**Polling pace.** Launches and bakes are limited by an org-wide *compute* rate
tier (10 requests/min, 60/hr) because they drive real EC2 in your AWS account,
and the status reads assume-role into that same account. Waiters therefore
poll every **7s, backing off ×1.5 toward a 30s ceiling** — at most 5 polls in
the first minute and ~24 reads across a full default 10-minute wait, leaving
the org's compute budget for actual launches. Defaults: 10-minute timeout for
environment waiters (real launches usually take 2–4 minutes), 20 minutes for
`waitUntilBaked` (bakes usually take 4–6, but AMI capture can run long). All
overridable per call via `timeoutMs` / `pollIntervalMs` / `maxPollIntervalMs`.

**`launchAndWait` and idempotency.** The launch POST always carries an
`Idempotency-Key` header — auto-generated with `crypto.randomUUID()` when you
don't pass `options.idempotencyKey`. Retrying a launch with the same key
returns the original box instead of starting a duplicate, and the key is what
makes the POST safe for the SDK's retry middleware (SLO-133), which only
retries POSTs that carry one. Pass your own stable key to deduplicate
launches across process restarts.

**Auto-sleep: "ready once" ≠ "running forever".** A box that
`waitUntilReady` resolved can later be stopped by the org's auto-sleep policy
(idle auto-stop and scheduled sleep windows). Treat a resolved waiter as a
statement about *now*: re-check with `environments.get()` before relying on a
box you launched a while ago, or subscribe to `environment.stopped` webhook
events (`slothbox.webhooks`) to observe sleeps as they happen — and
`environments.start()` + `waitUntilReady` to wake the box back up.

The standalone functions (`waitUntilEnvironmentReady`,
`waitUntilEnvironmentStopped`, `waitUntilTemplateBaked`,
`launchEnvironmentAndWait`) are also exported for use without the resource
surface.

## Verifying webhooks

Slothbox signs every webhook delivery with the open
[Standard Webhooks](https://www.standardwebhooks.com/) scheme: a
`webhook-signature` header carrying `v1,<base64 HMAC-SHA256>` over
`` `${webhook-id}.${webhook-timestamp}.${rawBody}` ``, keyed by your endpoint's
`whsec_…` secret. The SDK verifies all of it for you — constant-time signature
comparison, the 5-minute timestamp replay window, and rotation overlaps (the
header carries a space-delimited list of signatures while a rotated secret is
still valid; a match against any one of them passes).

```ts
import { parseWebhookEvent, WebhookVerificationError } from '@slothbox/sdk';

const event = await parseWebhookEvent(rawBody, headers, secret);
// `event` is the typed WebhookEvent union — switch on event.type:
switch (event.type) {
  case 'environment.started':
    console.log(`${event.data.resource.id} is running`);
    break;
  case 'webhook.endpoint.disabled':
    console.warn(`endpoint ${event.data.endpointId} disabled: ${event.data.reason}`);
    break;
  default:
    // Slothbox adds event types over time ('*' subscriptions receive them
    // immediately); they still verify and parse — don't treat as an error.
    break;
}
```

`verifyWebhook(rawBody, headers, secret)` does the same verification but
returns the parsed JSON without narrowing. Both throw a typed
`WebhookVerificationError` (with a machine-readable `code`) on any failure.

### Always verify the RAW body

The signature covers the **exact bytes Slothbox sent**. The classic mistake is
letting your framework parse the JSON and then re-serializing it
(`JSON.stringify(req.body)`): key order and whitespace change, the HMAC no
longer matches, and every delivery fails verification. Always hand the SDK the
unparsed body.

### Express

Use `express.raw()` for the webhook route — **not** `express.json()`:

```ts
import express from 'express';
import { parseWebhookEvent, WebhookVerificationError } from '@slothbox/sdk';

const app = express();

app.post(
  '/webhooks/slothbox',
  express.raw({ type: 'application/json' }), // req.body stays a Buffer
  async (req, res) => {
    let event;
    try {
      event = await parseWebhookEvent(
        req.body, // the raw bytes — never JSON.stringify(req.body)
        req.headers,
        process.env.SLOTHBOX_WEBHOOK_SECRET!,
      );
    } catch (err) {
      if (err instanceof WebhookVerificationError) {
        return res.status(400).send(`invalid webhook: ${err.code}`);
      }
      throw err;
    }
    // Delivery is at-least-once: dedupe on event.id before acting.
    res.sendStatus(200); // ack fast; do slow work asynchronously
  },
);
```

If you use a global `express.json()`, exclude the webhook route from it or
mount the raw parser first — once `express.json()` has consumed the stream,
the original bytes are gone.

### Cloudflare Workers

Read the body with `request.text()` (which preserves the exact bytes), not
`request.json()`:

```ts
import { parseWebhookEvent, WebhookVerificationError } from '@slothbox/sdk';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const rawBody = await request.text(); // NOT request.json()
    let event;
    try {
      event = await parseWebhookEvent(rawBody, request.headers, env.SLOTHBOX_WEBHOOK_SECRET);
    } catch (err) {
      if (err instanceof WebhookVerificationError) {
        return new Response(`invalid webhook: ${err.code}`, { status: 400 });
      }
      throw err;
    }
    // handle `event`…
    return new Response('ok');
  },
};
```

The same pattern works on Deno, Bun, and any other runtime with WebCrypto and
`fetch` — the toolkit uses `crypto.subtle` only, no Node-specific APIs.

### Shared test vectors

The verifier is tested against
[`src/webhook-signing-vectors.json`](src/webhook-signing-vectors.json), a file
generated by the **actual production signing code** in `sloth-box/api`
(`npm run vectors:webhooks` there) and checked into both repos. The api repo
asserts its signer still produces those exact bytes; this repo asserts the
verifier accepts/rejects them — so the two implementations cannot drift apart
silently. Never edit the file by hand.

## Examples

Runnable, CI-typechecked examples live in [`examples/`](examples/):

- [`ephemeral-worker.ts`](examples/ephemeral-worker.ts) — launch a box per
  task, do work, **always** terminate: the scale-to-zero pattern, with the
  idempotent-launch and guaranteed/confirmed-terminate idioms baked in.
- [`webhook-receiver-express.ts`](examples/webhook-receiver-express.ts) /
  [`webhook-receiver-cloudflare-worker.ts`](examples/webhook-receiver-cloudflare-worker.ts)
  — verified webhook receivers: raw-body handling done right, fast ack,
  idempotent handling.
- [`env-config-sync.ts`](examples/env-config-sync.ts) — push secrets and
  variables from CI into an org, idempotently.

Each runs with just `SLOTHBOX_API_KEY` set (plus the obvious resource ids) —
env contracts and cost-safety notes in [`examples/README.md`](examples/README.md).

## Development

```sh
npm ci
npm run generate       # regenerate src/generated/ from the pinned openapi.json
npm run lint           # strict tsc, no emit
npm test               # vitest (unit — fast, offline, runs per-PR)
npm run build          # tsup → dist/ (ESM + CJS + .d.ts/.d.cts)
npm run check:package  # publint + arethetypeswrong against the packed tarball
```

## Live integration tests

`npm run test:integration` (own config: `vitest.integration.config.ts`) runs
the SLO-136 suite against **production**, inside the dedicated fixture org
from the SLO-123 provisioning runbook (`sloth-box/ops`). It is **not** part of
per-PR CI — it runs on a daily schedule + `workflow_dispatch` via
`.github/workflows/integration.yml`.

Environment contract (the runbook's step 6 sets these on the repo):

| Variable | Meaning |
| --- | --- |
| `SLOTHBOX_SDK_TEST_KEY` | Fixture org service-account key (`sk_…`) — **secret** |
| `SLOTHBOX_SDK_TEST_ORG_ID` | Fixture orgId |
| `SLOTHBOX_SDK_TEST_TEMPLATE_ID` | The baked minimal template's id |
| `SLOTHBOX_API_BASE_URL` | Optional — default `https://api.slothbox.dev` |

**No key ⇒ clean skip.** Without `SLOTHBOX_SDK_TEST_KEY` the live tests skip
with a one-line reason (the fixture org is provisioned by a human checklist
and may not exist yet); the dry-run teardown-mechanics tests in
`test/integration/helpers.test.ts` still run, so the command is always
meaningful. A key without the ids fails loudly — that's a misconfiguration,
not an unprovisioned fixture.

Coverage: auth + error taxonomy (401/404/403 → typed errors), CRUD over
template metadata (drafts — no bake cost), env-config, and webhook endpoints,
a webhook ping verified through the deliveries API (no public receiver in CI;
signature scheme verified locally), and ONE full box lifecycle
(launch → running → stop → stopped → terminate → terminated).

Cost discipline — the suite spends real sandbox-account money:

- Single box per run; everything serialized (`fileParallelism: false`); polls
  ≥7s apart; at most 3 ops per run on the org's shared compute rate tier
  (10/min, 60/hr).
- Every created resource is named `sdk-ci-<runId>-…` and registered on a
  cleanup stack the moment it exists; `afterAll` drains the stack even on
  assertion failure and verifies termination by polling to a terminal state.
- A belt-and-braces sweep runs at suite start **and** end, terminating any
  leftover `sdk-ci-` boxes and deleting leftover `sdk-ci-` webhooks/templates
  and `SDK_CI_` env-config from previous runs. Teardown failure fails the
  suite loudly — a leaked box is standing AWS spend.

## Releasing

Versions, changelog, and npm publishing are fully automated from conventional
commits (release-please + npm trusted publishing with provenance). See
[RELEASING.md](./RELEASING.md).

## Generated types

`src/generated/api.ts` is generated from the **pinned** `openapi.json` checked
into this repo (so builds are reproducible — never from a network fetch at
build time) by [`openapi-typescript`](https://github.com/openapi-ts/openapi-typescript),
pinned to an exact version in `devDependencies`. Generation is deterministic:
the same spec and generator version produce byte-identical output, and CI
regenerates on every run and fails if the committed output is stale.

Method/type naming comes straight from the spec's `operationId`s (the
generated `operations` interface is keyed by them); `npm run generate` hard-fails
if any published operation is missing one or duplicates another. Never edit
`src/generated/` by hand. The core client (SLO-127) builds its conventions
layer on these types.

### Updating the pinned spec

The spec is published by `sloth-box/api`'s deploy workflow on every push to
its `main`:

```sh
curl -fsSL https://slothbox-api-publicassetsbucket-mjdmnco0nf5t.s3.eu-west-2.amazonaws.com/openapi.json \
  -o openapi.json
npm run generate
git diff src/generated   # review the API-surface diff, not just the spec diff
git add openapi.json src/generated
git commit -m "chore: refresh pinned OpenAPI spec"
```

Always commit `openapi.json` and `src/generated/` together — CI rejects one
without the other.

> **Until the api spec stack (SLO-113/114/115) merges:** the published spec at
> the URL above does not yet carry `operationId`s, so `npm run generate` will
> (correctly) refuse it. The spec pinned here was taken from that unmerged
> branch; refresh from the published URL once the stack lands.

### Automated regeneration loop

You normally don't run the manual procedure above: the **Spec regeneration**
workflow (`.github/workflows/regen.yml`, daily + `workflow_dispatch`) fetches
the published spec, exits quietly when it matches the pinned copy, and
otherwise regenerates and opens a PR (branch `regen/spec-YYYYMMDD`; re-runs
update the existing open regen PR rather than stacking duplicates). The PR
body carries an operation-level diff (`METHOD path -> operationId`, added /
removed / renamed, plus parameter and required-field changes per operation)
computed by `scripts/spec-diff.mjs` (also runnable by hand:
`npm run spec:diff -- old.json new.json`). Changes that trip the
breaking-change heuristics — removed operation/path, renamed operationId,
new required parameter/field, type change, removed response field — are
flagged in a ⚠️ section at the top and tagged with the
`breaking-spec-change` label so a human gates the merge; additive-only
changes get a routine note.

Until the api spec stack deploys (see the note above), the regeneration job
**fails by design** when the published spec changes, because `npm run
generate` rejects a spec without `operationId`s — the job error says exactly
that. The loop goes green once the api stack lands on its `main`.
