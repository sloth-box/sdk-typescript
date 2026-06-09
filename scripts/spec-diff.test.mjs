// Unit tests for scripts/spec-diff.mjs (SLO-130). Run via `npm test` (vitest).
import { describe, expect, it } from 'vitest';
import { diffSpecs, renderMarkdown } from './spec-diff.mjs';

/** Minimal valid spec with one GET /boxes operation; deep-cloneable. */
function baseSpec() {
  return {
    openapi: '3.1.0',
    info: { title: 'Slothbox API', version: '0.1.0' },
    paths: {
      '/boxes': {
        get: {
          operationId: 'listBoxes',
          parameters: [
            { name: 'orgId', in: 'query', required: true, schema: { type: 'string' } },
          ],
          responses: {
            200: {
              description: 'OK',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/BoxList' },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        BoxList: {
          type: 'object',
          required: ['boxes'],
          properties: {
            boxes: { type: 'array', items: { $ref: '#/components/schemas/Box' } },
            nextToken: { type: 'string' },
          },
        },
        Box: {
          type: 'object',
          required: ['id', 'state'],
          properties: {
            id: { type: 'string' },
            state: { type: 'string', enum: ['pending', 'running', 'stopped'] },
            // self-reference exercises $ref cycle protection
            parent: { $ref: '#/components/schemas/Box' },
          },
        },
      },
    },
  };
}

const clone = (spec) => structuredClone(spec);

describe('diffSpecs', () => {
  it('reports identical specs as identical and non-breaking', () => {
    const result = diffSpecs(baseSpec(), baseSpec());
    expect(result.identical).toBe(true);
    expect(result.breaking).toBe(false);
    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
    expect(result.renamed).toEqual([]);
    expect(result.changedOps).toEqual([]);
    expect(renderMarkdown(result)).toContain('No operation-level changes');
  });

  it('flags an additive operation as routine (non-breaking)', () => {
    const next = clone(baseSpec());
    next.paths['/boxes'].post = {
      operationId: 'createBox',
      responses: { 201: { description: 'Created' } },
    };
    const result = diffSpecs(baseSpec(), next);
    expect(result.identical).toBe(false);
    expect(result.breaking).toBe(false);
    expect(result.added).toEqual(['POST /boxes -> createBox']);
    const md = renderMarkdown(result);
    expect(md).toContain('Routine spec change');
    expect(md).not.toContain('⚠️');
  });

  it('flags a removed operation as breaking', () => {
    const result = diffSpecs(baseSpec(), { ...baseSpec(), paths: {} });
    expect(result.breaking).toBe(true);
    expect(result.removed).toEqual(['GET /boxes -> listBoxes']);
    expect(result.breakingFindings.join('\n')).toContain('operation removed');
    expect(renderMarkdown(result)).toContain('⚠️ Breaking-change heuristics tripped');
  });

  it('flags a new required request-body field as breaking', () => {
    const prev = baseSpec();
    prev.paths['/boxes'].post = {
      operationId: 'createBox',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['templateId'],
              properties: { templateId: { type: 'string' } },
            },
          },
        },
      },
      responses: { 201: { description: 'Created' } },
    };
    const next = clone(prev);
    const schema = next.paths['/boxes'].post.requestBody.content['application/json'].schema;
    schema.required.push('region');
    schema.properties.region = { type: 'string' };
    const result = diffSpecs(prev, next);
    expect(result.breaking).toBe(true);
    expect(result.breakingFindings.join('\n')).toContain('new required field');
    expect(result.breakingFindings.join('\n')).toContain('region');
  });

  it('treats a new optional request-body field and response field as routine', () => {
    const next = clone(baseSpec());
    next.components.schemas.Box.properties.costEstimate = { type: 'number' };
    next.paths['/boxes'].get.parameters.push({
      name: 'limit', in: 'query', required: false, schema: { type: 'integer' },
    });
    const result = diffSpecs(baseSpec(), next);
    expect(result.identical).toBe(false);
    expect(result.breaking).toBe(false);
    const all = result.changedOps.flatMap((o) => o.findings.map((f) => f.message)).join('\n');
    expect(all).toContain('costEstimate');
    expect(all).toContain('new optional query parameter');
  });

  it('flags an operationId rename as breaking', () => {
    const next = clone(baseSpec());
    next.paths['/boxes'].get.operationId = 'listEnvironments';
    const result = diffSpecs(baseSpec(), next);
    expect(result.breaking).toBe(true);
    expect(result.renamed).toEqual([
      { key: 'GET /boxes', from: 'listBoxes', to: 'listEnvironments' },
    ]);
  });

  it('flags a new required parameter and a parameter made required as breaking', () => {
    const next = clone(baseSpec());
    next.paths['/boxes'].get.parameters.push({
      name: 'state', in: 'query', required: true, schema: { type: 'string' },
    });
    const result = diffSpecs(baseSpec(), next);
    expect(result.breaking).toBe(true);
    expect(result.breakingFindings.join('\n')).toContain('new required query parameter');

    const next2 = clone(baseSpec());
    next2.paths['/boxes'].get.parameters = [
      { name: 'orgId', in: 'query', required: true, schema: { type: 'string' } },
      { name: 'limit', in: 'query', required: true, schema: { type: 'integer' } },
    ];
    const prev2 = clone(baseSpec());
    prev2.paths['/boxes'].get.parameters.push({
      name: 'limit', in: 'query', required: false, schema: { type: 'integer' },
    });
    const result2 = diffSpecs(prev2, next2);
    expect(result2.breaking).toBe(true);
    expect(result2.breakingFindings.join('\n')).toContain('made required');
  });

  it('flags a removed response field and a type change as breaking', () => {
    const next = clone(baseSpec());
    delete next.components.schemas.BoxList.properties.nextToken;
    next.components.schemas.Box.properties.id = { type: 'integer' };
    const result = diffSpecs(baseSpec(), next);
    expect(result.breaking).toBe(true);
    const breaking = result.breakingFindings.join('\n');
    expect(breaking).toContain('`nextToken`: field removed');
    expect(breaking).toContain('type changed `string` → `integer`');
  });

  it('flags removed request enum values as breaking, terminates on $ref cycles', () => {
    const prev = baseSpec();
    prev.paths['/boxes'].post = {
      operationId: 'createBox',
      requestBody: {
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/Box' } },
        },
      },
      responses: { 201: { description: 'Created' } },
    };
    const next = clone(prev);
    next.components.schemas.Box.properties.state.enum = ['pending', 'running'];
    const result = diffSpecs(prev, next); // Box is self-referential via `parent`
    expect(result.breaking).toBe(true);
    expect(result.breakingFindings.join('\n')).toContain('enum values removed');
  });
});
