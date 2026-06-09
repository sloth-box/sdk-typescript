import { describe, expect, it } from 'vitest';
import { createMockFetch, jsonResponse, textResponse } from './__fixtures__/mock-fetch.js';
import {
  APIError,
  AuthenticationError,
  BadRequestError,
  ConflictError,
  NotFoundError,
  PermissionDeniedError,
  PlanRequiredError,
  RateLimitError,
  Slothbox,
  SlothboxError,
} from './index.js';

const REQUEST_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

/**
 * A client wired to reply with exactly these recorded responses. Retries are
 * disabled — these tests assert error mapping, not the retry policy
 * (`src/retry.test.ts`), and 429/5xx responses would otherwise be retried.
 */
function clientWith(...responses: Response[]): Slothbox {
  return new Slothbox({
    apiKey: 'sk_test',
    fetch: createMockFetch(...responses).fetch,
    maxRetries: 0,
  });
}

function envelope(message: string, code?: string, issues?: unknown) {
  return { error: { message, ...(code !== undefined ? { code } : {}), ...(issues !== undefined ? { issues } : {}) } };
}

async function capture(promise: Promise<unknown>): Promise<APIError> {
  const failure = await promise.then(() => null, (error: unknown) => error);
  expect(failure).toBeInstanceOf(APIError);
  return failure as APIError;
}

describe('status-mapped error classes', () => {
  it('401 → AuthenticationError', async () => {
    const client = clientWith(
      jsonResponse(401, envelope('Missing or invalid credentials'), {
        'x-amzn-requestid': REQUEST_ID,
      }),
    );
    const error = await capture(client.me.get());
    expect(error).toBeInstanceOf(AuthenticationError);
    expect(error.status).toBe(401);
    expect(error.message).toBe('Missing or invalid credentials');
    expect(error.requestId).toBe(REQUEST_ID);
    expect(error.code).toBeUndefined();
  });

  it('handles API Gateway-generated bare {message} bodies (authorizer 401s)', async () => {
    const client = clientWith(
      jsonResponse(401, { message: 'Unauthorized' }, { 'x-amzn-requestid': REQUEST_ID }),
    );
    const error = await capture(client.me.get());
    expect(error).toBeInstanceOf(AuthenticationError);
    expect(error.message).toBe('Unauthorized');
    expect(error.requestId).toBe(REQUEST_ID);
  });

  it('402 → PlanRequiredError', async () => {
    const client = clientWith(jsonResponse(402, envelope('API plan required')));
    const error = await capture(client.me.get());
    expect(error).toBeInstanceOf(PlanRequiredError);
    expect(error.status).toBe(402);
  });

  it('403 → PermissionDeniedError', async () => {
    const client = clientWith(jsonResponse(403, envelope('Missing audit:read permission')));
    const error = await capture(client.audit.listOrgEvents({ orgId: 'org_1' }));
    expect(error).toBeInstanceOf(PermissionDeniedError);
  });

  it('404 → NotFoundError', async () => {
    const client = clientWith(jsonResponse(404, envelope('Environment not found')));
    const error = await capture(client.environments.get({ orgId: 'org_1', envId: 'env_x' }));
    expect(error).toBeInstanceOf(NotFoundError);
    expect(error.message).toBe('Environment not found');
  });

  it('400 → BadRequestError carrying validation issues', async () => {
    const issues = { fieldErrors: { templateId: ['Required'] } };
    const client = clientWith(jsonResponse(400, envelope('Validation failed', undefined, issues)));
    const error = await capture(
      client.environments.launch({ orgId: 'org_1', body: { templateId: '' } }),
    );
    expect(error).toBeInstanceOf(BadRequestError);
    expect(error.issues).toEqual(issues);
  });

  it('409 without a code → ConflictError with code undefined', async () => {
    const client = clientWith(jsonResponse(409, envelope('Environment has been terminated')));
    const error = await capture(
      client.environments.stop({ orgId: 'org_1', envId: 'env_1' }),
    );
    expect(error).toBeInstanceOf(ConflictError);
    expect(error.code).toBeUndefined();
  });

  it('unmapped statuses → base APIError with the status exposed', async () => {
    for (const [status, message] of [
      [410, 'Invite expired'],
      [502, 'Upstream verification failed'],
    ] as const) {
      const client = clientWith(jsonResponse(status, envelope(message)));
      const error = await capture(client.me.get());
      expect(error.constructor).toBe(APIError);
      expect(error.status).toBe(status);
      expect(error.message).toBe(message);
    }
  });

  it('falls back to a status message for non-JSON error bodies', async () => {
    const client = clientWith(textResponse(503, '<html>Service Unavailable</html>', 'text/html'));
    const error = await capture(client.me.get());
    expect(error.constructor).toBe(APIError);
    expect(error.status).toBe(503);
    expect(error.message).toBe('Request failed with status 503');
  });
});

describe('code discrimination (SLO-116 envelope codes)', () => {
  it.each([
    'seat_ceiling_exceeded',
    'no_active_aws_connection',
    'template_not_baked',
    'environment_terminated',
    'environment_launching',
  ])('409 %s → ConflictError exposing the code', async (code) => {
    const client = clientWith(jsonResponse(409, envelope('Conflict', code)));
    const error = await capture(
      client.environments.launch({ orgId: 'org_1', body: { templateId: 'tpl_1' } }),
    );
    expect(error).toBeInstanceOf(ConflictError);
    expect(error.code).toBe(code);
  });

  it.each(['api_plan_required', 'api_plan_lapsed'])('%s → PlanRequiredError', async (code) => {
    const client = clientWith(jsonResponse(402, envelope('API plan needed', code)));
    const error = await capture(client.me.get());
    expect(error).toBeInstanceOf(PlanRequiredError);
    expect(error.code).toBe(code);
  });

  it('sdk_requires_service_key → PermissionDeniedError exposing the code', async () => {
    const client = clientWith(
      jsonResponse(403, envelope('SDK requests require a service-account key', 'sdk_requires_service_key')),
    );
    const error = await capture(client.me.get());
    expect(error).toBeInstanceOf(PermissionDeniedError);
    expect(error.code).toBe('sdk_requires_service_key');
  });

  it('the code wins over the status when they disagree', async () => {
    const client = clientWith(jsonResponse(403, envelope('Plan lapsed', 'api_plan_lapsed')));
    const error = await capture(client.me.get());
    expect(error).toBeInstanceOf(PlanRequiredError);
    expect(error.status).toBe(403);
  });

  it('unknown codes fall back to the status mapping', async () => {
    const client = clientWith(jsonResponse(409, envelope('Novel conflict', 'brand_new_code')));
    const error = await capture(client.me.get());
    expect(error).toBeInstanceOf(ConflictError);
    expect(error.code).toBe('brand_new_code');
  });
});

describe('RateLimitError & retryAfter', () => {
  it('429 → RateLimitError with retryAfter parsed from Retry-After seconds', async () => {
    const client = clientWith(
      jsonResponse(429, envelope('Rate limit exceeded. Please retry later.'), {
        'retry-after': '30',
        'x-amzn-requestid': REQUEST_ID,
      }),
    );
    const error = (await capture(client.me.get())) as RateLimitError;
    expect(error).toBeInstanceOf(RateLimitError);
    expect(error.retryAfter).toBe(30);
    expect(error.requestId).toBe(REQUEST_ID);
  });

  it('rate_limited code → RateLimitError', async () => {
    const client = clientWith(
      jsonResponse(429, envelope('Rate limit exceeded', 'rate_limited'), { 'retry-after': '1' }),
    );
    const error = await capture(client.me.get());
    expect(error).toBeInstanceOf(RateLimitError);
    expect(error.code).toBe('rate_limited');
  });

  it('retryAfter is undefined when the header is missing', async () => {
    const client = clientWith(jsonResponse(429, envelope('Rate limit exceeded')));
    const error = (await capture(client.me.get())) as RateLimitError;
    expect(error.retryAfter).toBeUndefined();
  });

  it('parses an HTTP-date Retry-After into seconds', async () => {
    const client = clientWith(
      jsonResponse(429, envelope('Rate limit exceeded'), {
        'retry-after': new Date(Date.now() + 45_000).toUTCString(),
      }),
    );
    const error = (await capture(client.me.get())) as RateLimitError;
    expect(error.retryAfter).toBeGreaterThanOrEqual(40);
    expect(error.retryAfter).toBeLessThanOrEqual(46);
  });
});

describe('request id extraction', () => {
  it.each([
    ['x-amzn-requestid', 'rest-api-id'],
    ['apigw-requestid', 'http-api-id'],
    ['x-amz-apigw-id', 'extended-id'],
    ['x-request-id', 'conventional-id'],
  ])('reads %s', async (header, value) => {
    const client = clientWith(jsonResponse(404, envelope('Not found'), { [header]: value }));
    const error = await capture(client.me.get());
    expect(error.requestId).toBe(value);
  });

  it('prefers x-amzn-requestid (the REST API header) over fallbacks', async () => {
    const client = clientWith(
      jsonResponse(404, envelope('Not found'), {
        'x-request-id': 'other',
        'x-amzn-requestid': 'canonical',
      }),
    );
    const error = await capture(client.me.get());
    expect(error.requestId).toBe('canonical');
  });

  it('is undefined when no request-id header is present', async () => {
    const client = clientWith(jsonResponse(404, envelope('Not found')));
    const error = await capture(client.me.get());
    expect(error.requestId).toBeUndefined();
  });
});

describe('hierarchy', () => {
  it('every HTTP error is an APIError is a SlothboxError is an Error', async () => {
    const client = clientWith(jsonResponse(429, envelope('Rate limit exceeded')));
    const error = await capture(client.me.get());
    expect(error).toBeInstanceOf(RateLimitError);
    expect(error).toBeInstanceOf(APIError);
    expect(error).toBeInstanceOf(SlothboxError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('RateLimitError');
  });
});
