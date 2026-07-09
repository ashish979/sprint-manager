import { type LocalParts, timeToMinutes } from "@/lib/tz";
import type { OutOfOfficeRange, StandupConfig } from "@/lib/types";

/**
 * Pure scheduling decisions for the tick sweep (PLAN.md §2.3).
 *
 * The tick fires every 15 minutes; instead of exact-time matching (fragile
 * when a tick is delayed) a prompt is "due" for the whole window between the
 * scheduled time and the close cutoff — idempotency comes from the REPORT
 * item's conditional create, not from time equality.
 */

type ScheduleFields = Pick<
  StandupConfig,
  "time" | "weekdays" | "closeAtTime" | "remindAfterMinutes" | "maxReminders"
>;

/** Should this participant be prompted now (no report exists yet today)? */
export function isPromptDue(local: LocalParts, config: ScheduleFields): boolean {
  return (
    config.weekdays.includes(local.weekday) &&
    local.minutes >= timeToMinutes(config.time) &&
    local.minutes < timeToMinutes(config.closeAtTime)
  );
}

export type PendingAction =
  | { type: "none" }
  | { type: "remind"; reminderNumber: number }
  | { type: "miss" };

/** Next action for a report still pending. */
export function pendingReportAction(opts: {
  now: Date;
  local: LocalParts;
  reportDate: string;
  promptedAt: string;
  remindersSent: number;
  config: ScheduleFields;
}): PendingAction {
  const { now, local, reportDate, promptedAt, remindersSent, config } = opts;

  // Past the cutoff — or the local day rolled over entirely.
  if (local.date !== reportDate || local.minutes >= timeToMinutes(config.closeAtTime)) {
    return { type: "miss" };
  }

  const elapsedMinutes = (now.getTime() - Date.parse(promptedAt)) / 60_000;
  const nextReminderAt = config.remindAfterMinutes * (remindersSent + 1);
  if (remindersSent < config.maxReminders && elapsedMinutes >= nextReminderAt) {
    return { type: "remind", reminderNumber: remindersSent + 1 };
  }

  return { type: "none" };
}

/** Is `date` (yyyy-mm-dd) inside the participant's active out-of-office window? */
export function isOutOfOffice(date: string, range?: OutOfOfficeRange): boolean {
  if (!range) return false;
  return date >= range.from && date <= range.to;
}
