# @slothbox/sdk

Official TypeScript SDK for the [Slothbox](https://slothbox.dev) API.

> **Status: pre-release scaffold — not yet published to npm.** This repo
> currently contains the package skeleton only (SLO-124); the client runtime
> is in progress (SLO-127). Do not depend on it yet.

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

## Usage (preview — not implemented yet)

```ts
import { SlothboxClient } from '@slothbox/sdk';

const slothbox = new SlothboxClient({ apiKey: process.env.SLOTHBOX_API_KEY! });
```

## Development

```sh
npm ci
npm run lint           # strict tsc, no emit
npm test               # vitest
npm run build          # tsup → dist/ (ESM + CJS + .d.ts/.d.cts)
npm run check:package  # publint + arethetypeswrong against the packed tarball
```
