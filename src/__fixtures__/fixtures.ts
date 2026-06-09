/**
 * Recorded API payloads used by the unit tests. Each fixture is typed
 * against the generated OpenAPI types, so it is compiler-checked to match
 * the pinned spec — tests never hit the live API.
 */

import type { components } from '../generated/api.js';
import type { ResultOf } from '../core.js';

type Schemas = components['schemas'];

export const environment: Schemas['Environment'] = {
  envId: 'env_01HZX4Y6KQ',
  name: 'checkout-dev',
  templateId: 'tpl_01HXYZABCD',
  awsConnectionId: 'conn_01HWWW1234',
  region: 'eu-west-2',
  instanceType: 't4g.medium',
  instanceId: 'i-0abc123def456',
  status: 'running',
  createdByUserId: 'usr_01HVVV5678',
  mine: true,
  createdAt: '2026-06-08T10:15:00.000Z',
  updatedAt: '2026-06-08T10:21:42.000Z',
};

export const pendingEnvironment: Schemas['Environment'] = {
  ...environment,
  envId: 'env_01HZX4YNEW',
  status: 'pending',
  instanceId: undefined,
};

export const listEnvironmentsResponse: ResultOf<'listEnvironments'> = {
  environments: [environment],
};

const auditEvent = (n: number): Schemas['AuditEvent'] => ({
  eventId: `evt_${String(n).padStart(4, '0')}`,
  at: '2026-06-08T10:15:00.000Z',
  action: 'terminate',
  orgId: 'org_01HAAA0001',
  actor: { type: 'user', id: 'usr_01HVVV5678', label: 'oliver@example.com' },
  resource: { type: 'environment', id: 'env_01HZX4Y6KQ' },
});

export const auditEvents: Schemas['AuditEvent'][] = [1, 2, 3, 4, 5].map(auditEvent);

export const auditPage1: Schemas['AuditLogResponse'] = {
  events: auditEvents.slice(0, 2),
  cursor: 'cursor-page-2',
};

export const auditPage2: Schemas['AuditLogResponse'] = {
  events: auditEvents.slice(2, 4),
  cursor: 'cursor-page-3',
};

export const auditPageLast: Schemas['AuditLogResponse'] = {
  events: auditEvents.slice(4),
};

export const auditPageEmpty: Schemas['AuditLogResponse'] = {
  events: [],
};

/** DynamoDB-style: a filter can match nothing in the scanned range but still return a cursor. */
export const auditPageEmptyWithCursor: Schemas['AuditLogResponse'] = {
  events: [],
  cursor: 'cursor-keep-going',
};

const webhookDelivery = (n: number): Schemas['WebhookDelivery'] => ({
  deliveryId: `dlv_${String(n).padStart(4, '0')}`,
  webhookId: `msg_${String(n).padStart(4, '0')}`,
  endpointId: 'whe_01HBBB0001',
  eventType: 'environment.stopped',
  status: 'delivered',
  attemptCount: 1,
  attempts: [{ attemptNo: 1, at: '2026-06-08T10:15:00.000Z', httpStatus: 200, latencyMs: 123 }],
  payload: '{"type":"environment.stopped"}',
  createdAt: '2026-06-08T10:15:00.000Z',
  updatedAt: '2026-06-08T10:15:01.000Z',
});

export const deliveriesPage1: ResultOf<'listWebhookDeliveries'> = {
  deliveries: [webhookDelivery(1), webhookDelivery(2)],
  cursor: 'dlv-cursor-2',
};

export const deliveriesPage2: ResultOf<'listWebhookDeliveries'> = {
  deliveries: [webhookDelivery(3)],
};

export const rolledSecret: ResultOf<'rollWebhookSecret'> = {
  secret: 'whsec_5ZQq8Wn0pXk2vT7rB1mC4yJ9',
  overlapSeconds: 86400,
};

export const membership: ResultOf<'setMemberPermissions'> = {
  membership: {
    orgId: 'org_01HAAA0001',
    userId: 'usr_01HVVV5678',
    email: 'jack@example.com',
    role: 'member',
    joinedAt: '2026-01-15T12:00:00.000Z',
    permissions: ['environments:delete', 'audit:read'],
  },
};

export const organization: ResultOf<'getOrganization'> = {
  organization: {
    orgId: 'org_01HAAA0001',
    name: 'Acme Robotics',
    ownerId: 'usr_01HVVV5678',
    createdAt: '2025-11-02T09:00:00.000Z',
    requireMfa: false,
  },
  awsUpdateAvailable: false,
  currentConnectionTemplateVersion: '7',
};

/** Recorded from GET /aws-connections/template.yaml (application/yaml). */
export const cloudFormationTemplateYaml = `AWSTemplateFormatVersion: "2010-09-09"
Description: Grants Slothbox assume-role access to launch dev boxes in this account.
Resources:
  SlothboxAccessRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: SlothboxAccessRole
      AssumeRolePolicyDocument:
        Version: "2012-10-17"
        Statement:
          - Effect: Allow
            Principal:
              AWS: arn:aws:iam::123456789012:root
            Action: sts:AssumeRole
`;
