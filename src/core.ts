/**
 * The conventions layer's plumbing: operation-keyed helper types derived from
 * the generated `operations` interface, the operationId → route table, and
 * the request interfaces shared by the resource classes.
 *
 * Everything here is mechanical — types and routes both come straight from
 * the pinned OpenAPI spec (`operationId`s, paths, methods). A unit test
 * cross-checks {@link endpoints} against `openapi.json`, and the mapped type
 * on the table makes the compiler reject a missing or extraneous operation.
 */

import type { operations } from './generated/api.js';
import type { CursorPage } from './pagination.js';

/** The `operationId` of any published operation. */
export type OperationId = keyof operations;

type ParametersOf<K extends OperationId> = operations[K]['parameters'];

/** Path parameters of an operation (`{}` when it has none). */
export type PathParamsOf<K extends OperationId> = [ParametersOf<K>['path']] extends [
  Record<string, unknown>,
]
  ? ParametersOf<K>['path']
  : unknown;

/** Query parameters of an operation (`never` when it has none). */
export type QueryParamsOf<K extends OperationId> = NonNullable<ParametersOf<K>['query']>;

type QueryArgOf<K extends OperationId> = [QueryParamsOf<K>] extends [never]
  ? unknown
  : undefined extends ParametersOf<K>['query']
    ? { query?: QueryParamsOf<K> }
    : { query: QueryParamsOf<K> };

/** JSON request body of an operation (`never` when it has none). */
export type BodyOf<K extends OperationId> = NonNullable<operations[K]['requestBody']> extends {
  content: { 'application/json': infer B };
}
  ? B
  : never;

type BodyArgOf<K extends OperationId> = [BodyOf<K>] extends [never]
  ? unknown
  : undefined extends operations[K]['requestBody']
    ? { body?: BodyOf<K> }
    : { body: BodyOf<K> };

/**
 * The single `args` argument of a resource method: the operation's path
 * parameters flattened to the top level, plus `query` and `body` keys when
 * the operation defines them. Fully derived from the generated types.
 */
export type ArgsOf<K extends OperationId> = PathParamsOf<K> & QueryArgOf<K> & BodyArgOf<K>;

type ContentOf<R> = R extends { content: { 'application/json': infer B } }
  ? B
  : R extends { content?: never }
    ? // a 2xx with no JSON content — the API's only such op serves
      // CloudFormation YAML, surfaced as a raw string
      string
    : unknown;

/**
 * The success payload of an operation: the JSON body of its 2xx response,
 * `string` for the non-JSON (YAML) operation, `void` for 204s.
 */
export type ResultOf<K extends OperationId> = operations[K]['responses'] extends {
  200: infer R;
}
  ? ContentOf<R>
  : operations[K]['responses'] extends { 201: infer R }
    ? ContentOf<R>
    : operations[K]['responses'] extends { 204: unknown }
      ? void
      : unknown;

type ElementOf<A> = A extends readonly (infer I)[] ? I : never;

/**
 * The keys of an operation's result that hold the page items — used to pick
 * the items array on cursor-paginated lists (`'events'`, `'deliveries'`).
 */
export type ItemsFieldOf<K extends OperationId> = ResultOf<K> extends Record<string, unknown>
  ? {
      [F in keyof ResultOf<K>]: NonNullable<ResultOf<K>[F]> extends readonly unknown[]
        ? F
        : never;
    }[keyof ResultOf<K>] &
      string
  : never;

/** The page type returned by a cursor-paginated list operation. */
export type PageOf<K extends OperationId, F extends ItemsFieldOf<K>> = CursorPage<
  ResultOf<K> & { cursor?: string },
  ElementOf<(ResultOf<K> & Record<string, unknown>)[F]>
>;

/** Options accepted by every resource method, per request. */
export interface RequestOptions {
  /** Abort the request (and any auto-pagination it feeds). */
  signal?: AbortSignal;
  /** Extra headers, merged over the SDK's defaults (case-insensitive). */
  headers?: Record<string, string>;
}

/**
 * {@link RequestOptions} plus an idempotency key, for operations that accept
 * the `Idempotency-Key` request header (currently `environments.launch`).
 */
export interface IdempotentRequestOptions extends RequestOptions {
  /**
   * Sent as the `Idempotency-Key` header — retries with the same key return
   * the original result instead of launching a duplicate.
   */
  idempotencyKey?: string;
}

/** What the resource classes need from the client. */
export interface APIRequester {
  /** Perform one operation, typed end-to-end by its `operationId`. */
  call<K extends OperationId>(
    op: K,
    args?: ArgsOf<K>,
    options?: RequestOptions,
  ): Promise<ResultOf<K>>;

  /** Perform a cursor-paginated list operation, returning a {@link CursorPage}. */
  page<K extends OperationId, F extends ItemsFieldOf<K>>(
    op: K,
    itemsField: F,
    args?: ArgsOf<K>,
    options?: RequestOptions,
  ): Promise<PageOf<K, F>>;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * operationId → `[method, path template]` for every published operation.
 * The mapped type forces this table to cover exactly the spec's 71
 * operations — adding or removing one in `openapi.json` breaks compilation
 * here until the route is added/removed too.
 */
export const endpoints: { readonly [K in OperationId]: readonly [HttpMethod, string] } = {
  // Health
  getHealth: ['GET', '/hello'],
  // Me / GitHub / Connections
  getMe: ['GET', '/me'],
  getGithubLink: ['GET', '/me/github'],
  listMyConnections: ['GET', '/me/connections'],
  // Catalog
  listCatalogServices: ['GET', '/catalog/services'],
  listCatalogRuntimes: ['GET', '/catalog/runtimes'],
  // Organizations
  listOrganizations: ['GET', '/organizations'],
  createOrganization: ['POST', '/organizations'],
  getOrganization: ['GET', '/organizations/{orgId}'],
  updateOrganization: ['PATCH', '/organizations/{orgId}'],
  deleteOrganization: ['DELETE', '/organizations/{orgId}'],
  transferOwnership: ['POST', '/organizations/{orgId}/transfer-ownership'],
  // Members
  listMembers: ['GET', '/organizations/{orgId}/members'],
  removeMember: ['DELETE', '/organizations/{orgId}/members/{userId}'],
  setMemberPermissions: ['PATCH', '/organizations/{orgId}/members/{userId}'],
  listMemberConnections: ['GET', '/organizations/{orgId}/members/{userId}/connections'],
  setMemberConnection: ['PUT', '/organizations/{orgId}/members/{userId}/connections/{provider}'],
  clearMemberConnection: [
    'DELETE',
    '/organizations/{orgId}/members/{userId}/connections/{provider}',
  ],
  // Invites
  listInvites: ['GET', '/organizations/{orgId}/invites'],
  createInvite: ['POST', '/organizations/{orgId}/invites'],
  revokeInvite: ['DELETE', '/organizations/{orgId}/invites/{token}'],
  previewInvite: ['GET', '/invites/{token}'],
  acceptInvite: ['POST', '/invites/{token}/accept'],
  // SSH keys
  getGitSshKey: ['GET', '/organizations/{orgId}/members/{userId}/git-ssh-key'],
  generateGitSshKey: ['POST', '/organizations/{orgId}/members/{userId}/git-ssh-key'],
  revokeGitSshKey: ['DELETE', '/organizations/{orgId}/members/{userId}/git-ssh-key'],
  // Templates
  listTemplates: ['GET', '/organizations/{orgId}/templates'],
  createTemplate: ['POST', '/organizations/{orgId}/templates'],
  getTemplate: ['GET', '/organizations/{orgId}/templates/{templateId}'],
  replaceTemplate: ['PATCH', '/organizations/{orgId}/templates/{templateId}'],
  deleteTemplate: ['DELETE', '/organizations/{orgId}/templates/{templateId}'],
  rebakeTemplate: ['POST', '/organizations/{orgId}/templates/{templateId}/rebake'],
  // Environments
  listEnvironments: ['GET', '/organizations/{orgId}/environments'],
  launchEnvironment: ['POST', '/organizations/{orgId}/environments'],
  getEnvironment: ['GET', '/organizations/{orgId}/environments/{envId}'],
  terminateEnvironment: ['DELETE', '/organizations/{orgId}/environments/{envId}'],
  stopEnvironment: ['POST', '/organizations/{orgId}/environments/{envId}/stop'],
  startEnvironment: ['POST', '/organizations/{orgId}/environments/{envId}/start'],
  getEnvironmentMetrics: ['GET', '/organizations/{orgId}/environments/{envId}/metrics'],
  getAutoSleepPolicy: ['GET', '/organizations/{orgId}/auto-sleep'],
  setAutoSleepPolicy: ['PUT', '/organizations/{orgId}/auto-sleep'],
  setTemplateAutoSleep: ['PUT', '/organizations/{orgId}/templates/{templateId}/auto-sleep'],
  // Runtime bundles
  listRuntimeBundles: ['GET', '/organizations/{orgId}/runtime-bundles'],
  listBakeEvents: ['GET', '/organizations/{orgId}/runtime-bundles/{hash}/events'],
  // AWS connections
  listAwsConnections: ['GET', '/organizations/{orgId}/aws-connections'],
  createAwsConnection: ['POST', '/organizations/{orgId}/aws-connections'],
  getAwsConnection: ['GET', '/organizations/{orgId}/aws-connections/{connectionId}'],
  deleteAwsConnection: ['DELETE', '/organizations/{orgId}/aws-connections/{connectionId}'],
  verifyAwsConnection: ['POST', '/organizations/{orgId}/aws-connections/{connectionId}/verify'],
  getAwsConnectionTemplate: ['GET', '/aws-connections/template.yaml'],
  // Billing
  getBillingSummary: ['GET', '/organizations/{orgId}/billing'],
  // Audit
  listOrgAuditEvents: ['GET', '/organizations/{orgId}/audit'],
  listMyAuditEvents: ['GET', '/me/audit'],
  listApiKeyAuditEvents: ['GET', '/me/api-keys/{keyId}/audit'],
  // Secrets & environment config
  listEnvConfig: ['GET', '/organizations/{orgId}/env-config'],
  upsertEnvConfig: ['PUT', '/organizations/{orgId}/env-config/{key}'],
  deleteEnvConfig: ['DELETE', '/organizations/{orgId}/env-config/{key}'],
  setSecretsConfig: ['PUT', '/organizations/{orgId}/secrets-settings'],
  listOrgRepos: ['GET', '/organizations/{orgId}/repos'],
  // Webhooks
  listWebhookEndpoints: ['GET', '/organizations/{orgId}/webhooks'],
  createWebhookEndpoint: ['POST', '/organizations/{orgId}/webhooks'],
  getWebhookEndpoint: ['GET', '/organizations/{orgId}/webhooks/{endpointId}'],
  updateWebhookEndpoint: ['PATCH', '/organizations/{orgId}/webhooks/{endpointId}'],
  deleteWebhookEndpoint: ['DELETE', '/organizations/{orgId}/webhooks/{endpointId}'],
  getWebhookSecret: ['GET', '/organizations/{orgId}/webhooks/{endpointId}/secret'],
  rollWebhookSecret: ['POST', '/organizations/{orgId}/webhooks/{endpointId}/secret/roll'],
  listWebhookDeliveries: ['GET', '/organizations/{orgId}/webhooks/{endpointId}/deliveries'],
  getWebhookDelivery: [
    'GET',
    '/organizations/{orgId}/webhooks/{endpointId}/deliveries/{deliveryId}',
  ],
  redeliverWebhook: [
    'POST',
    '/organizations/{orgId}/webhooks/{endpointId}/deliveries/{deliveryId}/redeliver',
  ],
  pingWebhookEndpoint: ['POST', '/organizations/{orgId}/webhooks/{endpointId}/ping'],
  listWebhookEventTypes: ['GET', '/organizations/{orgId}/webhooks/event-types'],
};
