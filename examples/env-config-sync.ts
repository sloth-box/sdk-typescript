/**
 * env-config sync — push secrets & variables from CI into an org.
 *
 * Reads values out of THIS process's environment (i.e. your CI provider's
 * secret store) and upserts them into the org's env-config, from where they
 * are injected into boxes at launch. Run it as a step in your deploy
 * pipeline, on every release.
 *
 * Idempotent by construction: the API's PUT is an UPSERT, so re-running the
 * sync is always safe — same value: effective no-op; changed value:
 * overwritten; never a duplicate, never an error for already existing.
 * (Upsert never deletes, though — removing a key is an explicit
 * `deleteEnvConfig`, see the bottom of main().)
 *
 * ⚠️  SCOPES — read this before copying:
 *   - This example writes ORG scope: injected into EVERY box in the org.
 *     Don't put a per-project value at org scope.
 *   - Injection precedence is environment > template > repo > org — a
 *     narrower scope with the same key OVERRIDES what you sync here.
 *   - repo scope binds by normalized git URL (org-global, not per-template):
 *     it needs a `repoId` from `secrets.listOrgRepos()` and applies to every
 *     template/box using that repo.
 *   - kind 'secret' is stored in the org's own AWS account (SSM Parameter
 *     Store or Secrets Manager) and is WRITE-ONLY through the API — values
 *     are never returned. Requires the org's secrets backend to be
 *     configured first; this example preflights that and tells you if not.
 *   - kind 'variable' is plain config — its value IS readable by org members
 *     via the API and dashboard. Never put credentials in a variable.
 *   - Upserts need the OWNER role: use a service-account API key with owner
 *     permissions in CI (a member-scoped key gets a 403).
 *
 * Environment contract:
 *   SLOTHBOX_API_KEY    required   sk_… service-account API key (owner role)
 *   SLOTHBOX_ORG_ID     required   the organization to sync into
 *   SLOTHBOX_BASE_URL   optional   API base URL override
 *   DATABASE_URL        optional   synced as an org-scope SECRET when set
 *   SENTRY_DSN          optional   synced as an org-scope SECRET when set
 *   LOG_LEVEL           optional   synced as an org-scope VARIABLE when set
 *   (edit MANIFEST below to sync your own keys)
 *
 * Run (from examples/):  npm run env-config-sync
 */

import { Slothbox } from '@slothbox/sdk';

interface SyncEntry {
  /** The env var name — both inside the launched boxes and in this CI job. */
  key: string;
  /** 'secret' → org's AWS secret store, write-only. 'variable' → plain, readable. */
  kind: 'secret' | 'variable';
}

/** What this pipeline owns. Entries whose env var is unset are skipped. */
const MANIFEST: SyncEntry[] = [
  { key: 'DATABASE_URL', kind: 'secret' },
  { key: 'SENTRY_DSN', kind: 'secret' },
  { key: 'LOG_LEVEL', kind: 'variable' },
];

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable ${name}`);
    process.exit(1);
  }
  return value;
}

const orgId = requiredEnv('SLOTHBOX_ORG_ID');

// Reads SLOTHBOX_API_KEY itself when apiKey is omitted.
const slothbox = new Slothbox(
  process.env.SLOTHBOX_BASE_URL ? { baseUrl: process.env.SLOTHBOX_BASE_URL } : {},
);

async function main(): Promise<void> {
  // Preflight: secrets can only be stored once an owner has configured the
  // org's secrets backend (SSM or Secrets Manager, in the org's own AWS
  // account). Without it, secret upserts 400 — check up front and say why.
  const current = await slothbox.secrets.listEnvConfig({ orgId });
  const wantsSecrets = MANIFEST.some((entry) => entry.kind === 'secret' && process.env[entry.key]);
  if (wantsSecrets && !current.secretsConfig) {
    console.error(
      'This org has no secrets backend configured yet. An owner must choose SSM or Secrets ' +
        'Manager first (dashboard → organization settings → secrets, or ' +
        '`slothbox.secrets.setConfig()`); only then can secrets be stored.',
    );
    process.exit(1);
  }

  // Only used to report create vs update — the upsert itself never needs it.
  const existing = new Set(
    current.items
      .filter((item) => item.scope === 'org')
      .map((item) => `${item.kind}:${item.key}`),
  );

  for (const entry of MANIFEST) {
    const value = process.env[entry.key];
    if (!value) {
      console.log(`[skip]    ${entry.key} — not set in this environment`);
      continue;
    }

    // PUT /organizations/{orgId}/env-config/{key} — an upsert. Re-running
    // with the same value is a no-op; with a new value it overwrites.
    const { item } = await slothbox.secrets.upsertEnvConfig({
      orgId,
      key: entry.key,
      body: { scope: 'org', kind: entry.kind, value },
      // Narrower scopes instead (see the scope warnings up top):
      //   repo:      body: { scope: 'repo', kind, value, repoId, repo }
      //              (repoId/repo from `slothbox.secrets.listOrgRepos({ orgId })`)
      //   template:  body: { scope: 'template', kind, value, templateId }
    });
    const verb = existing.has(`${entry.kind}:${entry.key}`) ? 'updated' : 'created';
    console.log(`[${verb}] ${entry.kind} ${item.key} (org scope, updatedAt ${item.updatedAt})`);
  }

  // Upsert never deletes: when this pipeline stops owning a key, remove it
  // explicitly (also idempotent — deleting a missing key reports deleted:false):
  //
  //   await slothbox.secrets.deleteEnvConfig({
  //     orgId,
  //     key: 'OLD_KEY',
  //     query: { scope: 'org', kind: 'secret' },
  //   });

  console.log('[done]    env-config sync complete');
}

main().catch((error) => {
  console.error('[sync]    failed:', error);
  process.exitCode = 1;
});
