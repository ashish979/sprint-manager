/**
 * DUE keys index scheduled work on GSI1 (PLAN.md §2.2) so the tick Lambda
 * can answer "what's due right now" with a single query.
 *
 * Standup times are restricted to 15-minute increments, matching the
 * EventBridge tick cadence.
 */

export const TICK_MINUTES = 15;

/** Floor a date to the tick boundary (UTC). */
export function floorToTick(date: Date): Date {
  const floored = new Date(date);
  floored.setUTCMinutes(
    Math.floor(floored.getUTCMinutes() / TICK_MINUTES) * TICK_MINUTES,
    0,
    0,
  );
  return floored;
}

/** GSI1 partition key for work due at the given instant, e.g. DUE#2026-07-07-09-15. */
export function dueKey(date: Date): string {
  const t = floorToTick(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `DUE#${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(
    t.getUTCDate(),
  )}-${pad(t.getUTCHours())}-${pad(t.getUTCMinutes())}`;
}
