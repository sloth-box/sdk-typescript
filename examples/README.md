# @slothbox/sdk examples

Runnable, CI-typechecked examples covering the jobs the API plan is bought
for — ephemeral compute, webhook consumption, and CI-driven configuration —
with the cost-safety idioms (idempotent launch, guaranteed terminate) baked
into the code you'll copy.

Every example needs only `SLOTHBOX_API_KEY` set, plus the obvious resource
ids. **Each file documents its full env contract in the header comment** —
that header is the contract, the tables below are the summary.

## Setup

The examples import `@slothbox/sdk` exactly as a customer would; the import
resolves through a `file:..` dependency to this repo's **built** package, so
build the SDK first:

```sh
# from the repo root
npm ci && npm run build

# then
cd examples && npm ci
```

## The examples

| Example | What it shows | Run |
| --- | --- | --- |
| [`ephemeral-worker.ts`](ephemeral-worker.ts) | Launch a box per task, do work, **always** terminate — the scale-to-zero pattern | `npm run ephemeral-worker` |
| [`webhook-receiver-express.ts`](webhook-receiver-express.ts) | Verified webhook receiver on Node/Express: raw body, fast ack, dedupe | `npm run webhook-receiver-express` |
| [`webhook-receiver-cloudflare-worker.ts`](webhook-receiver-cloudflare-worker.ts) | The same receiver as a Cloudflare Worker (`request.text()` + `ctx.waitUntil`) | deploy via Wrangler (see file header) |
| [`env-config-sync.ts`](env-config-sync.ts) | Push secrets/variables from CI into an org, idempotently | `npm run env-config-sync` |

### `ephemeral-worker.ts`

| Variable | | |
| --- | --- | --- |
| `SLOTHBOX_API_KEY` | required | `sk_…` service-account key |
| `SLOTHBOX_ORG_ID` | required | org to launch in |
| `SLOTHBOX_TEMPLATE_ID` | required | a baked (`ready`) template |
| `SLOTHBOX_TASK_ID` | optional | stable task id → stable `Idempotency-Key` |
| `SLOTHBOX_BASE_URL` | optional | API base URL override |

**Cost safety — why this example is shaped the way it is.** A leaked box
bills until someone notices. So: the launch carries an `Idempotency-Key`
derived from the task id (a retried task re-attaches to the original box
instead of paying for a second one); everything after the launch runs inside
`try/finally` so termination happens on every failure path (failed waiter,
failed work, timeout); and termination is **confirmed** by polling until the
box reports `terminated` — the process exits non-zero if it can't confirm.

### `webhook-receiver-express.ts` / `webhook-receiver-cloudflare-worker.ts`

| Variable | | |
| --- | --- | --- |
| `SLOTHBOX_WEBHOOK_SECRET` | required | the endpoint's `whsec_…` signing secret (a Worker secret in the Cloudflare variant) |
| `PORT` | optional (Express only) | listen port, default 3000 |

Both variants enforce the three rules of webhook receiving: verify the **raw
body** (`express.raw()` / `request.text()` — never parse-then-restringify),
**ack fast** and do the work after the response, and handle events
**idempotently** by deduping on `event.id` (delivery is at-least-once). The
event switch includes `webhook.endpoint.disabled` — the one event you must
treat as an incident, because it means deliveries to you have stopped — and a
`default` branch for event types newer than your SDK version.

### `env-config-sync.ts`

| Variable | | |
| --- | --- | --- |
| `SLOTHBOX_API_KEY` | required | `sk_…` service-account key with the **owner** role |
| `SLOTHBOX_ORG_ID` | required | org to sync into |
| `SLOTHBOX_BASE_URL` | optional | API base URL override |
| `DATABASE_URL`, `SENTRY_DSN` | optional | synced as org-scope **secrets** when set |
| `LOG_LEVEL` | optional | synced as an org-scope **variable** when set |

Re-running is safe by construction: the API's PUT is an upsert. Mind the
scope warnings in the file header — org scope reaches **every** box in the
org, narrower scopes (environment > template > repo > org) override it, and
`variable` values are readable by org members (secrets are write-only).

## Why these can't rot

CI typechecks `examples/` (`tsc --noEmit -p examples`) against the **built**
package — the `@slothbox/sdk` import resolves through the root `package.json`
`exports` to `dist/*.d.ts`, the same way an npm consumer resolves it. A
breaking change to the SDK surface fails the build until the examples are
updated.

Example-only dependencies (Express, `tsx`, `@types/*`) live in this
directory's own `package.json` — the SDK package itself stays
zero-runtime-dependency and its devDeps unpolluted.
