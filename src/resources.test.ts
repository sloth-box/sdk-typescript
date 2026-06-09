import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  cloudFormationTemplateYaml,
  environment,
  membership,
  organization,
  pendingEnvironment,
  rolledSecret,
} from './__fixtures__/fixtures.js';
import { createMockFetch, jsonResponse, textResponse } from './__fixtures__/mock-fetch.js';
import type { ArgsOf, BodyOf, ResultOf } from './core.js';
import type { components } from './generated/api.js';
import { Slothbox } from './index.js';

function clientWith(...responses: Response[]) {
  const mock = createMockFetch(...responses);
  return { client: new Slothbox({ apiKey: 'sk_test', fetch: mock.fetch }), mock };
}

describe('representative resource calls', () => {
  it('environments.launch POSTs the body and returns the typed 201 Environment', async () => {
    const { client, mock } = clientWith(jsonResponse(201, pendingEnvironment));
    const launched = await client.environments.launch({
      orgId: 'org_1',
      body: { templateId: 'tpl_1', name: 'checkout-dev', instanceType: 't4g.large' },
    });
    expect(launched.status).toBe('pending');
    expect(launched.envId).toBe(pendingEnvironment.envId);
    const request = mock.requests[0]!;
    expect(request.method).toBe('POST');
    expect(request.url.pathname).toBe('/organizations/org_1/environments');
  });

  it('environments.stop POSTs to the lifecycle sub-path', async () => {
    const { client, mock } = clientWith(jsonResponse(200, { ...environment, status: 'stopping' }));
    const stopped = await client.environments.stop({ orgId: 'org_1', envId: environment.envId });
    expect(stopped.status).toBe('stopping');
    expect(mock.requests[0]!.method).toBe('POST');
    expect(mock.requests[0]!.url.pathname).toBe(
      `/organizations/org_1/environments/${environment.envId}/stop`,
    );
  });

  it('environments.terminate DELETEs the box', async () => {
    const { client, mock } = clientWith(
      jsonResponse(200, { ...environment, status: 'terminating' }),
    );
    await client.environments.terminate({ orgId: 'org_1', envId: environment.envId });
    expect(mock.requests[0]!.method).toBe('DELETE');
  });

  it('webhooks.rollSecret POSTs to /secret/roll and returns the new secret', async () => {
    const { client, mock } = clientWith(jsonResponse(200, rolledSecret));
    const rolled = await client.webhooks.rollSecret({ orgId: 'org_1', endpointId: 'whe_1' });
    expect(rolled.secret).toBe(rolledSecret.secret);
    expect(rolled.overlapSeconds).toBe(86400);
    expect(mock.requests[0]!.method).toBe('POST');
    expect(mock.requests[0]!.url.pathname).toBe(
      '/organizations/org_1/webhooks/whe_1/secret/roll',
    );
  });

  it('templates.rebake POSTs to /rebake', async () => {
    const { client, mock } = clientWith(jsonResponse(200, {})); // TemplateWithChildren elided
    await client.templates.rebake({ orgId: 'org_1', templateId: 'tpl_1' });
    expect(mock.requests[0]!.method).toBe('POST');
    expect(mock.requests[0]!.url.pathname).toBe('/organizations/org_1/templates/tpl_1/rebake');
  });

  it('members.setPermissions PATCHes the membership', async () => {
    const { client, mock } = clientWith(jsonResponse(200, membership));
    const updated = await client.members.setPermissions({
      orgId: 'org_1',
      userId: 'usr_1',
      body: { permissions: ['environments:delete', 'audit:read'] },
    });
    expect(updated.membership.permissions).toContain('audit:read');
    expect(mock.requests[0]!.method).toBe('PATCH');
    expect(mock.requests[0]!.url.pathname).toBe('/organizations/org_1/members/usr_1');
  });

  it('organizations.get returns the org with template-version metadata', async () => {
    const { client } = clientWith(jsonResponse(200, organization));
    const fetched = await client.organizations.get({ orgId: 'org_01HAAA0001' });
    expect(fetched.organization.name).toBe('Acme Robotics');
    expect(fetched.awsUpdateAvailable).toBe(false);
  });

  it('secrets.deleteEnvConfig sends its required query params', async () => {
    const { client, mock } = clientWith(jsonResponse(200, { deleted: true }));
    const result = await client.secrets.deleteEnvConfig({
      orgId: 'org_1',
      key: 'DATABASE_URL',
      query: { scope: 'repo', kind: 'secret', repoId: 'repo_1' },
    });
    expect(result.deleted).toBe(true);
    const url = mock.requests[0]!.url;
    expect(url.pathname).toBe('/organizations/org_1/env-config/DATABASE_URL');
    expect(url.searchParams.get('scope')).toBe('repo');
    expect(url.searchParams.get('kind')).toBe('secret');
  });

  it('awsConnections.getTemplate returns the YAML string', async () => {
    const { client } = clientWith(
      textResponse(200, cloudFormationTemplateYaml, 'application/yaml'),
    );
    const template = await client.awsConnections.getTemplate();
    expect(template.startsWith('AWSTemplateFormatVersion')).toBe(true);
  });

  it('me.get works with no arguments', async () => {
    const me: ResultOf<'getMe'> = {
      user: {
        userId: 'usr_1',
        email: 'oliver@example.com',
        authMethod: 'apiKey',
        mfaEnabled: false,
        hasSeenGuide: true,
      },
      organizations: [],
      mfaRequired: false,
    };
    const { client, mock } = clientWith(jsonResponse(200, me));
    const result = await client.me.get();
    expect(result.user.userId).toBe('usr_1');
    expect(mock.requests[0]!.url.pathname).toBe('/me');
  });
});

describe('static typing (compile-time assertions)', () => {
  it('derives types end-to-end from the generated spec types', () => {
    // The YAML op resolves to a string, never a parsed object.
    expectTypeOf<ResultOf<'getAwsConnectionTemplate'>>().toEqualTypeOf<string>();
    // 204 ops resolve to void.
    expectTypeOf<ResultOf<'deleteOrganization'>>().toEqualTypeOf<void>();
    // Lifecycle ops resolve to the Environment schema.
    expectTypeOf<ResultOf<'stopEnvironment'>>().toEqualTypeOf<
      components['schemas']['Environment']
    >();
    // Launch body comes straight from LaunchEnvironmentRequest.
    expectTypeOf<BodyOf<'launchEnvironment'>>().toEqualTypeOf<
      components['schemas']['LaunchEnvironmentRequest']
    >();
    // Path params are flattened into the args object.
    expectTypeOf<ArgsOf<'getEnvironment'>>().toMatchTypeOf<{ orgId: string; envId: string }>();
    // deleteEnvConfig's query is required (it is required in the spec).
    expectTypeOf<ArgsOf<'deleteEnvConfig'>>().toMatchTypeOf<{
      orgId: string;
      key: string;
      query: { scope: 'org' | 'repo' | 'template' | 'environment'; kind: 'secret' | 'variable' };
    }>();
  });
});
