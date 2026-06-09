/**
 * Acceptance check: every published operation is callable through the
 * resource-grouped surface, hitting exactly the method + path the pinned
 * `openapi.json` declares. The op → surface map below is also forced to be
 * complete at compile time (`Record<OperationId, …>`), so a spec refresh that
 * adds/removes an operation fails this file until the surface catches up.
 */

import { describe, expect, it } from 'vitest';
import spec from '../openapi.json';
import { createMockFetch, jsonResponse } from './__fixtures__/mock-fetch.js';
import { endpoints, type OperationId, type RequestOptions } from './core.js';
import { Slothbox } from './index.js';

interface SpecOperation {
  operationId: OperationId;
  method: string;
  path: string;
  pathParams: string[];
}

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

function operationsFromSpec(): SpecOperation[] {
  const found: SpecOperation[] = [];
  for (const [path, item] of Object.entries(spec.paths as Record<string, unknown>)) {
    for (const method of HTTP_METHODS) {
      const op = (item as Record<string, { operationId?: string; parameters?: unknown[] }>)[
        method
      ];
      if (!op?.operationId) continue;
      const pathParams = ((op.parameters ?? []) as { name?: string; in?: string }[])
        .filter((p) => p.in === 'path' && typeof p.name === 'string')
        .map((p) => p.name as string);
      found.push({ operationId: op.operationId as OperationId, method: method.toUpperCase(), path, pathParams });
    }
  }
  return found;
}

// `any` is deliberate: the per-op arg objects are synthesized from the spec
// at runtime; the compile-time guarantees live in the resource signatures.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Invoke = (client: Slothbox, args: any, options?: RequestOptions) => Promise<unknown>;

/**
 * operationId → resource-surface invocation. `Record<OperationId, Invoke>`
 * makes this table provably cover all 71 published operations.
 */
const surface: Record<OperationId, Invoke> = {
  getHealth: (c, a, o) => c.health.get(a, o),
  getMe: (c, a, o) => c.me.get(a, o),
  getGithubLink: (c, a, o) => c.github.getLink(a, o),
  listMyConnections: (c, a, o) => c.connections.list(a, o),
  listCatalogServices: (c, a, o) => c.catalog.listServices(a, o),
  listCatalogRuntimes: (c, a, o) => c.catalog.listRuntimes(a, o),
  listOrganizations: (c, a, o) => c.organizations.list(a, o),
  createOrganization: (c, a, o) => c.organizations.create(a, o),
  getOrganization: (c, a, o) => c.organizations.get(a, o),
  updateOrganization: (c, a, o) => c.organizations.update(a, o),
  deleteOrganization: (c, a, o) => c.organizations.delete(a, o),
  transferOwnership: (c, a, o) => c.organizations.transferOwnership(a, o),
  listMembers: (c, a, o) => c.members.list(a, o),
  removeMember: (c, a, o) => c.members.remove(a, o),
  setMemberPermissions: (c, a, o) => c.members.setPermissions(a, o),
  listMemberConnections: (c, a, o) => c.members.listConnections(a, o),
  setMemberConnection: (c, a, o) => c.members.setConnection(a, o),
  clearMemberConnection: (c, a, o) => c.members.clearConnection(a, o),
  listInvites: (c, a, o) => c.invites.list(a, o),
  createInvite: (c, a, o) => c.invites.create(a, o),
  revokeInvite: (c, a, o) => c.invites.revoke(a, o),
  previewInvite: (c, a, o) => c.invites.preview(a, o),
  acceptInvite: (c, a, o) => c.invites.accept(a, o),
  getGitSshKey: (c, a, o) => c.sshKeys.get(a, o),
  generateGitSshKey: (c, a, o) => c.sshKeys.generate(a, o),
  revokeGitSshKey: (c, a, o) => c.sshKeys.revoke(a, o),
  listTemplates: (c, a, o) => c.templates.list(a, o),
  createTemplate: (c, a, o) => c.templates.create(a, o),
  getTemplate: (c, a, o) => c.templates.get(a, o),
  replaceTemplate: (c, a, o) => c.templates.replace(a, o),
  deleteTemplate: (c, a, o) => c.templates.delete(a, o),
  rebakeTemplate: (c, a, o) => c.templates.rebake(a, o),
  listEnvironments: (c, a, o) => c.environments.list(a, o),
  launchEnvironment: (c, a, o) => c.environments.launch(a, o),
  getEnvironment: (c, a, o) => c.environments.get(a, o),
  terminateEnvironment: (c, a, o) => c.environments.terminate(a, o),
  stopEnvironment: (c, a, o) => c.environments.stop(a, o),
  startEnvironment: (c, a, o) => c.environments.start(a, o),
  getEnvironmentMetrics: (c, a, o) => c.environments.getMetrics(a, o),
  getAutoSleepPolicy: (c, a, o) => c.environments.getAutoSleepPolicy(a, o),
  setAutoSleepPolicy: (c, a, o) => c.environments.setAutoSleepPolicy(a, o),
  setTemplateAutoSleep: (c, a, o) => c.environments.setTemplateAutoSleep(a, o),
  listRuntimeBundles: (c, a, o) => c.runtimeBundles.list(a, o),
  listBakeEvents: (c, a, o) => c.runtimeBundles.listBakeEvents(a, o),
  listAwsConnections: (c, a, o) => c.awsConnections.list(a, o),
  createAwsConnection: (c, a, o) => c.awsConnections.create(a, o),
  getAwsConnection: (c, a, o) => c.awsConnections.get(a, o),
  deleteAwsConnection: (c, a, o) => c.awsConnections.delete(a, o),
  verifyAwsConnection: (c, a, o) => c.awsConnections.verify(a, o),
  getAwsConnectionTemplate: (c, a, o) => c.awsConnections.getTemplate(a, o),
  getBillingSummary: (c, a, o) => c.billing.getSummary(a, o),
  listOrgAuditEvents: (c, a, o) => c.audit.listOrgEvents(a, o),
  listMyAuditEvents: (c, a, o) => c.audit.listMyEvents(a, o),
  listApiKeyAuditEvents: (c, a, o) => c.audit.listApiKeyEvents(a, o),
  listEnvConfig: (c, a, o) => c.secrets.listEnvConfig(a, o),
  upsertEnvConfig: (c, a, o) => c.secrets.upsertEnvConfig(a, o),
  deleteEnvConfig: (c, a, o) => c.secrets.deleteEnvConfig(a, o),
  setSecretsConfig: (c, a, o) => c.secrets.setConfig(a, o),
  listOrgRepos: (c, a, o) => c.secrets.listOrgRepos(a, o),
  listWebhookEndpoints: (c, a, o) => c.webhooks.listEndpoints(a, o),
  createWebhookEndpoint: (c, a, o) => c.webhooks.createEndpoint(a, o),
  getWebhookEndpoint: (c, a, o) => c.webhooks.getEndpoint(a, o),
  updateWebhookEndpoint: (c, a, o) => c.webhooks.updateEndpoint(a, o),
  deleteWebhookEndpoint: (c, a, o) => c.webhooks.deleteEndpoint(a, o),
  getWebhookSecret: (c, a, o) => c.webhooks.getSecret(a, o),
  rollWebhookSecret: (c, a, o) => c.webhooks.rollSecret(a, o),
  listWebhookDeliveries: (c, a, o) => c.webhooks.listDeliveries(a, o),
  getWebhookDelivery: (c, a, o) => c.webhooks.getDelivery(a, o),
  redeliverWebhook: (c, a, o) => c.webhooks.redeliver(a, o),
  pingWebhookEndpoint: (c, a, o) => c.webhooks.pingEndpoint(a, o),
  listWebhookEventTypes: (c, a, o) => c.webhooks.listEventTypes(a, o),
};

describe('endpoint table vs pinned spec', () => {
  const specOps = operationsFromSpec();

  it('the spec publishes exactly the 71 operations the table covers', () => {
    expect(specOps).toHaveLength(71);
    expect(new Set(specOps.map((op) => op.operationId)).size).toBe(71);
    expect(Object.keys(endpoints).sort()).toEqual(specOps.map((op) => op.operationId).sort());
  });

  it('every table entry matches the spec method and path', () => {
    for (const op of specOps) {
      const [method, path] = endpoints[op.operationId];
      expect(`${op.operationId}: ${method} ${path}`).toBe(
        `${op.operationId}: ${op.method} ${op.path}`,
      );
    }
  });
});

describe('every published operation is callable through the surface', () => {
  const specOps = operationsFromSpec();

  it.each(specOps.map((op) => [op.operationId, op] as const))(
    '%s hits its spec route',
    async (_id, op) => {
      const mock = createMockFetch(jsonResponse(200, {}));
      const client = new Slothbox({ apiKey: 'sk_test', fetch: mock.fetch });

      const args: Record<string, unknown> = {};
      for (const name of op.pathParams) args[name] = `x-${name}`;
      // the one op whose query params are required in the spec
      if (op.operationId === 'deleteEnvConfig') args.query = { scope: 'org', kind: 'secret' };

      await surface[op.operationId](client, args);

      expect(mock.requests).toHaveLength(1);
      const request = mock.requests[0]!;
      expect(request.method).toBe(op.method);
      const expectedPath = op.path.replace(/\{([^{}]+)\}/g, (_m, name: string) =>
        encodeURIComponent(`x-${name}`),
      );
      expect(request.url.pathname).toBe(expectedPath);
      expect(request.headers.get('authorization')).toBe('sk_test');
    },
  );
});
