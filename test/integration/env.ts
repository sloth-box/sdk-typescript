/**
 * Fixture-org environment contract for the live integration suite (SLO-136).
 *
 * The env var names come from the SLO-123 provisioning runbook
 * (`sloth-box/ops`, `runbook-sdk-fixture-provision.md`):
 *
 * - `SLOTHBOX_SDK_TEST_KEY`          — fixture org service-account key (secret)
 * - `SLOTHBOX_SDK_TEST_ORG_ID`       — fixture orgId
 * - `SLOTHBOX_SDK_TEST_TEMPLATE_ID`  — the baked minimal template's id
 * - `SLOTHBOX_API_BASE_URL`          — optional, default https://api.slothbox.dev
 *
 * Missing key ⇒ the whole live suite SKIPS (one clear line, not a failure):
 * the fixture org is provisioned by a human checklist (SLO-123) and may not
 * exist yet. A key WITHOUT the ids is a misconfiguration and fails loudly —
 * half-set credentials are a human error worth surfacing, not skipping.
 */

export const DEFAULT_LIVE_BASE_URL = 'https://api.slothbox.dev';

/** Resolved fixture credentials — present only in `mode: 'live'`. */
export interface LiveFixtureEnv {
  mode: 'live';
  apiKey: string;
  orgId: string;
  templateId: string;
  baseUrl: string;
}

export type FixtureEnv =
  | LiveFixtureEnv
  | { mode: 'skip'; reason: string }
  | { mode: 'misconfigured'; problems: string[] };

/** Read an env var without assuming a Node runtime (the SDK has no `@types/node`). */
function envVar(name: string): string | undefined {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  const value = proc?.env?.[name];
  return value === undefined || value.trim() === '' ? undefined : value.trim();
}

/** One-line skip reason, used by the suite and echoed into CI logs. */
export const SKIP_REASON =
  'SLOTHBOX_SDK_TEST_KEY is not set — live fixture org not provisioned yet (SLO-123 runbook); skipping the live integration suite.';

export function loadFixtureEnv(): FixtureEnv {
  const apiKey = envVar('SLOTHBOX_SDK_TEST_KEY');
  if (apiKey === undefined) {
    return { mode: 'skip', reason: SKIP_REASON };
  }

  const orgId = envVar('SLOTHBOX_SDK_TEST_ORG_ID');
  const templateId = envVar('SLOTHBOX_SDK_TEST_TEMPLATE_ID');
  const problems: string[] = [];
  if (!apiKey.startsWith('sk_')) {
    problems.push('SLOTHBOX_SDK_TEST_KEY does not start with "sk_" — not a service-account key.');
  }
  if (orgId === undefined) {
    problems.push('SLOTHBOX_SDK_TEST_KEY is set but SLOTHBOX_SDK_TEST_ORG_ID is missing.');
  }
  if (templateId === undefined) {
    problems.push('SLOTHBOX_SDK_TEST_KEY is set but SLOTHBOX_SDK_TEST_TEMPLATE_ID is missing.');
  }
  if (problems.length > 0) return { mode: 'misconfigured', problems };

  return {
    mode: 'live',
    apiKey,
    orgId: orgId as string,
    templateId: templateId as string,
    baseUrl: envVar('SLOTHBOX_API_BASE_URL') ?? DEFAULT_LIVE_BASE_URL,
  };
}
