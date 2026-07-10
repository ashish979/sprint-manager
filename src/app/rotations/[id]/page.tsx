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

const chipClass =
  "rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";

const SOURCE_BADGE: Record<ShiftSource, { label: string; class: string }> = {
  auto: { label: "auto", class: "bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-300" },
  override: {
    label: "override",
    class: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
  swap: { label: "swap", class: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" },
};

const secondaryButtonClass =
  "rounded border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800";
const smallInputClass =
  "mt-1 rounded border px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";

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
    <main className="mx-auto max-w-3xl p-8">
      <Link href="/rotations" className="text-sm text-zinc-500 underline dark:text-zinc-400">
        ← All rotations
      </Link>

      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{rotation.name}</h1>
        {admin && (
          <div className="flex gap-2">
            <Link href={`/rotations/${rotation.id}/edit`} className={secondaryButtonClass}>
              Edit
            </Link>
            <form action={rotateNowAction}>
              <input type="hidden" name="id" value={rotation.id} />
              <button className={secondaryButtonClass}>Rotate now</button>
            </form>
            <form action={deleteRotationAction}>
              <input type="hidden" name="id" value={rotation.id} />
              <ConfirmSubmitButton
                confirmText={`Delete "${rotation.name}"? This can't be undone.`}
                className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
              >
                Delete
              </ConfirmSubmitButton>
            </form>
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className={chipClass}>🔁 {rotation.cadence}</span>
        <span className={chipClass}>
          🕐 {formatTime12h(rotation.announceTime ?? ROTATION_DEFAULTS.announceTime)} IST
        </span>
        <span className={chipClass}>#{channelInfo?.name ?? rotation.channel}</span>
        {rotation.usergroupId && <span className={chipClass}>👥 {rotation.usergroupId}</span>}
      </div>

      <div className="mt-6 rounded border p-4 dark:border-zinc-800">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">On duty</p>
        <p className="mt-1 text-lg">
          {current ? nameOf(current.assignee) : "not rotated yet"}
          {current && (
            <span className="ml-2 text-sm text-zinc-500 dark:text-zinc-400">
              since {current.startDate}
            </span>
          )}
        </p>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Next up: {nameOf(next)}</p>
      </div>

      <h2 className="mt-8 text-lg font-semibold">Members</h2>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
        {rotation.members.map((userId, i) => (
          <li key={userId} className={i === nextIndex ? "font-medium" : ""}>
            {nameOf(userId)}
          </li>
        ))}
      </ol>

      {admin && (
        <>
          <h2 className="mt-8 text-lg font-semibold">Queue an override</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
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
            <button className={secondaryButtonClass}>Queue</button>
          </form>
        </>
      )}

      <h2 className="mt-8 text-lg font-semibold">History</h2>
      {history.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">No shifts yet.</p>
      ) : (
        <ul className="mt-2 divide-y rounded border text-sm dark:divide-zinc-800 dark:border-zinc-800">
          {history.map((s) => (
            <li key={s.startDate} className="flex items-center justify-between p-3">
              <span>
                {s.startDate} — {nameOf(s.assignee)}
              </span>
              <span className={`rounded px-2 py-0.5 text-xs ${SOURCE_BADGE[s.source].class}`}>
                {SOURCE_BADGE[s.source].label}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
