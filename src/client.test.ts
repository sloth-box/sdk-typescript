import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cloudFormationTemplateYaml, environment } from './__fixtures__/fixtures.js';
import { createMockFetch, jsonResponse, textResponse } from './__fixtures__/mock-fetch.js';
import { APIConnectionError, SlothboxError } from './errors.js';
import { Slothbox } from './index.js';

const API_KEY = 'sk_test_0123456789';

// Tests run under Node, but the SDK (and this repo's tsconfig) is
// runtime-neutral — reach process.env through globalThis like the client does.
const nodeEnv = (globalThis as unknown as { process: { env: Record<string, string | undefined> } })
  .process.env;

describe('constructor & auth', () => {
  const savedEnvKey = nodeEnv.SLOTHBOX_API_KEY;

  beforeEach(() => {
    delete nodeEnv.SLOTHBOX_API_KEY;
  });

  afterEach(() => {
    if (savedEnvKey === undefined) delete nodeEnv.SLOTHBOX_API_KEY;
    else nodeEnv.SLOTHBOX_API_KEY = savedEnvKey;
    vi.unstubAllGlobals();
  });

  it('sends the raw API key in Authorization — no Bearer prefix', async () => {
    const mock = createMockFetch(jsonResponse(200, { hello: 'world' }));
    const client = new Slothbox({ apiKey: API_KEY, fetch: mock.fetch });
    await client.health.get();
    expect(mock.requests[0]!.headers.get('authorization')).toBe(API_KEY);
  });

  it('falls back to the SLOTHBOX_API_KEY environment variable', async () => {
    nodeEnv.SLOTHBOX_API_KEY = 'sk_from_env';
    const mock = createMockFetch(jsonResponse(200, { hello: 'world' }));
    const client = new Slothbox({ fetch: mock.fetch });
    await client.health.get();
    expect(mock.requests[0]!.headers.get('authorization')).toBe('sk_from_env');
  });

  it('prefers an explicit apiKey over the environment', async () => {
    nodeEnv.SLOTHBOX_API_KEY = 'sk_from_env';
    const mock = createMockFetch(jsonResponse(200, { hello: 'world' }));
    const client = new Slothbox({ apiKey: API_KEY, fetch: mock.fetch });
    await client.health.get();
    expect(mock.requests[0]!.headers.get('authorization')).toBe(API_KEY);
  });

  it('throws a SlothboxError when no key is available anywhere', () => {
    expect(() => new Slothbox()).toThrow(SlothboxError);
    expect(() => new Slothbox()).toThrow(/SLOTHBOX_API_KEY/);
  });

  it('defaults baseUrl to the spec server and accepts overrides', async () => {
    const mock = createMockFetch(
      jsonResponse(200, { hello: 'world' }),
      jsonResponse(200, { hello: 'world' }),
    );
    const client = new Slothbox({ apiKey: API_KEY, fetch: mock.fetch });
    expect(client.baseUrl).toBe('https://api.slothbox.dev');
    await client.health.get();
    expect(mock.requests[0]!.url.href).toBe('https://api.slothbox.dev/hello');

    const custom = new Slothbox({
      apiKey: API_KEY,
      baseUrl: 'http://localhost:3000/',
      fetch: mock.fetch,
    });
    expect(custom.baseUrl).toBe('http://localhost:3000');
    await custom.health.get();
    expect(mock.requests[1]!.url.href).toBe('http://localhost:3000/hello');
  });

  it('reports a useful error when the runtime has no global fetch', async () => {
    vi.stubGlobal('fetch', undefined);
    const client = new Slothbox({ apiKey: API_KEY });
    await expect(client.health.get()).rejects.toThrow(/no global fetch/);
  });
});

describe('request building', () => {
  it('URL-encodes path parameters', async () => {
    const mock = createMockFetch(jsonResponse(200, { environments: [] }));
    const client = new Slothbox({ apiKey: API_KEY, fetch: mock.fetch });
    await client.environments.list({ orgId: 'org/../etc' });
    expect(mock.requests[0]!.url.pathname).toBe('/organizations/org%2F..%2Fetc/environments');
  });

  it('serializes query params and skips undefined values', async () => {
    const mock = createMockFetch(jsonResponse(200, { events: [] }));
    const client = new Slothbox({ apiKey: API_KEY, fetch: mock.fetch });
    await client.audit.listOrgEvents({
      orgId: 'org_1',
      query: { limit: 50, action: 'terminate', userId: undefined },
    });
    const url = mock.requests[0]!.url;
    expect(url.pathname).toBe('/organizations/org_1/audit');
    expect(url.searchParams.get('limit')).toBe('50');
    expect(url.searchParams.get('action')).toBe('terminate');
    expect(url.searchParams.has('userId')).toBe(false);
  });

  it('JSON-encodes the body and sets content-type', async () => {
    const mock = createMockFetch(jsonResponse(201, environment));
    const client = new Slothbox({ apiKey: API_KEY, fetch: mock.fetch });
    await client.environments.launch({
      orgId: 'org_1',
      body: { templateId: 'tpl_1', name: 'checkout-dev' },
    });
    const request = mock.requests[0]!;
    expect(request.method).toBe('POST');
    expect(request.headers.get('content-type')).toBe('application/json');
    expect(JSON.parse(request.body!)).toEqual({ templateId: 'tpl_1', name: 'checkout-dev' });
  });

  it('sends no content-type or body on GETs', async () => {
    const mock = createMockFetch(jsonResponse(200, { hello: 'world' }));
    const client = new Slothbox({ apiKey: API_KEY, fetch: mock.fetch });
    await client.health.get();
    expect(mock.requests[0]!.headers.has('content-type')).toBe(false);
    expect(mock.requests[0]!.body).toBeUndefined();
  });

  it('merges per-request headers over defaults', async () => {
    const mock = createMockFetch(jsonResponse(200, { hello: 'world' }));
    const client = new Slothbox({ apiKey: API_KEY, fetch: mock.fetch });
    await client.health.get(undefined, { headers: { 'x-debug': '1', Authorization: 'sk_other' } });
    expect(mock.requests[0]!.headers.get('x-debug')).toBe('1');
    expect(mock.requests[0]!.headers.get('authorization')).toBe('sk_other');
  });

  it('passes the per-request AbortSignal through to fetch', async () => {
    const mock = createMockFetch(jsonResponse(200, { hello: 'world' }));
    const client = new Slothbox({ apiKey: API_KEY, fetch: mock.fetch });
    const controller = new AbortController();
    await client.health.get(undefined, { signal: controller.signal });
    expect(mock.requests[0]!.signal).toBe(controller.signal);
  });

  it('re-throws aborts untouched (not as APIConnectionError)', async () => {
    const mock = createMockFetch(jsonResponse(200, { hello: 'world' }));
    const client = new Slothbox({ apiKey: API_KEY, fetch: mock.fetch });
    const controller = new AbortController();
    controller.abort();
    const failure = await client.health
      .get(undefined, { signal: controller.signal })
      .then(() => null, (error: unknown) => error);
    expect((failure as Error).name).toBe('AbortError');
    expect(failure).not.toBeInstanceOf(APIConnectionError);
  });

  it('sets the Idempotency-Key header from environments.launch options', async () => {
    const mock = createMockFetch(jsonResponse(201, environment));
    const client = new Slothbox({ apiKey: API_KEY, fetch: mock.fetch });
    await client.environments.launch(
      { orgId: 'org_1', body: { templateId: 'tpl_1' } },
      { idempotencyKey: 'retry-7c2a' },
    );
    expect(mock.requests[0]!.headers.get('idempotency-key')).toBe('retry-7c2a');
  });
});

describe('response handling', () => {
  it('parses JSON responses', async () => {
    const mock = createMockFetch(jsonResponse(200, { environments: [environment] }));
    const client = new Slothbox({ apiKey: API_KEY, fetch: mock.fetch });
    const result = await client.environments.list({ orgId: 'org_1' });
    expect(result.environments[0]!.envId).toBe(environment.envId);
  });

  it('returns the CloudFormation template as a YAML string, never JSON-parsed', async () => {
    const mock = createMockFetch(textResponse(200, cloudFormationTemplateYaml, 'application/yaml'));
    const client = new Slothbox({ apiKey: API_KEY, fetch: mock.fetch });
    const template = await client.awsConnections.getTemplate();
    expect(typeof template).toBe('string');
    expect(template).toBe(cloudFormationTemplateYaml);
    expect(template).toContain('AWSTemplateFormatVersion');
  });

  it('resolves 204s to undefined', async () => {
    const mock = createMockFetch(jsonResponse(204, null));
    const client = new Slothbox({ apiKey: API_KEY, fetch: mock.fetch });
    await expect(client.organizations.delete({ orgId: 'org_1' })).resolves.toBeUndefined();
  });

  it('wraps network failures in APIConnectionError with the cause attached', async () => {
    const boom = new TypeError('fetch failed');
    const client = new Slothbox({
      apiKey: API_KEY,
      fetch: () => Promise.reject(boom),
      maxRetries: 0, // connection errors are retryable — keep this test single-shot
    });
    const failure = await client.health.get().then(() => null, (error: unknown) => error);
    expect(failure).toBeInstanceOf(APIConnectionError);
    expect((failure as APIConnectionError).cause).toBe(boom);
  });

  it('throws a SlothboxError on malformed JSON bodies', async () => {
    const mock = createMockFetch(textResponse(200, '{not json', 'application/json'));
    const client = new Slothbox({ apiKey: API_KEY, fetch: mock.fetch });
    await expect(client.health.get()).rejects.toThrow(/parse JSON/);
  });
});
