import { timeToMinutes } from "@/lib/tz";
import type { Cadence } from "@/lib/types";

/**
 * Pure cadence math for the tick sweep (PLAN.md §2.4).
 *
 * Unlike standups, a rotation's shift boundary isn't per-participant
 * timezone — one shared IST reference clock applies to the whole rotation
 * (the team is India-based, so there's no per-member timezone to anchor to
 * the way standups do).
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

/** True if `date`'s weekday is in `activeDays` (empty/undefined = every day). */
export function isActiveDay(date: string, activeDays?: number[]): boolean {
  if (!activeDays || activeDays.length === 0) return true;
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return activeDays.includes(weekday);
}

/**
 * The date the next shift after `from` should start, per cadence. If
 * `activeDays` is set, a computed date on a non-active day rolls forward to
 * the next active day (so e.g. a daily rotation can skip weekends).
 */
export function nextShiftDate(cadence: Cadence, from: string, activeDays?: number[]): string {
  let next: string;
  switch (cadence) {
    case "daily":
      next = addDays(from, 1);
      break;
    case "weekdays": {
      next = addDays(from, 1);
      while (!isWeekday(next)) next = addDays(next, 1);
      break;
    }
    case "weekly":
      next = addDays(from, 7);
      break;
    case "biweekly":
      next = addDays(from, 14);
      break;
    case "monthly":
      next = addMonths(from, 1);
      break;
  }
  while (!isActiveDay(next, activeDays)) next = addDays(next, 1);
  return next;
}

/**
 * Should a new shift start now? `announceTime` ("HH:MM", IST) is the earliest
 * local time of day a shift may start — same "window, not exact-time-match"
 * idempotency approach as the standup scheduler: a delayed tick still
 * catches up regardless of time of day once the due *date* has passed, it
 * only gates the very first tick on the due date itself.
 */
export function isShiftDue(
  cadence: Cadence,
  local: { date: string; minutes: number },
  announceTime: string,
  lastStartDate?: string,
  activeDays?: number[],
): boolean {
  const announceMinutes = timeToMinutes(announceTime);
  // First shift ever: start on the first active day at/after announceTime.
  if (!lastStartDate) {
    return isActiveDay(local.date, activeDays) && local.minutes >= announceMinutes;
  }

  const dueDate = nextShiftDate(cadence, lastStartDate, activeDays);
  if (local.date < dueDate) return false;
  if (local.date === dueDate) return local.minutes >= announceMinutes;
  return true; // overdue — a delayed tick catches up any time of day
}
