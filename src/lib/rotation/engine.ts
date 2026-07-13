import { onDutyDmMessage, shiftAnnounceMessage } from "@/lib/slack/blocks";
import { slack } from "@/lib/slack/client";
import { deleteOverride, getOverride } from "@/lib/store/overrides";
import { getRotation, listRotations, putRotation } from "@/lib/store/rotations";
import { createShiftIfAbsent, getLatestShift } from "@/lib/store/shifts";
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
  await rotate(rotation, todayIst(new Date()));
}
