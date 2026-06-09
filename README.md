# @slothbox/sdk

Official TypeScript SDK for the [Slothbox](https://slothbox.dev) API.

> **Status: pre-release — not yet published to npm.** The core client runtime
> (auth, typed errors, pagination, the full resource surface — SLO-127), the
> webhook toolkit (SLO-128), and the release pipeline are implemented. Do not
> depend on it yet.

## Versioning

The package is on **0.x pre-GA [semver](https://semver.org/#spec-item-4)**:
anything may change between minor versions until 1.0.0. Pin an exact version
once the package is published.

## Runtime support

Built for any runtime with a WHATWG `fetch` global — Node.js 18+, Cloudflare
Workers, Deno, Bun, and modern browsers. Zero runtime dependencies, dual
ESM + CJS builds.

## Installation

Not published yet. Once it is:

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
`headers`.

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

## Development

```sh
npm ci
npm run generate       # regenerate src/generated/ from the pinned openapi.json
npm run lint           # strict tsc, no emit
npm test               # vitest
npm run build          # tsup → dist/ (ESM + CJS + .d.ts/.d.cts)
npm run check:package  # publint + arethetypeswrong against the packed tarball
```

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
