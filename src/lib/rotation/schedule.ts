import type { Cadence } from "@/lib/types";

/**
 * Pure cadence math for the tick sweep (PLAN.md §2.4).
 *
 * Unlike standups, a rotation's shift boundary isn't per-participant
 * timezone — one calendar-date boundary applies to the whole rotation, so
 * this works entirely in plain yyyy-mm-dd strings (UTC).
 */

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Adds a calendar month, clamping to the last day if the target month is shorter. */
function addMonths(date: string, months: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  if (d.getUTCDate() !== day) d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}

function isWeekday(date: string): boolean {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return weekday >= 1 && weekday <= 5;
}

/** The date the next shift after `from` should start, per cadence. */
export function nextShiftDate(cadence: Cadence, from: string): string {
  switch (cadence) {
    case "daily":
      return addDays(from, 1);
    case "weekdays": {
      let next = addDays(from, 1);
      while (!isWeekday(next)) next = addDays(next, 1);
      return next;
    }
    case "weekly":
      return addDays(from, 7);
    case "biweekly":
      return addDays(from, 14);
    case "monthly":
      return addMonths(from, 1);
  }
}

/**
 * Should a new shift start today? True immediately if the rotation has
 * never fired — same "window, not exact-time-match" idempotency approach
 * as the standup scheduler: a delayed tick still catches up.
 */
export function isShiftDue(cadence: Cadence, today: string, lastStartDate?: string): boolean {
  if (!lastStartDate) return true;
  return today >= nextShiftDate(cadence, lastStartDate);
}
