/**
 * Live integration suite against the dedicated fixture org (SLO-136).
 *
 * Runs against PRODUCTION (there is no staging stack), inside the isolated
 * fixture org provisioned by the SLO-123 runbook. Scheduled daily +
 * `workflow_dispatch` via `.github/workflows/integration.yml` — never per-PR.
 *
 * Without `SLOTHBOX_SDK_TEST_KEY` the whole suite SKIPS with one clear line
 * (the fixture org may not be provisioned yet); the dry-run teardown tests in
 * `helpers.test.ts` still run.
 *
 * Cost discipline (this suite spends real sandbox-account money):
 * - ONE box per run, lifecycle ops strictly serialized, polls ≥7s apart.
 * - Every created resource registers on a {@link CleanupStack} BEFORE any
 *   assertion can run; `afterAll` drains it and verifies termination by
 *   polling to a terminal state.
 * - Belt and braces: `sweepFixtureLeftovers` runs at suite start (catches
 *   leaks from a crashed/cancelled previous run) AND suite end (anything the
 *   stack missed fails the suite — a leaked box is standing AWS spend).
 * - The org compute tier is 10/min, 60/hr shared across launches and template
 *   writes; this suite performs at most 3 such ops per run, paced ≥7s apart.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  AuthenticationError,
  ConflictError,
  NotFoundError,
  PermissionDeniedError,
  Slothbox,
} from '../../src/index.js';
import { loadFixtureEnv, type LiveFixtureEnv } from './env.js';
import {
  COMPUTE_PACING_MS,
  CleanupStack,
  ciEnvConfigKey,
  ciName,
  isAlreadyGone,
  makeClient,
  makeRunId,
  pollUntil,
  signWebhookPayload,
  sleep,
  sweepFixtureLeftovers,
  verifyWebhookSignature,
  waitForEnvironmentStatus,
} from './helpers.js';

const fixture = loadFixtureEnv();

if (fixture.mode === 'skip') {
  // The one-line, can't-miss-it skip reason (also surfaced per-test by vitest).
  console.warn(`SKIP: ${fixture.reason}`);
}

describe.runIf(fixture.mode === 'misconfigured')('fixture credentials', () => {
  it('are either fully set or fully absent', () => {
    if (fixture.mode !== 'misconfigured') return;
    throw new Error(
      `Fixture credentials are partially configured — fix the GitHub secret/variables (SLO-123 runbook, step 6):\n- ${fixture.problems.join('\n- ')}`,
    );
  });
});

describe.runIf(fixture.mode === 'live')('live fixture org', () => {
  // Safe at collection time: only dereferenced inside hooks/tests, which
  // vitest does not run unless mode === 'live'.
  const cfg = fixture as LiveFixtureEnv;
  const runId = makeRunId();
  const cleanup = new CleanupStack();
  const log = (msg: string) => console.log(`[sdk-ci ${runId}] ${msg}`);
  let client: Slothbox;

  beforeAll(async () => {
    client = makeClient(cfg);

    // Preflight: the fixture template must exist and be baked, or the launch
    // test would 409 — fail here with a pointer instead of mid-suite.
    const { templates } = await client.templates.list({ orgId: cfg.orgId });
    const fixtureTemplate = templates.find((t) => t.templateId === cfg.templateId);
    if (fixtureTemplate === undefined) {
      throw new Error(
        `Fixture template ${cfg.templateId} not found in org ${cfg.orgId} — re-check SLOTHBOX_SDK_TEST_TEMPLATE_ID against the SLO-123 runbook (step 4).`,
      );
    }
    if (fixtureTemplate.status !== 'ready') {
      throw new Error(
        `Fixture template ${cfg.templateId} is '${fixtureTemplate.status}', not 'ready' — launches would 409 (bundle_building: wait; bundle_failed: rebake per the SLO-123 runbook).`,
      );
    }
    if (fixtureTemplate.needsRebake) {
      log('WARN: fixture template was baked on an older recipe (needsRebake) — rebake soon.');
    }

    // Start-of-suite sweep: a crashed or cancelled previous run may have
    // leaked resources. Clean them, loudly.
    const cleaned = await sweepFixtureLeftovers(client, {
      orgId: cfg.orgId,
      protectedTemplateId: cfg.templateId,
      log,
    });
    if (cleaned.length > 0) {
      console.warn(
        `WARNING: a previous run leaked ${cleaned.length} resource(s); the start-of-suite sweep cleaned them:\n - ${cleaned.join('\n - ')}`,
      );
    }
  }, 15 * 60_000);

  afterAll(async () => {
    // beforeAll never built the client ⇒ nothing was created.
    if ((client as Slothbox | undefined) === undefined) return;
    const problems: string[] = [];

    // 1. Drain the cleanup stack (newest resources first). Failures are
    //    collected, never swallowed.
    const failures = await cleanup.runAll(log);
    for (const failure of failures) {
      const reason = failure.error instanceof Error ? failure.error.message : String(failure.error);
      problems.push(`cleanup task failed: ${failure.description} — ${reason}`);
    }

    // 2. End-of-suite sweep. It SHOULD find nothing: anything it has to clean
    //    means a resource was created without registering teardown (or a
    //    cleanup task silently under-delivered) — that is a suite bug.
    try {
      const strays = await sweepFixtureLeftovers(client, {
        orgId: cfg.orgId,
        protectedTemplateId: cfg.templateId,
        log,
      });
      for (const stray of strays) {
        problems.push(`end-of-suite sweep had to clean an unregistered leftover: ${stray}`);
      }
    } catch (error) {
      problems.push(
        `end-of-suite sweep itself failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (problems.length > 0) {
      throw new Error(
        `TEARDOWN FAILURE — the fixture org may be holding resources that cost real money. ` +
          `Check the org NOW (a leaked box is standing AWS spend):\n - ${problems.join('\n - ')}`,
      );
    }
  }, 25 * 60_000);

  /* ------------------------------------------------------------------ */
  /* auth + error taxonomy                                               */
  /* ------------------------------------------------------------------ */

  describe('auth + error taxonomy', () => {
    it('authenticates with the fixture service key', async () => {
      const { templates } = await client.templates.list({ orgId: cfg.orgId });
      expect(templates.some((t) => t.templateId === cfg.templateId)).toBe(true);
    });

    it('throws AuthenticationError for an invalid key', async () => {
      const impostor = new Slothbox({
        apiKey: `sk_invalid_${runId}_0000000000000000`,
        baseUrl: cfg.baseUrl,
      });
      await expect(impostor.templates.list({ orgId: cfg.orgId })).rejects.toBeInstanceOf(
        AuthenticationError,
      );
    });

    it('throws NotFoundError for a nonexistent resource', async () => {
      await expect(
        client.environments.get({ orgId: cfg.orgId, envId: `env-sdk-ci-${runId}-nonexistent` }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('throws PermissionDeniedError on a JWT-only route (sk_ keys cannot manage service keys)', async () => {
      // /service-keys is publish:false (JWT-only), so it has no typed SDK
      // surface — exercised through the raw request escape hatch.
      await expect(
        client.request('GET', '/organizations/{orgId}/service-keys', {
          pathParams: { orgId: cfg.orgId },
        }),
      ).rejects.toBeInstanceOf(PermissionDeniedError);
    });
  });

  /* ------------------------------------------------------------------ */
  /* templates metadata CRUD (drafts only — no bake, no compute cost)    */
  /* ------------------------------------------------------------------ */

  describe('templates metadata CRUD', () => {
    it(
      'creates, reads, updates and deletes a draft template',
      async () => {
        const name = ciName(runId, 'tpl');

        await sleep(COMPUTE_PACING_MS); // POST /templates is on the org compute tier
        const created = await client.templates.create({
          orgId: cfg.orgId,
          body: { draft: true, name, draftState: { sdkCi: runId, step: 'created' } },
        });
        const templateId = created.template.templateId;
        cleanup.push(`delete template ${templateId} (${name})`, async () => {
          try {
            await client.templates.delete({ orgId: cfg.orgId, templateId });
          } catch (error) {
            if (!isAlreadyGone(error)) throw error;
          }
        });
        expect(created.template.name).toBe(name);
        expect(created.template.status).toBe('draft');

        const fetched = await client.templates.get({ orgId: cfg.orgId, templateId });
        expect(fetched.template.templateId).toBe(templateId);
        expect(fetched.template.draftState).toMatchObject({ sdkCi: runId, step: 'created' });

        await sleep(COMPUTE_PACING_MS); // PATCH /templates/{id} is on the compute tier too
        const renamed = ciName(runId, 'tpl-renamed'); // keeps the sdk-ci- prefix for the sweep
        const updated = await client.templates.replace({
          orgId: cfg.orgId,
          templateId,
          body: { draft: true, name: renamed, draftState: { sdkCi: runId, step: 'updated' } },
        });
        expect(updated.template.name).toBe(renamed);

        await client.templates.delete({ orgId: cfg.orgId, templateId });
        await expect(client.templates.get({ orgId: cfg.orgId, templateId })).rejects.toBeInstanceOf(
          NotFoundError,
        );
      },
      3 * 60_000,
    );
  });

  /* ------------------------------------------------------------------ */
  /* env-config CRUD                                                     */
  /* ------------------------------------------------------------------ */

  describe('env-config CRUD', () => {
    it(
      'upserts, lists, updates and deletes an org-scope variable',
      async () => {
        // env-config writes need a storage backend (both kinds store their
        // value in the org's AWS account); the SLO-123 runbook doesn't
        // configure one, so set SSM against the active connection on first
        // run. Idempotent org-level setting; standard SSM parameters are
        // free, so this adds no standing cost.
        const { secretsConfig } = await client.secrets.listEnvConfig({ orgId: cfg.orgId });
        const hasBackend =
          secretsConfig !== null &&
          typeof (secretsConfig as { backend?: unknown }).backend === 'string';
        if (!hasBackend) {
          const { connections } = await client.awsConnections.list({ orgId: cfg.orgId });
          const active = connections.find((c) => c.status === 'active');
          if (active === undefined) {
            throw new Error(
              'Fixture org has no active AWS connection — cannot configure the env-config storage backend (SLO-123 runbook, step 3).',
            );
          }
          log(`configuring env-config storage backend: ssm via ${active.connectionId}`);
          await client.secrets.setConfig({
            orgId: cfg.orgId,
            body: { backend: 'ssm', connectionId: active.connectionId, region: 'eu-west-2' },
          });
        }

        const key = ciEnvConfigKey(runId, 'var');
        const upserted = await client.secrets.upsertEnvConfig({
          orgId: cfg.orgId,
          key,
          body: { scope: 'org', kind: 'variable', value: 'one' },
        });
        cleanup.push(`delete env-config ${key}`, async () => {
          // deleteEnvConfig is idempotent server-side ({deleted:false} when gone).
          await client.secrets.deleteEnvConfig({
            orgId: cfg.orgId,
            key,
            query: { scope: 'org', kind: 'variable' },
          });
        });
        expect(upserted.item.key).toBe(key);
        expect(upserted.item.value).toBe('one');

        const listed = await client.secrets.listEnvConfig({ orgId: cfg.orgId });
        const found = listed.items.find(
          (i) => i.key === key && i.scope === 'org' && i.kind === 'variable',
        );
        expect(found).toBeDefined();
        expect(found?.value).toBe('one');

        const updated = await client.secrets.upsertEnvConfig({
          orgId: cfg.orgId,
          key,
          body: { scope: 'org', kind: 'variable', value: 'two' },
        });
        expect(updated.item.value).toBe('two');

        const deleted = await client.secrets.deleteEnvConfig({
          orgId: cfg.orgId,
          key,
          query: { scope: 'org', kind: 'variable' },
        });
        expect(deleted.deleted).toBe(true);
        const after = await client.secrets.listEnvConfig({ orgId: cfg.orgId });
        expect(after.items.some((i) => i.key === key)).toBe(false);
      },
      3 * 60_000,
    );
  });

  /* ------------------------------------------------------------------ */
  /* webhook endpoints CRUD + delivery pipeline                          */
  /* ------------------------------------------------------------------ */

  describe('webhook endpoints CRUD + delivery pipeline', () => {
    it(
      'creates, reads, updates an endpoint; ping produces a delivery + attempt; deletes it',
      async () => {
        // COMPROMISE (documented in the PR): CI has no public receiver, so
        // the round-trip is verified through the API's own delivery records
        // instead of an inbound request. The endpoint URL points at the
        // Slothbox API itself (POST /hello answers non-2xx) — a valid,
        // publicly routable sink that keeps dispatcher traffic in-house. We
        // assert the pipeline (delivery record + attempt with an HTTP
        // result + exact signed payload), NOT a 'delivered' status.
        // TODO(SLO-136 follow-up): replace with a true receiver-based
        // round-trip once a tunnel/receiver strategy for CI exists.
        const description = `${ciName(runId, 'webhook')} integration test`;
        const url = `${cfg.baseUrl}/hello`;

        const created = await client.webhooks.createEndpoint({
          orgId: cfg.orgId,
          body: { url, description, eventTypes: ['webhook.ping'] },
        });
        const endpointId = created.endpoint.endpointId;
        cleanup.push(`delete webhook endpoint ${endpointId}`, async () => {
          try {
            await client.webhooks.deleteEndpoint({ orgId: cfg.orgId, endpointId });
          } catch (error) {
            if (!isAlreadyGone(error)) throw error;
          }
        });
        expect(created.endpoint.url).toBe(url);
        expect(created.endpoint.eventTypes).toEqual(['webhook.ping']);
        expect(created.secret).toMatch(/^whsec_/); // shown once at creation
        const secret = created.secret;

        const fetched = await client.webhooks.getEndpoint({ orgId: cfg.orgId, endpointId });
        expect(fetched.endpoint.description).toBe(description);

        const updated = await client.webhooks.updateEndpoint({
          orgId: cfg.orgId,
          endpointId,
          body: { description: `${description} (updated)` }, // keeps the sdk-ci- prefix
        });
        expect(updated.endpoint.description).toBe(`${description} (updated)`);

        const { secret: fetchedSecret } = await client.webhooks.getSecret({
          orgId: cfg.orgId,
          endpointId,
        });
        expect(fetchedSecret).toBe(secret);

        // Trigger the ping and watch the pipeline produce the delivery.
        const { webhookId } = await client.webhooks.pingEndpoint({ orgId: cfg.orgId, endpointId });
        expect(webhookId).toBeTruthy();

        const delivery = await pollUntil(
          async () => {
            const page = await client.webhooks.listDeliveries({
              orgId: cfg.orgId,
              endpointId,
              query: { limit: 50 },
            });
            return page.items.find((d) => d.webhookId === webhookId);
          },
          { description: `delivery record for ping ${webhookId}`, timeoutMs: 4 * 60_000 },
        );
        expect(delivery.eventType).toBe('webhook.ping');

        // Payload material: the exact signed request body, as exposed by the API.
        const envelope = JSON.parse(delivery.payload) as { id?: string; type?: string };
        expect(envelope.id).toBe(webhookId);
        expect(envelope.type).toBe('webhook.ping');

        // The dispatcher must record at least one attempt with an HTTP result.
        const attempted = await pollUntil(
          async () => {
            const got = await client.webhooks.getDelivery({
              orgId: cfg.orgId,
              endpointId,
              deliveryId: delivery.deliveryId,
            });
            return got.delivery.attemptCount >= 1 ? got.delivery : undefined;
          },
          { description: `first delivery attempt for ${delivery.deliveryId}`, timeoutMs: 4 * 60_000 },
        );
        const firstAttempt = attempted.attempts[0];
        expect(firstAttempt).toBeDefined();
        expect(
          firstAttempt!.httpStatus !== undefined || firstAttempt!.error !== undefined,
        ).toBe(true);

        // Signature material: the deliveries API exposes the signed payload
        // but not the signature header, so verify the signing scheme locally
        // (test-local WebCrypto HMAC) over the REAL payload with the REAL
        // endpoint secret. TODO(SLO-128): swap for the SDK's webhook
        // verification toolkit once that sibling branch merges.
        const ts = Math.floor(Date.now() / 1000);
        const token = await signWebhookPayload(secret, webhookId, ts, delivery.payload);
        await expect(
          verifyWebhookSignature(secret, {
            webhookId,
            timestampSeconds: ts,
            payload: delivery.payload,
            signatureHeader: token,
          }),
        ).resolves.toBe(true);
        await expect(
          verifyWebhookSignature(secret, {
            webhookId,
            timestampSeconds: ts,
            payload: `${delivery.payload} `, // one byte off must fail
            signatureHeader: token,
          }),
        ).resolves.toBe(false);

        // Disable first (stops in-flight retries to the sink), then delete.
        await client.webhooks.updateEndpoint({
          orgId: cfg.orgId,
          endpointId,
          body: { status: 'disabled' },
        });
        await client.webhooks.deleteEndpoint({ orgId: cfg.orgId, endpointId });
        await expect(
          client.webhooks.getEndpoint({ orgId: cfg.orgId, endpointId }),
        ).rejects.toBeInstanceOf(NotFoundError);
      },
      12 * 60_000,
    );
  });

  /* ------------------------------------------------------------------ */
  /* the one full box lifecycle                                          */
  /* ------------------------------------------------------------------ */

  describe('environment lifecycle', () => {
    it(
      'launches one box, waits running, stops, waits stopped, terminates, verifies terminated',
      async () => {
        // Ceiling-awareness: the fixture org has one seat (5-box ceiling) and
        // a shared compute tier. After the start-of-suite sweep, any active
        // box belongs to a human (e.g. a manual check-sdk-fixture.sh --smoke)
        // — bail out loudly rather than fight over the ceiling.
        const { environments } = await client.environments.list({ orgId: cfg.orgId });
        const active = environments.filter((e) =>
          ['pending', 'provisioning', 'running', 'stopping'].includes(e.status),
        );
        if (active.length > 0) {
          const listing = active.map((e) => `${e.envId} (${e.name}, ${e.status})`).join(', ');
          throw new Error(
            `Another box is active in the fixture org — refusing to launch alongside it (single-box policy, seat ceiling): ${listing}. ` +
              'If this is a leftover from a manual smoke run, terminate it and re-run.',
          );
        }

        const name = ciName(runId, 'box');
        await sleep(COMPUTE_PACING_MS); // POST /environments is on the org compute tier
        let launched;
        try {
          launched = await client.environments.launch(
            { orgId: cfg.orgId, body: { templateId: cfg.templateId, name } },
            { idempotencyKey: name },
          );
        } catch (error) {
          if (error instanceof ConflictError) {
            throw new Error(
              `Launch returned 409 (${error.code ?? 'no code'}): ${error.message} — the fixture needs an active AWS connection and a baked template (SLO-123 runbook, steps 3–4).`,
            );
          }
          throw error;
        }
        const envId = launched.envId;
        // Registered before ANY assertion — if anything below throws, the
        // afterAll stack still terminates the box and polls it to terminal.
        cleanup.push(`terminate environment ${envId} (${name}) and verify terminal`, async () => {
          try {
            await client.environments.terminate({ orgId: cfg.orgId, envId });
          } catch (error) {
            if (!isAlreadyGone(error)) throw error;
          }
          await waitForEnvironmentStatus(client, { orgId: cfg.orgId, envId }, 'terminated', {
            timeoutMs: 10 * 60_000,
            log,
          });
        });
        log(`launched ${envId} (${launched.instanceType} in ${launched.region})`);
        expect(launched.name).toBe(name);
        expect(['pending', 'provisioning', 'running']).toContain(launched.status);

        const running = await waitForEnvironmentStatus(
          client,
          { orgId: cfg.orgId, envId },
          'running',
          { timeoutMs: 20 * 60_000, log },
        );
        expect(running?.status).toBe('running');

        const stopRequested = await client.environments.stop({ orgId: cfg.orgId, envId });
        expect(['stopping', 'stopped']).toContain(stopRequested.status);
        const stopped = await waitForEnvironmentStatus(
          client,
          { orgId: cfg.orgId, envId },
          'stopped',
          { timeoutMs: 10 * 60_000, log },
        );
        expect(stopped?.status).toBe('stopped');

        // Terminate (a stopped box still bills its root volume — never leave one).
        const terminateRequested = await client.environments.terminate({ orgId: cfg.orgId, envId });
        expect(['terminating', 'terminated']).toContain(terminateRequested.status);
        const terminated = await waitForEnvironmentStatus(
          client,
          { orgId: cfg.orgId, envId },
          'terminated',
          { timeoutMs: 10 * 60_000, log },
        );
        // undefined ⇒ the API already 404s it, which is equally terminal.
        if (terminated !== undefined) expect(terminated.status).toBe('terminated');
        log(`lifecycle complete for ${envId}`);
      },
      45 * 60_000,
    );
  });
});
