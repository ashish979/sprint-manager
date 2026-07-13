"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireEditor, requireManage } from "@/lib/authz";
import { advanceRotationNow } from "@/lib/rotation/engine";
import { putOverride } from "@/lib/store/overrides";
import { deleteRotation, getRotation, putRotation } from "@/lib/store/rotations";
import { ensureUserProfile } from "@/lib/store/users";
import { timeToMinutes } from "@/lib/tz";
import { ROTATION_DEFAULTS, type Cadence, type RotationConfig } from "@/lib/types";

const CADENCES: Cadence[] = ["daily", "weekdays", "weekly", "biweekly", "monthly"];

function parseList(value: string): string[] {
  return value
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Members come from two independent sources — the textarea (ids typed/pasted
 * directly) and the optional picker (single-select-per-add, when the Slack
 * directory lookup succeeded) — combined and deduped, same pattern as the
 * standup form's participants.
 */
function parseMembers(formData: FormData): string[] {
  const typed = parseList(String(formData.get("members") ?? ""));
  const picked = formData.getAll("membersPicker").map(String).filter(Boolean);
  return [...new Set([...typed, ...picked])];
}

/** Active-day checkboxes (0–6). None or all 7 selected ⇒ undefined (= every day). */
function parseActiveDays(formData: FormData): number[] | undefined {
  const days = [
    ...new Set(
      formData
        .getAll("activeDays")
        .map(Number)
        .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6),
    ),
  ].sort((a, b) => a - b);
  return days.length === 0 || days.length === 7 ? undefined : days;
}

export async function createRotationAction(formData: FormData): Promise<void> {
  const session = await requireEditor();

  const name = String(formData.get("name") ?? "").trim();
  const channel = String(formData.get("channel") ?? "").trim();
  const members = parseMembers(formData);
  const usergroupId = String(formData.get("usergroupId") ?? "").trim();
  const cadence = String(formData.get("cadence") ?? ROTATION_DEFAULTS.cadence) as Cadence;
  const announceTime = String(formData.get("announceTime") ?? "") || ROTATION_DEFAULTS.announceTime;

  if (!name || !channel || members.length === 0) {
    throw new Error("name, channel, and members are required");
  }
  if (!CADENCES.includes(cadence)) {
    throw new Error("invalid cadence");
  }
  const announceMinutes = timeToMinutes(announceTime);
  if (!Number.isFinite(announceMinutes) || announceMinutes % 15 !== 0) {
    throw new Error("announceTime must be in 15-minute increments (matches the scheduler tick)");
  }

  const now = new Date().toISOString();
  const config: RotationConfig = {
    id: crypto.randomUUID().slice(0, 8),
    name,
    channel,
    members,
    cadence,
    activeDays: parseActiveDays(formData),
    notes: String(formData.get("notes") ?? "").trim() || undefined,
    usergroupId: usergroupId || undefined,
    announceTime,
    ownerId: session.slackUserId,
    cursor: 0,
    createdAt: now,
    updatedAt: now,
  };

  await putRotation(config);

  // Pre-sync so lookups (dashboard, /rota who) don't need a Slack round-trip.
  // Best-effort: without a bot token (early local dev) profiles default to UTC.
  for (const userId of members) {
    try {
      await ensureUserProfile(userId);
    } catch {
      /* synced lazily by the tick instead */
    }
  }

  redirect(`/rotations/${config.id}`);
}

export async function updateRotationAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("missing id");
  const existing = await getRotation(id);
  if (!existing) throw new Error(`rotation ${id} not found`);
  await requireManage(existing.ownerId);

  const name = String(formData.get("name") ?? "").trim();
  const channel = String(formData.get("channel") ?? "").trim();
  const members = parseMembers(formData);
  const usergroupId = String(formData.get("usergroupId") ?? "").trim();
  const cadence = String(formData.get("cadence") ?? ROTATION_DEFAULTS.cadence) as Cadence;
  const announceTime = String(formData.get("announceTime") ?? "") || ROTATION_DEFAULTS.announceTime;

  if (!name || !channel || members.length === 0) {
    throw new Error("name, channel, and members are required");
  }
  if (!CADENCES.includes(cadence)) {
    throw new Error("invalid cadence");
  }
  const announceMinutes = timeToMinutes(announceTime);
  if (!Number.isFinite(announceMinutes) || announceMinutes % 15 !== 0) {
    throw new Error("announceTime must be in 15-minute increments (matches the scheduler tick)");
  }

  const config: RotationConfig = {
    ...existing,
    name,
    channel,
    members,
    cadence,
    activeDays: parseActiveDays(formData),
    notes: String(formData.get("notes") ?? "").trim() || undefined,
    usergroupId: usergroupId || undefined,
    announceTime,
    // Members can shrink/reorder — clamp so cursor still points at a valid index.
    cursor: existing.cursor % members.length,
    updatedAt: new Date().toISOString(),
  };

  await putRotation(config);

  for (const userId of members) {
    try {
      await ensureUserProfile(userId);
    } catch {
      /* synced lazily by the tick instead */
    }
  }

  revalidatePath(`/rotations/${id}`);
  redirect(`/rotations/${id}`);
}

export async function deleteRotationAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("missing id");
  await requireManage((await getRotation(id))?.ownerId);
  await deleteRotation(id);
  revalidatePath("/rotations");
  redirect("/rotations");
}

export async function rotateNowAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("missing id");
  await requireManage((await getRotation(id))?.ownerId);
  await advanceRotationNow(id);
  revalidatePath(`/rotations/${id}`);
}

export async function queueOverrideAction(formData: FormData): Promise<void> {
  const rotationId = String(formData.get("rotationId") ?? "");
  const date = String(formData.get("date") ?? "");
  const assignee = String(formData.get("assignee") ?? "").trim();
  await requireManage((await getRotation(rotationId))?.ownerId);

  if (!rotationId || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !assignee) {
    throw new Error("rotationId, date (yyyy-mm-dd), and assignee are required");
  }

  await putOverride({
    rotationId,
    date,
    assignee,
    source: "override",
    createdAt: new Date().toISOString(),
  });
  revalidatePath(`/rotations/${rotationId}`);
}
