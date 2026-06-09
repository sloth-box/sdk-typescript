#!/usr/bin/env node
/**
 * Operation-level OpenAPI spec diff with breaking-change heuristics (SLO-130).
 *
 * Compares two spec files and reports added / removed / renamed operations
 * (`METHOD path -> operationId`, same line format as sloth-box/api's
 * published-surface.txt) plus parameter / field-level changes per changed
 * operation. Used by .github/workflows/regen.yml to build the auto-PR body;
 * also runnable by hand:
 *
 *   node scripts/spec-diff.mjs <old-spec.json> <new-spec.json> [--json]
 *
 * Default output is the markdown report; --json emits the machine-readable
 * result ({ identical, breaking, added, removed, renamed, changedOps, ... }).
 *
 * BREAKING-CHANGE HEURISTICS (severity "breaking"; anything else is a
 * routine "note"). These are heuristics, not proofs — a human still reviews
 * the PR; the point is that nothing on this list slips through unlabelled:
 *
 *   - operation removed (includes whole-path removals)
 *   - operationId renamed (SDK method names derive from operationIds, so a
 *     rename is a remove+add of a generated method)
 *   - parameter removed, new required parameter, parameter made required,
 *     parameter type changed
 *   - request body: new required field, field removed, field made required,
 *     field type changed, enum values removed, content type removed
 *   - response body: field removed, field type changed
 *
 * Zero runtime deps, node:* only. Local $refs (#/components/...) are
 * resolved with cycle protection; external refs are left opaque (compared
 * by ref string).
 */

import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];
const MAX_DEPTH = 24;

// --- $ref resolution --------------------------------------------------------

function resolveRef(spec, node) {
  // Follows local $ref chains; returns { node, ref } where ref is the last
  // local $ref followed (for cycle bookkeeping), or null for inline nodes.
  let ref = null;
  let hops = 0;
  while (node && typeof node === 'object' && typeof node.$ref === 'string') {
    if (!node.$ref.startsWith('#/') || hops++ > 16) return { node, ref: node.$ref };
    ref = node.$ref;
    let target = spec;
    for (const part of ref.slice(2).split('/')) {
      target = target?.[part.replaceAll('~1', '/').replaceAll('~0', '~')];
    }
    if (target === undefined) return { node: {}, ref };
    node = target;
  }
  return { node, ref };
}

function normalizeType(schema) {
  // OpenAPI 3.1 allows type arrays (e.g. ["string","null"]); normalize for
  // comparison. undefined type compares as "unspecified" and never trips
  // the type-change heuristic on its own.
  const t = schema?.type;
  if (t === undefined) return undefined;
  return Array.isArray(t) ? [...t].sort().join('|') : String(t);
}

// --- Schema diff -------------------------------------------------------------

/**
 * Walks two (ref-resolved) schemas and appends findings.
 * direction: 'request' (client sends — additions can break callers) or
 * 'response' (client receives — removals can break callers).
 */
function diffSchema(ctx, oldSchema, newSchema, where, depth = 0) {
  if (depth > MAX_DEPTH) return;
  const oldR = resolveRef(ctx.oldSpec, oldSchema);
  const newR = resolveRef(ctx.newSpec, newSchema);
  if (oldR.ref !== null && newR.ref !== null) {
    const pairKey = `${oldR.ref}=>${newR.ref}@${ctx.direction}`;
    if (ctx.seenRefPairs.has(pairKey)) return; // cycle — already compared
    ctx.seenRefPairs.add(pairKey);
  }
  const o = oldR.node;
  const n = newR.node;
  if (!o || !n || typeof o !== 'object' || typeof n !== 'object') return;

  const oldType = normalizeType(o);
  const newType = normalizeType(n);
  if (oldType !== undefined && newType !== undefined && oldType !== newType) {
    ctx.add('breaking', `${where}: type changed \`${oldType}\` → \`${newType}\``);
    return; // structure diverged; deeper comparison would be noise
  }

  // Enum narrowing: a request value the client used to be allowed to send.
  if (Array.isArray(o.enum) && Array.isArray(n.enum)) {
    const removed = o.enum.filter((v) => !n.enum.includes(v));
    const added = n.enum.filter((v) => !o.enum.includes(v));
    if (removed.length > 0) {
      const sev = ctx.direction === 'request' ? 'breaking' : 'note';
      ctx.add(sev, `${where}: enum values removed: ${removed.map((v) => `\`${JSON.stringify(v)}\``).join(', ')}`);
    }
    if (added.length > 0) {
      ctx.add('note', `${where}: enum values added: ${added.map((v) => `\`${JSON.stringify(v)}\``).join(', ')}`);
    }
  }

  // Object properties.
  const oldProps = o.properties ?? {};
  const newProps = n.properties ?? {};
  const oldRequired = new Set(Array.isArray(o.required) ? o.required : []);
  const newRequired = new Set(Array.isArray(n.required) ? n.required : []);
  for (const name of new Set([...Object.keys(oldProps), ...Object.keys(newProps)])) {
    const at = `${where}.\`${name}\``;
    const inOld = Object.hasOwn(oldProps, name);
    const inNew = Object.hasOwn(newProps, name);
    if (inOld && !inNew) {
      ctx.add('breaking', `${at}: field removed`);
    } else if (!inOld && inNew) {
      if (newRequired.has(name) && ctx.direction === 'request') {
        ctx.add('breaking', `${at}: new required field`);
      } else {
        ctx.add('note', `${at}: new ${newRequired.has(name) ? 'required ' : 'optional '}field`);
      }
    } else {
      if (!oldRequired.has(name) && newRequired.has(name)) {
        ctx.add(ctx.direction === 'request' ? 'breaking' : 'note', `${at}: field made required`);
      } else if (oldRequired.has(name) && !newRequired.has(name)) {
        ctx.add('note', `${at}: field no longer required${ctx.direction === 'response' ? ' (response no longer guarantees it)' : ''}`);
      }
      diffSchema(ctx, oldProps[name], newProps[name], at, depth + 1);
    }
  }

  // Array items.
  if (o.items || n.items) {
    diffSchema(ctx, o.items ?? {}, n.items ?? {}, `${where}[]`, depth + 1);
  }
}

function diffSchemaPair(oldSpec, newSpec, oldSchema, newSchema, direction, where, add) {
  const ctx = { oldSpec, newSpec, direction, seenRefPairs: new Set(), add };
  diffSchema(ctx, oldSchema ?? {}, newSchema ?? {}, where);
}

// --- Operation surface --------------------------------------------------------

/** Map of "METHOD path" -> { method, path, operationId, op, params } */
export function operationSurface(spec) {
  const ops = new Map();
  for (const [path, pathItem] of Object.entries(spec.paths ?? {})) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    const pathParams = Array.isArray(pathItem.parameters) ? pathItem.parameters : [];
    for (const method of HTTP_METHODS) {
      const op = pathItem[method];
      if (!op || typeof op !== 'object') continue;
      // Op-level parameters override path-level ones with the same name+in.
      const params = new Map();
      for (const list of [pathParams, Array.isArray(op.parameters) ? op.parameters : []]) {
        for (const raw of list) {
          const p = resolveRef(spec, raw).node;
          if (p?.name && p?.in) params.set(`${p.in}:${p.name}`, p);
        }
      }
      ops.set(`${method.toUpperCase()} ${path}`, {
        method: method.toUpperCase(),
        path,
        operationId: op.operationId ?? null,
        op,
        params,
      });
    }
  }
  return ops;
}

/** published-surface.txt-style line: "GET /hello -> getHealth" */
function surfaceLine({ method, path, operationId }) {
  return `${method} ${path} -> ${operationId ?? '(no operationId)'}`;
}

// --- Operation diff -----------------------------------------------------------

function diffParameters(oldSpec, newSpec, oldEntry, newEntry, add) {
  for (const key of new Set([...oldEntry.params.keys(), ...newEntry.params.keys()])) {
    const oldP = oldEntry.params.get(key);
    const newP = newEntry.params.get(key);
    const label = (p) => `${p.in} parameter \`${p.name}\``;
    if (oldP && !newP) {
      add('breaking', `${label(oldP)} removed`);
    } else if (!oldP && newP) {
      if (newP.required) add('breaking', `new required ${label(newP)}`);
      else add('note', `new optional ${label(newP)}`);
    } else {
      if (!oldP.required && newP.required) add('breaking', `${label(newP)} made required`);
      else if (oldP.required && !newP.required) add('note', `${label(newP)} no longer required`);
      const oldT = normalizeType(resolveRef(oldSpec, oldP.schema ?? {}).node);
      const newT = normalizeType(resolveRef(newSpec, newP.schema ?? {}).node);
      if (oldT !== undefined && newT !== undefined && oldT !== newT) {
        add('breaking', `${label(newP)} type changed \`${oldT}\` → \`${newT}\``);
      }
    }
  }
}

function diffRequestBody(oldSpec, newSpec, oldOp, newOp, add) {
  const oldBody = resolveRef(oldSpec, oldOp.requestBody ?? {}).node ?? {};
  const newBody = resolveRef(newSpec, newOp.requestBody ?? {}).node ?? {};
  const oldContent = oldBody.content ?? {};
  const newContent = newBody.content ?? {};
  if (oldOp.requestBody && !oldBody.required && newBody.required) {
    add('breaking', 'request body made required');
  }
  for (const mime of new Set([...Object.keys(oldContent), ...Object.keys(newContent)])) {
    if (oldContent[mime] && !newContent[mime]) {
      add('breaking', `request body content type \`${mime}\` removed`);
    } else if (!oldContent[mime] && newContent[mime]) {
      add(oldOp.requestBody ? 'note' : newBody.required ? 'breaking' : 'note',
        `request body${oldOp.requestBody ? ` content type \`${mime}\`` : ''} added${newBody.required ? ' (required)' : ''}`);
    } else {
      diffSchemaPair(oldSpec, newSpec, oldContent[mime].schema, newContent[mime].schema,
        'request', 'request body', add);
    }
  }
}

function diffResponses(oldSpec, newSpec, oldOp, newOp, add) {
  const oldResp = oldOp.responses ?? {};
  const newResp = newOp.responses ?? {};
  for (const status of new Set([...Object.keys(oldResp), ...Object.keys(newResp)])) {
    if (oldResp[status] && !newResp[status]) {
      add(/^2/.test(status) ? 'breaking' : 'note', `response \`${status}\` removed`);
    } else if (!oldResp[status] && newResp[status]) {
      add('note', `response \`${status}\` added`);
    } else {
      const o = resolveRef(oldSpec, oldResp[status]).node ?? {};
      const n = resolveRef(newSpec, newResp[status]).node ?? {};
      for (const mime of new Set([...Object.keys(o.content ?? {}), ...Object.keys(n.content ?? {})])) {
        diffSchemaPair(oldSpec, newSpec, o.content?.[mime]?.schema, n.content?.[mime]?.schema,
          'response', `response \`${status}\``, add);
      }
    }
  }
}

// --- Top-level diff -------------------------------------------------------------

/**
 * @returns {{
 *   identical: boolean, breaking: boolean,
 *   added: string[], removed: string[],
 *   renamed: {key: string, from: string|null, to: string|null}[],
 *   changedOps: {key: string, operationId: string|null, findings: {severity: string, message: string}[]}[],
 *   breakingFindings: string[],
 * }}
 */
export function diffSpecs(oldSpec, newSpec) {
  const oldOps = operationSurface(oldSpec);
  const newOps = operationSurface(newSpec);
  const added = [];
  const removed = [];
  const renamed = [];
  const changedOps = [];
  const breakingFindings = [];

  for (const key of [...new Set([...oldOps.keys(), ...newOps.keys()])].sort()) {
    const oldEntry = oldOps.get(key);
    const newEntry = newOps.get(key);
    if (oldEntry && !newEntry) {
      removed.push(surfaceLine(oldEntry));
      breakingFindings.push(`\`${key}\` (\`${oldEntry.operationId ?? '?'}\`): operation removed`);
      continue;
    }
    if (!oldEntry && newEntry) {
      added.push(surfaceLine(newEntry));
      continue;
    }

    const findings = [];
    const add = (severity, message) => findings.push({ severity, message });
    if (oldEntry.operationId !== newEntry.operationId) {
      renamed.push({ key, from: oldEntry.operationId, to: newEntry.operationId });
      add('breaking',
        `operationId renamed \`${oldEntry.operationId ?? '(none)'}\` → \`${newEntry.operationId ?? '(none)'}\` (renames the generated SDK method)`);
    }
    diffParameters(oldSpec, newSpec, oldEntry, newEntry, add);
    diffRequestBody(oldSpec, newSpec, oldEntry.op, newEntry.op, add);
    diffResponses(oldSpec, newSpec, oldEntry.op, newEntry.op, add);

    if (findings.length > 0) {
      changedOps.push({ key, operationId: newEntry.operationId, findings });
      for (const f of findings) {
        if (f.severity === 'breaking') {
          breakingFindings.push(`\`${key}\` (\`${newEntry.operationId ?? '?'}\`): ${f.message}`);
        }
      }
    }
  }

  return {
    identical: added.length === 0 && removed.length === 0 && changedOps.length === 0,
    breaking: breakingFindings.length > 0,
    added,
    removed,
    renamed,
    changedOps,
    breakingFindings,
  };
}

// --- Markdown report --------------------------------------------------------------

export function renderMarkdown(result) {
  const lines = [];
  if (result.identical) {
    lines.push('### No operation-level changes detected');
    lines.push('');
    lines.push(
      'The specs differ only below the operation surface this tool inspects ' +
        '(descriptions, examples, metadata, …). Review the raw `openapi.json` diff.',
    );
    return lines.join('\n');
  }

  if (result.breaking) {
    lines.push('### ⚠️ Breaking-change heuristics tripped — human review required');
    lines.push('');
    for (const f of result.breakingFindings) lines.push(`- ⚠️ ${f}`);
  } else {
    lines.push('### Routine spec change');
    lines.push('');
    lines.push('No breaking-change heuristics tripped (additive-only). Still review the surface diff below.');
  }
  lines.push('');

  const surfaceBlock = (title, entries) => {
    lines.push(`### ${title} (${entries.length})`);
    lines.push('');
    lines.push('```');
    for (const e of entries) lines.push(e);
    lines.push('```');
    lines.push('');
  };
  if (result.added.length > 0) surfaceBlock('Operations added', result.added);
  if (result.removed.length > 0) surfaceBlock('Operations removed', result.removed);
  if (result.renamed.length > 0) {
    lines.push(`### Operations renamed (${result.renamed.length})`);
    lines.push('');
    for (const r of result.renamed) {
      lines.push(`- \`${r.key}\`: \`${r.from ?? '(none)'}\` → \`${r.to ?? '(none)'}\``);
    }
    lines.push('');
  }
  if (result.changedOps.length > 0) {
    lines.push(`### Changed operations (${result.changedOps.length})`);
    lines.push('');
    for (const op of result.changedOps) {
      lines.push(`#### \`${op.key}\` (\`${op.operationId ?? '?'}\`)`);
      lines.push('');
      for (const f of op.findings) {
        lines.push(`- ${f.severity === 'breaking' ? '⚠️ ' : ''}${f.message}`);
      }
      lines.push('');
    }
  }
  return lines.join('\n').trimEnd();
}

// --- CLI -------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const files = args.filter((a) => !a.startsWith('--'));
  if (files.length !== 2) {
    console.error('usage: node scripts/spec-diff.mjs <old-spec.json> <new-spec.json> [--json]');
    process.exit(2);
  }
  let oldSpec, newSpec;
  try {
    [oldSpec, newSpec] = await Promise.all(
      files.map(async (f) => JSON.parse(await readFile(f, 'utf8'))),
    );
  } catch (err) {
    console.error(`spec-diff: cannot read specs: ${err.message}`);
    process.exit(2);
  }
  const result = diffSpecs(oldSpec, newSpec);
  console.log(json ? JSON.stringify(result, null, 2) : renderMarkdown(result));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
