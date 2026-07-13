import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ConfirmSubmitButton } from "@/app/_components/confirm-submit-button";
import { ParticipantPicker } from "@/app/_components/participant-picker";
import { isAdminSession } from "@/lib/authz";
import { getSession } from "@/lib/session";
import { listUserOptions } from "@/lib/slack/directory";
import { ensureChannelInfo } from "@/lib/store/channels";
import { getRotation } from "@/lib/store/rotations";
import { getLatestShift, listShifts } from "@/lib/store/shifts";
import { getUserProfile } from "@/lib/store/users";
import { formatTime12h } from "@/lib/tz";
import { ROTATION_DEFAULTS, type ShiftSource } from "@/lib/types";

import { deleteRotationAction, queueOverrideAction, rotateNowAction } from "../actions";

export const dynamic = "force-dynamic";

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const SOURCE_BADGE: Record<ShiftSource, { label: string; className: string }> = {
  auto: { label: "auto", className: "badge-ghost" },
  override: { label: "override", className: "badge-warning" },
  swap: { label: "swap", className: "badge-info" },
};

const smallInputClass = "input input-sm mt-1";

export default async function RotationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/rotations");

  const { id } = await params;
  const rotation = await getRotation(id);
  if (!rotation) notFound();

  const [admin, current, history, channelInfo, users] = await Promise.all([
    isAdminSession(),
    getLatestShift(rotation.id),
    listShifts(rotation.id),
    ensureChannelInfo(rotation.channel),
    listUserOptions(),
  ]);
  const profiles = await Promise.all(rotation.members.map((u) => getUserProfile(u)));
  const nameOf = (userId: string) => profiles.find((p) => p?.userId === userId)?.name ?? userId;
  const nextIndex = rotation.cursor % rotation.members.length;
  const next = rotation.members[nextIndex];

  return (
    <main className="mx-auto max-w-3xl p-6">
      <Link href="/rotations" className="link link-hover text-sm text-base-content/60">
        ← All rotations
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{rotation.name}</h1>
        {admin && (
          <div className="flex gap-2">
            <Link href={`/rotations/${rotation.id}/edit`} className="btn btn-outline btn-sm">
              Edit
            </Link>
            <form action={rotateNowAction}>
              <input type="hidden" name="id" value={rotation.id} />
              <button className="btn btn-primary btn-sm">Rotate now</button>
            </form>
            <form action={deleteRotationAction}>
              <input type="hidden" name="id" value={rotation.id} />
              <ConfirmSubmitButton
                confirmText={`Delete "${rotation.name}"? This can't be undone.`}
                className="btn btn-outline btn-error btn-sm"
              >
                Delete
              </ConfirmSubmitButton>
            </form>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="badge badge-ghost badge-lg">🔁 {rotation.cadence}</span>
        <span className="badge badge-ghost badge-lg">
          🕐 {formatTime12h(rotation.announceTime ?? ROTATION_DEFAULTS.announceTime)} IST
        </span>
        {rotation.activeDays && rotation.activeDays.length > 0 && (
          <span className="badge badge-ghost badge-lg">
            📆 {[...rotation.activeDays].sort((a, b) => a - b).map((d) => WEEKDAY_LABELS[d]).join(" ")}
          </span>
        )}
        <span className="badge badge-ghost badge-lg">#{channelInfo?.name ?? rotation.channel}</span>
        {rotation.usergroupId && (
          <span className="badge badge-ghost badge-lg">👥 {rotation.usergroupId}</span>
        )}
      </div>

      {rotation.notes && (
        <div className="card mt-4 border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body py-4">
            <p className="text-sm font-medium text-base-content/50">Notes</p>
            <p className="whitespace-pre-wrap text-sm">{rotation.notes}</p>
          </div>
        </div>
      )}

      <div className="card mt-6 border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body">
          <p className="text-sm font-medium text-base-content/50">On duty</p>
          <p className="mt-1 text-lg">
            {current ? nameOf(current.assignee) : "not rotated yet"}
            {current && (
              <span className="ml-2 text-sm text-base-content/50">since {current.startDate}</span>
            )}
          </p>
          <p className="mt-1 text-sm text-base-content/60">Next up: {nameOf(next)}</p>
        </div>
      </div>

      <h2 className="mt-8 text-lg font-semibold">Members</h2>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
        {rotation.members.map((userId, i) => (
          <li key={userId} className={i === nextIndex ? "font-medium text-primary" : ""}>
            {nameOf(userId)}
          </li>
        ))}
      </ol>

      {admin && (
        <div className="card mt-8 border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="text-lg font-semibold">Queue an override</h2>
            <p className="text-sm text-base-content/60">
              Assign a specific person to a future shift — takes effect at the next tick and
              doesn&apos;t disturb the round-robin order.
            </p>
            <form action={queueOverrideAction} className="mt-3 flex flex-wrap items-end gap-3">
              <input type="hidden" name="rotationId" value={rotation.id} />
              <label className="text-sm font-medium">
                Date
                <input type="date" name="date" required className={smallInputClass} />
              </label>
              <label className="min-w-48 text-sm font-medium">
                Assignee
                {users ? (
                  <ParticipantPicker
                    name="assignee"
                    multi={false}
                    options={users.map((u) => ({ value: u.id, label: u.name }))}
                  />
                ) : (
                  <input name="assignee" required placeholder="U0123ABC" className={smallInputClass} />
                )}
              </label>
              <button className="btn btn-primary btn-sm">Queue</button>
            </form>
          </div>
        </div>
      )}

      <h2 className="mt-8 text-lg font-semibold">History</h2>
      {history.length === 0 ? (
        <p className="mt-2 text-sm text-base-content/60">No shifts yet.</p>
      ) : (
        <ul className="mt-2 space-y-2 text-sm">
          {history.map((s) => (
            <li
              key={s.startDate}
              className="flex items-center justify-between rounded-field border border-base-300 bg-base-100 p-3"
            >
              <span>
                {s.startDate} — {nameOf(s.assignee)}
              </span>
              <span className={`badge badge-sm ${SOURCE_BADGE[s.source].className}`}>
                {SOURCE_BADGE[s.source].label}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
