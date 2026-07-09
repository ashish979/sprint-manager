import { redirect } from "next/navigation";

import { isAdminSession } from "@/lib/authz";
import { ROTATION_DEFAULTS } from "@/lib/types";

import { createRotationAction } from "../actions";

export const dynamic = "force-dynamic";

const CADENCES = [
  { value: "daily", label: "Daily" },
  { value: "weekdays", label: "Weekdays" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
];

const inputClass =
  "mt-1 w-full rounded border px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";
const labelClass = "block text-sm font-medium mt-4";

export default async function NewRotationPage() {
  if (!(await isAdminSession())) redirect("/rotations");

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">New rotation</h1>

      <form action={createRotationAction} className="mt-6">
        <label className={labelClass}>
          Name
          <input name="name" required placeholder="Payments on-call" className={inputClass} />
        </label>

        <label className={labelClass}>
          Announce channel id
          <input
            name="channel"
            required
            placeholder="C0123456789 (invite @sprint-manager to it)"
            className={inputClass}
          />
        </label>

        <label className={labelClass}>
          Members — Slack user ids, in rotation order, space/comma separated
          <textarea
            name="members"
            required
            rows={2}
            placeholder="U0123ABC U0456DEF U0789GHI"
            className={inputClass}
          />
        </label>

        <label className={labelClass}>
          Slack user group id (optional — kept pointed at whoever&apos;s on duty)
          <input name="usergroupId" placeholder="S0123456789" className={inputClass} />
        </label>

        <label className={labelClass}>
          Cadence
          <select name="cadence" defaultValue={ROTATION_DEFAULTS.cadence} className={inputClass}>
            {CADENCES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          className="mt-6 rounded bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-80 dark:bg-white dark:text-black dark:hover:opacity-90"
        >
          Create rotation
        </button>
      </form>
    </main>
  );
}
