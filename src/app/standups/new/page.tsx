import { redirect } from "next/navigation";

import { isAdminSession } from "@/lib/authz";
import { DEFAULT_QUESTIONS, STANDUP_DEFAULTS } from "@/lib/types";

import { createStandupAction } from "../actions";

export const dynamic = "force-dynamic";

const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

const inputClass = "mt-1 w-full rounded border px-3 py-2 text-sm";
const labelClass = "block text-sm font-medium mt-4";

export default async function NewStandupPage() {
  if (!(await isAdminSession())) redirect("/standups");

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">New standup</h1>

      <form action={createStandupAction} className="mt-6">
        <label className={labelClass}>
          Name
          <input name="name" required placeholder="Daily standup" className={inputClass} />
        </label>

        <label className={labelClass}>
          Broadcast channel id
          <input
            name="channel"
            required
            placeholder="C0123456789 (invite @sprint-manager to it)"
            className={inputClass}
          />
        </label>

        <label className={labelClass}>
          Participants — Slack user ids, space/comma separated
          <textarea
            name="participants"
            required
            rows={2}
            placeholder="U0123ABC U0456DEF"
            className={inputClass}
          />
        </label>

        <label className={labelClass}>
          Questions (one per line)
          <textarea
            name="questions"
            rows={4}
            defaultValue={DEFAULT_QUESTIONS.join("\n")}
            className={inputClass}
          />
        </label>

        <div className="mt-4 flex gap-6">
          <label className="text-sm font-medium">
            Time (participant’s local)
            <input
              type="time"
              name="time"
              step={900}
              defaultValue={STANDUP_DEFAULTS.time}
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
                    defaultChecked={(STANDUP_DEFAULTS.weekdays as readonly number[]).includes(
                      d.value,
                    )}
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
              defaultValue={STANDUP_DEFAULTS.remindAfterMinutes}
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
              defaultValue={STANDUP_DEFAULTS.maxReminders}
              className={inputClass}
            />
          </label>
          <label className="text-sm font-medium">
            Close at (local)
            <input
              type="time"
              name="closeAtTime"
              step={900}
              defaultValue={STANDUP_DEFAULTS.closeAtTime}
              className={inputClass}
            />
          </label>
        </div>

        <button
          type="submit"
          className="mt-6 rounded bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-80"
        >
          Create standup
        </button>
      </form>
    </main>
  );
}
