import { sweep as sweepRotations } from "../src/lib/rotation/engine";
import { sweep as sweepStandups } from "../src/lib/standup/engine";

/**
 * Scheduler tick (PLAN.md §2.1) — EventBridge cron, quarter-hour aligned.
 *
 * Sweeps every standup participant (due prompts, reminder nudges, close
 * cutoffs) and every rotation (shift rollovers).
 */
export const handler = async () => {
  const started = Date.now();
  await sweepStandups();
  await sweepRotations();
  console.log(`tick: sweep done in ${Date.now() - started}ms`);
  return { ok: true };
};
