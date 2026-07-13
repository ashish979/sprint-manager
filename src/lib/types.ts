/** Domain types for the DynamoDB single-table entities (PLAN.md §2.2). */

export interface QuestionConfig {
  text: string;
  /** false = participants can submit without answering this one. */
  required: boolean;
}

export interface StandupConfig {
  id: string;
  name: string;
  /** Asked in order; answers align by index. */
  questions: QuestionConfig[];
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
  /**
   * Hides the author on the public Slack thread reply and on the admin
   * dashboard. Participation tracking (who has/hasn't responded) stays
   * fully identified — only the answer-content-to-identity mapping is hidden.
   */
  anonymous?: boolean;
  /**
   * When true the scheduler skips this standup entirely (no prompts, reminders
   * or closes) but all past days/reports are retained — a reversible
   * alternative to deleting. Manual "Start now" still works.
   */
  paused?: boolean;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_QUESTIONS: QuestionConfig[] = [
  { text: "What did you do since last report?", required: true },
  { text: "What will you do today?", required: true },
  { text: "Any blockers?", required: true },
];

export const STANDUP_DEFAULTS = {
  time: "09:30",
  weekdays: [1, 2, 3, 4, 5],
  remindAfterMinutes: 120,
  maxReminders: 2,
  closeAtTime: "23:45",
} as const;

export interface StandupTemplate {
  id: string;
  label: string;
  questions: QuestionConfig[];
}

export const STANDUP_TEMPLATES: StandupTemplate[] = [
  { id: "daily", label: "Daily Standup", questions: [...DEFAULT_QUESTIONS] },
  {
    id: "retro",
    label: "Sprint Retro",
    questions: [
      { text: "What went well this sprint?", required: true },
      { text: "What didn't go well?", required: true },
      { text: "What should we change next sprint?", required: true },
      { text: "Any shoutouts?", required: false },
    ],
  },
  {
    id: "wellbeing",
    label: "Well-being Check-in",
    questions: [
      { text: "How are you feeling this week (1-5)?", required: true },
      { text: "What's energizing you right now?", required: false },
      { text: "What's draining you right now?", required: false },
      { text: "Anything you need support with?", required: false },
    ],
  },
];

export type ReportStatus = "pending" | "submitted" | "skipped" | "missed" | "ooo";

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

export interface OutOfOfficeRange {
  /** yyyy-mm-dd, inclusive. */
  from: string;
  to: string;
}

export interface UserProfile {
  userId: string;
  /** IANA timezone synced from Slack (users.info .tz). */
  tz: string;
  name?: string;
  /**
   * Personal override of a standup's prompt time, "HH:MM", 15-min
   * increments. Global — applies to every standup this person is in.
   */
  preferredTime?: string;
  /** Active out-of-office window; a single range at a time. */
  outOfOffice?: OutOfOfficeRange;
  updatedAt: string;
}

/** Slack-synced channel display name, so pages can show #name instead of a raw id. */
export interface ChannelInfo {
  channelId: string;
  name: string;
  updatedAt: string;
}

export type Cadence = "daily" | "weekdays" | "weekly" | "biweekly" | "monthly";

export interface RotationConfig {
  id: string;
  name: string;
  /** Ordered Slack user ids; round-robin cycles through this list. */
  members: string[];
  cadence: Cadence;
  /**
   * Days a shift may start; 0 = Sunday … 6 = Saturday. Omitted/empty = every
   * day. A cadence date landing on a non-active day rolls forward to the next
   * active one — lets a rotation skip weekends (activeDays = [1..5]).
   */
  activeDays?: number[];
  /**
   * Free-text notes shown in the Slack announce and on-duty DM (e.g. the
   * duties the on-call person owns). Optional.
   */
  notes?: string;
  /** Announce channel id (C…). */
  channel: string;
  /** Slack user group id (S…) kept pointed at the on-duty member. */
  usergroupId?: string;
  /**
   * Index into `members` for the next auto-assigned shift. Advances every
   * shift regardless of overrides, so the round-robin stays fair even when
   * a member's turn is overridden or skipped.
   */
  cursor: number;
  /**
   * Local time "HH:MM" (IST — the whole team is India-based, so unlike
   * standups there's no per-member timezone to anchor to), 15-min
   * increments. A shift due today won't actually fire until this time.
   */
  announceTime?: string;
  createdAt: string;
  updatedAt: string;
}

export const ROTATION_DEFAULTS = {
  cadence: "weekly" as Cadence,
  announceTime: "09:30",
};

export type ShiftSource = "auto" | "override" | "swap";

export interface Shift {
  rotationId: string;
  /** Calendar date (UTC) this shift starts. */
  startDate: string;
  assignee: string;
  source: ShiftSource;
  createdAt: string;
}

export interface ShiftOverride {
  rotationId: string;
  /** Calendar date (UTC) the override applies to. */
  date: string;
  assignee: string;
  source: Extract<ShiftSource, "override" | "swap">;
  createdAt: string;
}
