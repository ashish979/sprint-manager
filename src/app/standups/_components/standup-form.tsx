import { ParticipantPicker } from "@/app/_components/participant-picker";
import type { UserOption } from "@/lib/slack/directory";
import { DEFAULT_QUESTIONS, STANDUP_DEFAULTS, STANDUP_TEMPLATES, type StandupConfig } from "@/lib/types";

import { QuestionsEditor } from "./questions-editor";

/** Shared create/edit form for a standup — see new/page.tsx and [id]/edit/page.tsx. */

const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

const inputClass =
  "mt-1 w-full rounded border px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";
const labelClass = "block text-sm font-medium mt-4";
const sectionClass = "mt-8 border-t pt-6 dark:border-zinc-800";
const sectionHeadingClass =
  "text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400";

export function StandupForm({
  action,
  secondaryAction,
  secondaryLabel,
  standup,
  templateId,
  submitLabel,
  users,
}: {
  action: (formData: FormData) => Promise<void>;
  /** Optional second submit button (via formAction) — e.g. "Create and start", create-only. */
  secondaryAction?: (formData: FormData) => Promise<void>;
  secondaryLabel?: string;
  standup?: StandupConfig;
  templateId?: string;
  submitLabel: string;
  /** null when the Slack lookup is unavailable — the picker is simply omitted. */
  users?: UserOption[] | null;
}) {
  const weekdays = standup?.weekdays ?? STANDUP_DEFAULTS.weekdays;

  // An explicit ?template= always wins (deliberate intent to replace questions),
  // then an existing standup's own questions, then the plain default.
  const template = templateId ? STANDUP_TEMPLATES.find((t) => t.id === templateId) : undefined;
  const questionsDefault = template?.questions ?? standup?.questions ?? DEFAULT_QUESTIONS;

  // When the picker is available, it becomes the one place that shows (and can
  // remove) the current roster — so it's pre-checked with today's participants,
  // and the id textarea starts empty (kept only for ids the directory can't
  // resolve). If the Slack lookup failed, the picker doesn't render at all, so
  // the textarea falls back to carrying the current participants itself.
  const currentParticipants =
    standup?.participants.map((id) => ({
      value: id,
      label: users?.find((u) => u.id === id)?.name ?? id,
    })) ?? [];
  const participantsTextareaDefault = users ? "" : standup?.participants.join(" ");

  return (
    <form action={action} className="mt-6">
      {standup && <input type="hidden" name="id" value={standup.id} />}

      <section className="mt-6">
        <h2 className={sectionHeadingClass}>Basics</h2>

        <label className={labelClass}>
          Name
          <input
            name="name"
            required
            defaultValue={standup?.name}
            placeholder="Daily standup"
            className={inputClass}
          />
        </label>

        <label className={labelClass}>
          Broadcast channel id
          <input
            name="channel"
            required
            defaultValue={standup?.channel}
            placeholder="C0123456789 (invite @sprint-manager to it)"
            className={inputClass}
          />
        </label>

        {users && (
          <div className={labelClass}>
            Participants
            <ParticipantPicker
              name="participantsPicker"
              options={users.map((u) => ({ value: u.id, label: u.name }))}
              defaultSelected={currentParticipants}
            />
          </div>
        )}

        <label className={labelClass}>
          {users
            ? "Add someone not showing up above, by Slack user id (optional)"
            : "Participants — Slack user ids, space/comma separated"}
          <textarea
            name="participants"
            rows={2}
            defaultValue={participantsTextareaDefault}
            placeholder="U0123ABC U0456DEF"
            className={inputClass}
          />
        </label>
      </section>

      <section className={sectionClass}>
        <h2 className={sectionHeadingClass}>Questions</h2>
        <QuestionsEditor
          key={template?.id ?? standup?.id ?? "default"}
          name="questions"
          defaultQuestions={questionsDefault}
        />
      </section>

      <section className={sectionClass}>
        <h2 className={sectionHeadingClass}>Schedule</h2>

        <div className="mt-4 flex gap-6">
          <label className="text-sm font-medium">
            Time (participant’s local)
            <input
              type="time"
              name="time"
              step={900}
              defaultValue={standup?.time ?? STANDUP_DEFAULTS.time}
              className={inputClass}
            />
          </label>
          <fieldset className="text-sm font-medium">
            Days
            <div className="mt-2 flex gap-3">
              {WEEKDAYS.map((d) => (
                <label key={d.value} className="flex items-center gap-1 font-normal">
                  <input
                    type="checkbox"
                    name="weekdays"
                    value={d.value}
                    defaultChecked={(weekdays as readonly number[]).includes(d.value)}
                  />
                  {d.label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="mt-4 flex gap-6">
          <label className="text-sm font-medium">
            Remind after (minutes)
            <input
              type="number"
              name="remindAfterMinutes"
              min={15}
              step={15}
              defaultValue={standup?.remindAfterMinutes ?? STANDUP_DEFAULTS.remindAfterMinutes}
              className={inputClass}
            />
          </label>
          <label className="text-sm font-medium">
            Max reminders
            <input
              type="number"
              name="maxReminders"
              min={0}
              max={10}
              defaultValue={standup?.maxReminders ?? STANDUP_DEFAULTS.maxReminders}
              className={inputClass}
            />
          </label>
          <label className="text-sm font-medium">
            Close at (local)
            <input
              type="time"
              name="closeAtTime"
              step={900}
              defaultValue={standup?.closeAtTime ?? STANDUP_DEFAULTS.closeAtTime}
              className={inputClass}
            />
          </label>
        </div>
      </section>

      <section className={sectionClass}>
        <h2 className={sectionHeadingClass}>Privacy</h2>
        <label className="mt-4 flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="anonymous" defaultChecked={standup?.anonymous ?? false} />
          Anonymous responses (hides who wrote what, in Slack and on this dashboard)
        </label>
      </section>

      <div className="mt-8 flex gap-3">
        <button
          type="submit"
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-80 dark:bg-white dark:text-black dark:hover:opacity-90"
        >
          {submitLabel}
        </button>
        {secondaryAction && (
          <button
            type="submit"
            formAction={secondaryAction}
            className="rounded border px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            {secondaryLabel}
          </button>
        )}
      </div>
    </form>
  );
}
