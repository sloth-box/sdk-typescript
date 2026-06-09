import { defineConfig } from 'vitest/config';

/**
 * Config for the LIVE integration suite (SLO-136) — `npm run test:integration`.
 *
 * Deliberately separate from `vitest.config.ts`: the unit suite
 * (`npm test`, per-PR CI) must never pick these tests up. This suite runs
 * against the production API inside the dedicated fixture org, on a schedule
 * + manual dispatch only (`.github/workflows/integration.yml`), and skips
 * itself cleanly when `SLOTHBOX_SDK_TEST_KEY` is absent.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/integration/**/*.test.ts'],

    // The fixture org shares ONE compute rate tier (10/min, 60/hr) and a
    // single-box policy — nothing may run in parallel, ever.
    fileParallelism: false,
    sequence: { concurrent: false },
    maxConcurrency: 1,

    // Live operations are slow by design (EC2 launch ≈ 5–15 min; polls are
    // ≥7s apart). Long-running tests set their own explicit timeouts; these
    // are the defaults/hook ceilings (hooks include the teardown sweep, which
    // may need to terminate a leftover box and verify it).
    testTimeout: 120_000,
    hookTimeout: 25 * 60_000,

    // No retries: a flaky pass could hide a leaked resource.
    retry: 0,
  },
});
