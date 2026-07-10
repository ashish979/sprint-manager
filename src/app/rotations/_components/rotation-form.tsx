import { ParticipantPicker } from "@/app/_components/participant-picker";
import type { UserOption } from "@/lib/slack/directory";
import { ROTATION_DEFAULTS, type RotationConfig } from "@/lib/types";

/** Shared create/edit form for a rotation — see new/page.tsx and [id]/edit/page.tsx. */

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

export function RotationForm({
  action,
  rotation,
  submitLabel,
  users,
}: {
  action: (formData: FormData) => Promise<void>;
  rotation?: RotationConfig;
  submitLabel: string;
  /** null when the Slack lookup is unavailable — the picker is simply omitted. */
  users?: UserOption[] | null;
}) {
  // Mirrors the standup form's participants split: the picker (when available)
  // is the editable source of truth for known members, pre-checked in rotation
  // order; the id textarea drops to "add someone the picker doesn't show."
  const currentMembers =
    rotation?.members.map((id) => ({
      value: id,
      label: users?.find((u) => u.id === id)?.name ?? id,
    })) ?? [];
  const membersTextareaDefault = users ? "" : rotation?.members.join(" ");

  return (
    <form action={action} className="mt-6">
      {rotation && <input type="hidden" name="id" value={rotation.id} />}

      <label className={labelClass}>
        Name
        <input
          name="name"
          required
          defaultValue={rotation?.name}
          placeholder="Payments on-call"
          className={inputClass}
        />
      </label>

      <label className={labelClass}>
        Announce channel id
        <input
          name="channel"
          required
          defaultValue={rotation?.channel}
          placeholder="C0123456789 (invite @sprint-manager to it)"
          className={inputClass}
        />
      </label>

      {users && (
        <div className={labelClass}>
          Members — in rotation order
          <ParticipantPicker
            name="membersPicker"
            options={users.map((u) => ({ value: u.id, label: u.name }))}
            defaultSelected={currentMembers}
          />
        </div>
      )}

      <label className={labelClass}>
        {users
          ? "Add someone not showing up above, by Slack user id (optional)"
          : "Members — Slack user ids, in rotation order, space/comma separated"}
        <textarea
          name="members"
          rows={2}
          defaultValue={membersTextareaDefault}
          placeholder="U0123ABC U0456DEF U0789GHI"
          className={inputClass}
        />
      </label>

      <label className={labelClass}>
        Slack user group id (optional — kept pointed at whoever&apos;s on duty)
        <input
          name="usergroupId"
          defaultValue={rotation?.usergroupId}
          placeholder="S0123456789"
          className={inputClass}
        />
      </label>

      <div className="mt-4 flex gap-6">
        <label className="text-sm font-medium">
          Cadence
          <select
            name="cadence"
            defaultValue={rotation?.cadence ?? ROTATION_DEFAULTS.cadence}
            className={inputClass}
          >
            {CADENCES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Announce time (IST)
          <input
            type="time"
            name="announceTime"
            step={900}
            defaultValue={rotation?.announceTime ?? ROTATION_DEFAULTS.announceTime}
            className={inputClass}
          />
        </label>
      </div>

      <button
        type="submit"
        className="mt-6 rounded bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-80 dark:bg-white dark:text-black dark:hover:opacity-90"
      >
        {submitLabel}
      </button>
    </form>
  );
}
