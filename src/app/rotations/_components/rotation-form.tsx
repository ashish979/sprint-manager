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

const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

const inputClass = "input w-full mt-1";
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

  // Omitted activeDays = every day, so an unconfigured rotation starts all-checked.
  const activeDays = rotation?.activeDays;
  const dayChecked = (d: number) => !activeDays || activeDays.length === 0 || activeDays.includes(d);

  return (
    <form action={action} className="card mt-6 border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body">
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
            className="select w-full mt-1"
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

        <fieldset className="mt-4 text-sm font-medium">
          Active days <span className="font-normal text-base-content/50">(uncheck to skip, e.g. weekends)</span>
          <div className="mt-2 flex flex-wrap gap-3">
            {WEEKDAYS.map((d) => (
              <label key={d.value} className="flex items-center gap-1.5 font-normal">
                <input
                  type="checkbox"
                  name="activeDays"
                  value={d.value}
                  defaultChecked={dayChecked(d.value)}
                  className="checkbox checkbox-sm checkbox-primary"
                />
                {d.label}
              </label>
            ))}
          </div>
        </fieldset>

        <label className={labelClass}>
          Notes <span className="font-normal text-base-content/50">(shown in the Slack announce &amp; on-duty DM)</span>
          <textarea
            name="notes"
            rows={4}
            defaultValue={rotation?.notes ?? ""}
            placeholder={"Scrum handler of the sprint\nTasks to perform:\n- handle daily standup…"}
            className="textarea w-full mt-1"
          />
        </label>

        <button type="submit" className="btn btn-primary mt-6 w-fit">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
