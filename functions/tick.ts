import { sweep } from "../src/lib/standup/engine";

/**
 * Scheduler tick (PLAN.md §2.1) — EventBridge cron, quarter-hour aligned.
 *
 * Sweeps every standup participant: due prompts, reminder nudges, close
 * cutoffs. Rotations join the sweep in Phase 3.
 */
export const handler = async () => {
  const started = Date.now();
  await sweep();
  console.log(`tick: sweep done in ${Date.now() - started}ms`);
  return { ok: true };
};
