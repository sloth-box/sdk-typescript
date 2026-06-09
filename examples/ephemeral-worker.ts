/**
 * Ephemeral worker — launch a box per task, do the work, ALWAYS terminate.
 *
 * The scale-to-zero pattern: a fresh box exists only for the duration of one
 * unit of work, so you pay for compute only while the task runs. The whole
 * point of this example is the cost-safety scaffolding around the happy path
 * — copy all of it, not just the launch:
 *
 *   1. IDEMPOTENT LAUNCH — the launch POST carries an `Idempotency-Key`
 *      derived from your task id. If this process dies after the POST and the
 *      task is retried, the retried launch returns the ORIGINAL box instead
 *      of paying for a duplicate.
 *   2. GUARANTEED TERMINATE — everything after the launch runs inside
 *      try/finally, so termination runs on success, on a failed waiter, and
 *      on a failed task alike. A leaked box bills until someone notices.
 *   3. CONFIRMED TERMINATE — after requesting termination we poll until the
 *      box actually reaches `terminated`, and exit non-zero if we couldn't
 *      confirm. A box you cannot confirm dead is a box you must assume is
 *      still billing.
 *
 * Environment contract:
 *   SLOTHBOX_API_KEY       required   sk_… service-account API key
 *   SLOTHBOX_ORG_ID        required   the organization to launch in
 *   SLOTHBOX_TEMPLATE_ID   required   a baked (`ready`) template to launch
 *   SLOTHBOX_TASK_ID       optional   stable id for this unit of work — it
 *                                     derives the Idempotency-Key, so a re-run
 *                                     with the same task id re-attaches to the
 *                                     same box instead of launching a second
 *                                     one. Defaults to a random id (no
 *                                     cross-run dedupe).
 *   SLOTHBOX_BASE_URL      optional   API base URL override
 *
 * Run (from examples/):  npm run ephemeral-worker
 */

import { NotFoundError, Slothbox, type components } from '@slothbox/sdk';

type Environment = components['schemas']['Environment'];

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable ${name}`);
    process.exit(1);
  }
  return value;
}

const orgId = requiredEnv('SLOTHBOX_ORG_ID');
const templateId = requiredEnv('SLOTHBOX_TEMPLATE_ID');
const taskId = process.env.SLOTHBOX_TASK_ID ?? `adhoc-${crypto.randomUUID()}`;

// Reads SLOTHBOX_API_KEY itself when apiKey is omitted.
const slothbox = new Slothbox(
  process.env.SLOTHBOX_BASE_URL ? { baseUrl: process.env.SLOTHBOX_BASE_URL } : {},
);

/**
 * Your task goes here. The box is `running` when this is called — connect to
 * it (SSH, the daemon API, …), run the build/job/agent, collect results.
 * This placeholder just pretends for a few seconds.
 */
async function doWork(box: Environment): Promise<void> {
  console.log(`[work]    running the task on ${box.envId} (${box.instanceType} in ${box.region})…`);
  await new Promise((resolve) => setTimeout(resolve, 5_000));
  console.log('[work]    done');
}

// Same pacing as the SDK's built-in waiters: status reads share the org's
// compute rate tier (they assume-role into your AWS account), so don't poll
// hot. Instance termination usually confirms well within a couple of minutes.
const CONFIRM_POLL_INTERVAL_MS = 7_000;
const CONFIRM_TIMEOUT_MS = 5 * 60_000;

/**
 * Request termination, then CONFIRM the box actually died rather than taking
 * "the request was accepted" on faith. (`terminated` is a fail-fast state for
 * the SDK's ready/stopped waiters — by design there is no waitUntilTerminated
 * — so the confirmation here is a small explicit poll of `environments.get`.)
 */
async function terminateAndConfirm(envId: string): Promise<void> {
  // Termination is idempotent — requesting it on an already-terminating box
  // is fine, so a retried cleanup never errors for having run twice.
  const requested = await slothbox.environments.terminate({ orgId, envId });
  console.log(`[cleanup] termination requested for ${envId} (status: ${requested.status})`);

  const deadline = Date.now() + CONFIRM_TIMEOUT_MS;
  for (;;) {
    let status: Environment['status'];
    try {
      status = (await slothbox.environments.get({ orgId, envId })).status;
    } catch (error) {
      if (error instanceof NotFoundError) {
        console.log(`[cleanup] box ${envId} is gone`);
        return;
      }
      throw error;
    }
    if (status === 'terminated') {
      console.log(`[cleanup] box ${envId} confirmed terminated`);
      return;
    }
    if (Date.now() >= deadline) {
      throw new Error(
        `could not confirm termination of ${envId} within ${CONFIRM_TIMEOUT_MS}ms ` +
          `(last status: "${status}")`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, CONFIRM_POLL_INTERVAL_MS));
  }
}

async function main(): Promise<void> {
  // 1. Launch — always with an Idempotency-Key tied to the task, so retries
  //    of this task can never start a second box.
  //
  //    (`environments.launchAndWait()` collapses steps 1+2 — and also always
  //    sends an Idempotency-Key — but launching and waiting separately keeps
  //    the envId in hand on EVERY failure path, which is what makes the
  //    finally block below airtight.)
  const box = await slothbox.environments.launch(
    { orgId, body: { templateId, name: `worker-${taskId}` } },
    { idempotencyKey: `ephemeral-worker:${taskId}` },
  );
  console.log(`[launch]  box ${box.envId} accepted (status: ${box.status})`);

  // From this line on the box exists — so from this line on, everything runs
  // under try/finally and termination is unconditional.
  try {
    // 2. Wait until it's actually usable. Throws WaiterStateError if the
    //    launch fails, WaiterTimeoutError if it never settles — both still
    //    hit the finally block.
    const ready = await slothbox.environments.waitUntilReady({ orgId, envId: box.envId });
    console.log(`[launch]  box ${ready.envId} is running`);

    // 3. Do the work.
    await doWork(ready);
  } finally {
    // 4. Terminate — NO MATTER WHAT happened above.
    try {
      await terminateAndConfirm(box.envId);
    } catch (cleanupError) {
      // Don't mask the task's own error with the cleanup error — but make a
      // possible leak impossible to miss, and fail the run.
      console.error(
        `[cleanup] FAILED to confirm termination of box ${box.envId} — it may still be ` +
          'running (and billing). Terminate it manually:',
        cleanupError,
      );
      process.exitCode = 1;
    }
  }
}

main().catch((error) => {
  console.error('[task]    failed:', error);
  process.exitCode = 1;
});
