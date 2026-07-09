import { onDutyDmMessage, shiftAnnounceMessage } from "@/lib/slack/blocks";
import { slack } from "@/lib/slack/client";
import { deleteOverride, getOverride } from "@/lib/store/overrides";
import { getRotation, listRotations, putRotation } from "@/lib/store/rotations";
import { createShiftIfAbsent, getLatestShift, putShift } from "@/lib/store/shifts";
import type { RotationConfig } from "@/lib/types";

import { isShiftDue, nextAssignment } from "./schedule";

/**
 * Rotation orchestration (PLAN.md §2.4). Called from the tick Lambda
 * (sweep) and the dashboard "rotate now" admin action.
 *
 * Idempotency: shift creation is a conditional DynamoDB write, so a
 * retried or overlapping tick never double-announces or double-syncs.
 */

function todayUtc(now: Date): string {
  return now.toISOString().slice(0, 10);
}

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
  const today = todayUtc(now);
  const latest = await getLatestShift(rotation.id);
  if (!isShiftDue(rotation.cadence, today, latest?.startDate)) return;
  await rotate(rotation, today);
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

  await slack.postMessage({
    channel: rotation.channel,
    ...shiftAnnounceMessage(rotation, assignee, date),
  });

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
  await rotate(rotation, todayUtc(new Date()));
}

/**
 * Slack "Assign to next in queue" button — bumps whoever's currently on duty
 * for `date` and hands the shift to the next member. `cursor` already
 * advanced past the current assignee when their shift was created (see
 * `rotate()`), so `members[cursor % length]` already means "whoever's next";
 * this bumps it one *further* since the fill-in's own turn is consumed too —
 * a permanent move-on, not a deferral (they still get their real turn later).
 *
 * Only applies to the *current* shift: if `date` isn't the rotation's latest
 * shift (e.g. a button on a stale announce message), this is a no-op —
 * returns undefined rather than corrupting cursor math for a rotation that's
 * already moved on.
 */
export async function assignNextInQueue(
  rotationId: string,
  date: string,
): Promise<{ rotation: RotationConfig; assignee: string } | undefined> {
  const rotation = await getRotation(rotationId);
  if (!rotation || rotation.members.length === 0) return undefined;

  const latest = await getLatestShift(rotationId);
  if (!latest || latest.startDate !== date) return undefined;

  const { assignee: nextAssignee, cursor } = nextAssignment(rotation.members, rotation.cursor);

  await putShift({ ...latest, assignee: nextAssignee, source: "override" });

  const updated: RotationConfig = {
    ...rotation,
    cursor,
    updatedAt: new Date().toISOString(),
  };
  await putRotation(updated);

  const dmChannel = await slack.openDm(nextAssignee);
  await slack.postMessage({ channel: dmChannel, ...onDutyDmMessage(updated, date) });

  if (updated.usergroupId) {
    try {
      await slack.usergroupsUsersUpdate(updated.usergroupId, [nextAssignee]);
    } catch (error) {
      console.error(`usergroup sync failed for ${rotationId}:`, error);
    }
  }

  return { rotation: updated, assignee: nextAssignee };
}
