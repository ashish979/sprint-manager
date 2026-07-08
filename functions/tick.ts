/**
 * Scheduler tick (PLAN.md §2.1) — fired by EventBridge every 15 minutes.
 *
 * Phase 2 will make this sweep DynamoDB GSI1 for DUE items (standup prompts
 * in each participant's timezone, reminder nudges, shift rollovers) and act
 * on them idempotently. For Phase 0 it only proves the wiring.
 */
export const handler = async () => {
  console.log("tick: scheduler sweep (Phase 0 stub, no-op)");
  return { ok: true };
};
