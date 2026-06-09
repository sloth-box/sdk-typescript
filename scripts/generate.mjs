#!/usr/bin/env node
/**
 * Regenerates src/generated/api.ts from the pinned openapi.json (SLO-125).
 *
 * Design constraints:
 *
 * - DETERMINISTIC: the same spec + the same (exactly pinned) generator
 *   version must produce byte-identical output. Nothing time- or
 *   environment-dependent may be written to the file — CI regenerates and
 *   fails the build on any diff.
 * - operationId is mandatory on every published operation. The SDK's method
 *   names derive from operationIds (the generated `operations` interface is
 *   keyed by them), so a missing or duplicate operationId is a hard error
 *   here rather than a silently mangled name downstream.
 * - openapi-typescript is a devDependency only; the generated file contains
 *   nothing but types, so the published package keeps zero runtime
 *   dependencies.
 */

import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import openapiTS, { astToString } from 'openapi-typescript';

const require = createRequire(import.meta.url);

const SPEC_URL = new URL('../openapi.json', import.meta.url);
const OUT_URL = new URL('../src/generated/api.ts', import.meta.url);

/** Where the spec is published by sloth-box/api's deploy workflow. */
const PUBLISHED_SPEC_URL =
  'https://slothbox-api-publicassetsbucket-mjdmnco0nf5t.s3.eu-west-2.amazonaws.com/openapi.json';

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

const spec = JSON.parse(await readFile(SPEC_URL, 'utf8'));

// --- Validate: every operation must carry a unique operationId. -----------
const seen = new Map(); // operationId -> "METHOD path"
const problems = [];
let operationCount = 0;

for (const [path, pathItem] of Object.entries(spec.paths ?? {})) {
  for (const method of HTTP_METHODS) {
    const op = pathItem?.[method];
    if (!op) continue;
    operationCount += 1;
    const where = `${method.toUpperCase()} ${path}`;
    const id = op.operationId;
    if (!id) {
      problems.push(`missing operationId: ${where}`);
    } else if (seen.has(id)) {
      problems.push(`duplicate operationId "${id}": ${where} (also ${seen.get(id)})`);
    } else {
      seen.set(id, where);
    }
  }
}

if (operationCount === 0) {
  problems.push('spec contains no operations — is openapi.json the right file?');
}

if (problems.length > 0) {
  console.error('openapi.json failed validation — SDK method names come from operationIds,');
  console.error('so every published operation must have a unique one:\n');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

// --- Generate. -------------------------------------------------------------
const generatorVersion = require('openapi-typescript/package.json').version;
const ast = await openapiTS(spec, {
  // Defaults are fine; spelled out so a future option change is a conscious,
  // reviewed diff of the generated file.
  exportType: false,
});

const header = `/**
 * Slothbox API types — GENERATED FILE, DO NOT EDIT BY HAND.
 *
 * Generated from the pinned ../../openapi.json (${operationCount} operations) by
 * openapi-typescript v${generatorVersion} via \`npm run generate\`.
 *
 * The pinned spec mirrors the published one at
 * ${PUBLISHED_SPEC_URL}
 * — see README.md ("Generated types") for the refresh procedure.
 */

`;

const output = header + astToString(ast);

await mkdir(new URL('.', OUT_URL), { recursive: true });
await writeFile(OUT_URL, output, 'utf8');

console.log(
  `Generated ${fileURLToPath(OUT_URL)} — ${operationCount} operations, ` +
    `${output.length} bytes (openapi-typescript v${generatorVersion}).`,
);
