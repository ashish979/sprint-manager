import { getTeamSettings } from "@/lib/db";
import {
  manageQueueModal,
  onDutyDmMessage,
  reassignAnnounceMessage,
  shiftAnnounceMessage,
} from "@/lib/slack/blocks";
import { slack } from "@/lib/slack/client";
import { deleteOverride, getOverride } from "@/lib/store/overrides";
import { getRotation, listRotations, putRotation } from "@/lib/store/rotations";
import { createShiftIfAbsent, getLatestShift, putShift } from "@/lib/store/shifts";
import { getUserProfile } from "@/lib/store/users";
import { localParts, todayIst } from "@/lib/tz";
import { ROTATION_DEFAULTS, type RotationConfig } from "@/lib/types";

import { isShiftDue } from "./schedule";

/**
 * Rotation orchestration (PLAN.md §2.4). Called from the tick Lambda
 * (sweep) and the dashboard "rotate now" admin action.
 *
 * Idempotency: shift creation is a conditional DynamoDB write, so a
 * retried or overlapping tick never double-announces or double-syncs.
 *
 * The day boundary — and the announceTime gate within it — is IST, not
 * UTC: a rotation has no single participant to anchor a timezone to the
 * way standups do, so it uses the app's shared reference timezone
 * instead. Before announceTime existed, rotations rolled over (and
 * announced) the instant the IST calendar date changed, i.e. right at
 * midnight IST — itself a fix for the original bug of rolling over at
 * 00:00 UTC (5:30 AM IST).
 */

// --- Tick sweep ---

export async function sweep(now: Date = new Date()): Promise<void> {
  const rotations = await listRotations();
  for (const rotation of rotations) {
    try {
      await sweepRotation(rotation, now);
    } catch (error) {
      console.error(`rotation sweep failed for ${rotation.id}:`, error);
    }
  }
}

async function sweepRotation(rotation: RotationConfig, now: Date): Promise<void> {
  const local = localParts(now, "Asia/Kolkata");
  const latest = await getLatestShift(rotation.id);
  const announceTime = rotation.announceTime ?? ROTATION_DEFAULTS.announceTime;
  if (!isShiftDue(rotation.cadence, local, announceTime, latest?.startDate, rotation.activeDays))
    return;
  await rotate(rotation, local.date);
}

/**
 * Creates today's shift if one doesn't already exist, advances the
 * round-robin cursor, and announces + DMs + syncs the user group. Shared
 * by the tick sweep and the admin "rotate now" action.
 */
async function rotate(rotation: RotationConfig, date: string): Promise<void> {
  const override = await getOverride(rotation.id, date);
  const assignee = override?.assignee ?? rotation.members[rotation.cursor % rotation.members.length];
  const source = override?.source ?? "auto";

  const created = await createShiftIfAbsent({
    rotationId: rotation.id,
    startDate: date,
    assignee,
    source,
    createdAt: new Date().toISOString(),
  });
  if (!created) return; // another tick already rotated today

  if (override) await deleteOverride(rotation.id, date);
  await putRotation({
    ...rotation,
    cursor: rotation.cursor + 1,
    updatedAt: new Date().toISOString(),
  });

  await notifyOnDuty(rotation, assignee, date, shiftAnnounceMessage(rotation, assignee, date));
}

/**
 * Announce the on-duty person in the channel, DM them, and sync the user
 * group. Shared by the rotation roll-over and the Slack-native reassignment
 * flows — `announce` is the channel message to post (a fresh shift vs. a
 * reassignment read differently).
 */
async function notifyOnDuty(
  rotation: RotationConfig,
  assignee: string,
  date: string,
  announce: { text: string; blocks: unknown[] },
): Promise<void> {
  await slack.postMessage({ channel: rotation.channel, ...announce });

  const dmChannel = await slack.openDm(assignee);
  await slack.postMessage({ channel: dmChannel, ...onDutyDmMessage(rotation, date) });

  if (rotation.usergroupId) {
    try {
      await slack.usergroupsUsersUpdate(rotation.usergroupId, [assignee]);
    } catch (error) {
      console.error(`usergroup sync failed for ${rotation.id}:`, error);
    }
  }
}

/**
 * Admin "rotate now" — forces today's shift regardless of the cadence
 * schedule (e.g. the on-duty person is out sick). No-ops if today's shift
 * already exists.
 */
export async function advanceRotationNow(rotationId: string): Promise<void> {
  const rotation = await getRotation(rotationId);
  if (!rotation) throw new Error(`rotation ${rotationId} not found`);
  await rotate(rotation, todayIst(new Date()));
}

// --- Slack-native queue management (Manage Queue button + Quick Actions) ---

/** Admins (TEAM#SETTINGS) or members of the rotation may manage its queue. */
export async function canManageRotation(
  rotation: RotationConfig,
  userId: string,
): Promise<boolean> {
  if (rotation.members.includes(userId)) return true;
  const { adminSlackIds } = await getTeamSettings();
  return adminSlackIds.includes(userId);
}

/**
 * Reassign today's (latest) shift to `assignee` — overwrites the shift's
 * assignee and re-announces + DMs + syncs the user group. Doesn't touch the
 * round-robin cursor, so the next auto rotation is unaffected.
 */
export async function reassignCurrentShift(
  rotationId: string,
  assignee: string,
  byUserId: string,
): Promise<void> {
  const rotation = await getRotation(rotationId);
  if (!rotation) throw new Error(`rotation ${rotationId} not found`);
  if (!rotation.members.includes(assignee)) throw new Error("assignee is not a rotation member");

  const latest = await getLatestShift(rotationId);
  const date = latest?.startDate ?? todayIst(new Date());
  await putShift({
    rotationId,
    startDate: date,
    assignee,
    source: "override",
    createdAt: latest?.createdAt ?? new Date().toISOString(),
  });
  await notifyOnDuty(rotation, assignee, date, reassignAnnounceMessage(rotation, assignee, byUserId));
}

/** Move the current on-duty shift to the next member in rotation order. */
export async function passToNext(rotationId: string, byUserId: string): Promise<void> {
  const rotation = await getRotation(rotationId);
  if (!rotation) throw new Error(`rotation ${rotationId} not found`);
  const latest = await getLatestShift(rotationId);
  const n = rotation.members.length;
  const currentIndex = latest ? rotation.members.indexOf(latest.assignee) : -1;
  const next = rotation.members[(currentIndex + 1 + n) % n];
  await reassignCurrentShift(rotationId, next, byUserId);
}

/** Point the round-robin cursor at `memberUserId` so they're the next auto shift. */
export async function setNextUp(rotationId: string, memberUserId: string): Promise<void> {
  const rotation = await getRotation(rotationId);
  if (!rotation) throw new Error(`rotation ${rotationId} not found`);
  const index = rotation.members.indexOf(memberUserId);
  if (index < 0) throw new Error("member not in rotation");
  await putRotation({ ...rotation, cursor: index, updatedAt: new Date().toISOString() });
}

/** Opens the Manage Queue modal (from the announce button/menu). */
export async function openManageQueueModal(
  triggerId: string,
  rotationId: string,
): Promise<void> {
  const rotation = await getRotation(rotationId);
  if (!rotation) return;
  const [latest, profiles] = await Promise.all([
    getLatestShift(rotationId),
    Promise.all(rotation.members.map((id) => getUserProfile(id))),
  ]);
  const names = new Map(rotation.members.map((id, i) => [id, profiles[i]?.name ?? id]));
  const next = rotation.members[rotation.cursor % rotation.members.length];
  await slack.openView(
    triggerId,
    manageQueueModal(rotation, names, latest?.startDate ?? todayIst(new Date()), latest?.assignee, next),
  );
}

/** Handles a "Quick Actions" selection from the announce menu. */
export async function handleRotationQuickAction(opts: {
  rotationId: string;
  op: string;
  userId: string;
  responseUrl: string;
}): Promise<void> {
  const rotation = await getRotation(opts.rotationId);
  if (!rotation) return;
  if (!(await canManageRotation(rotation, opts.userId))) {
    await slack.ephemeral(opts.responseUrl, "⚠️ You're not allowed to manage this rotation.");
    return;
  }
  if (opts.op === "pass_next") {
    await passToNext(opts.rotationId, opts.userId);
  } else if (opts.op === "take") {
    await reassignCurrentShift(opts.rotationId, opts.userId, opts.userId);
  }
}

/**
 * Applies a Manage Queue modal submission. Returns Block Kit validation errors
 * (keyed by block_id) when the user isn't allowed to manage, so Slack shows the
 * message inline instead of silently closing.
 */
export async function submitManageQueue(payload: {
  user: { id: string };
  view: {
    private_metadata: string;
    state: {
      values: Record<string, Record<string, { selected_option?: { value: string } | null }>>;
    };
  };
}): Promise<{ errors: Record<string, string> } | void> {
  const { rotationId } = JSON.parse(payload.view.private_metadata) as { rotationId: string };
  const rotation = await getRotation(rotationId);
  if (!rotation) return;
  if (!(await canManageRotation(rotation, payload.user.id))) {
    return { errors: { reassign: "You're not allowed to manage this rotation." } };
  }

  const values = payload.view.state.values;
  const reassignTo = values.reassign?.assignee?.selected_option?.value;
  const nextUp = values.next_up?.member?.selected_option?.value;

  if (nextUp) await setNextUp(rotationId, nextUp);
  if (reassignTo) await reassignCurrentShift(rotationId, reassignTo, payload.user.id);
}
