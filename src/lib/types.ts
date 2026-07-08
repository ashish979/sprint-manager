/** Domain types for the DynamoDB single-table entities (PLAN.md §2.2). */

export interface StandupConfig {
  id: string;
  name: string;
  /** Asked in order; answers align by index. */
  questions: string[];
  /** Local time "HH:MM" in each participant's timezone, 15-min increments. */
  time: string;
  /** Days the standup runs; 0 = Sunday … 6 = Saturday. */
  weekdays: number[];
  /** Slack user ids. */
  participants: string[];
  /** Broadcast channel id (C…). */
  channel: string;
  /** Minutes without a response before each nudge DM. */
  remindAfterMinutes: number;
  maxReminders: number;
  /** Local time "HH:MM"; pending reports are marked missed from here on. */
  closeAtTime: string;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_QUESTIONS = [
  "What did you do since last report?",
  "What will you do today?",
  "Any blockers?",
  "How do you feel?",
];

export const STANDUP_DEFAULTS = {
  time: "09:30",
  weekdays: [1, 2, 3, 4, 5],
  remindAfterMinutes: 120,
  maxReminders: 2,
  closeAtTime: "23:45",
} as const;

export type ReportStatus = "pending" | "submitted" | "skipped" | "missed";

export interface Report {
  standupId: string;
  /** Participant's local calendar date yyyy-mm-dd. */
  date: string;
  userId: string;
  status: ReportStatus;
  answers: string[];
  promptedAt: string;
  remindersSent: number;
  /** DM message carrying the Answer/Skip buttons (updated after submit). */
  dmChannel?: string;
  dmTs?: string;
  /** Threaded reply under the day's anchor message. */
  replyTs?: string;
  submittedAt?: string;
}

export interface StandupDay {
  standupId: string;
  date: string;
  channel: string;
  /** Anchor message ts — thread parent for all replies. */
  threadTs?: string;
  status: "open" | "closed";
  createdAt: string;
}

export interface UserProfile {
  userId: string;
  /** IANA timezone synced from Slack (users.info .tz). */
  tz: string;
  name?: string;
  updatedAt: string;
}
