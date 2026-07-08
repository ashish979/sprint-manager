"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/authz";
import { startStandupNow } from "@/lib/standup/engine";
import { deleteStandup, putStandup } from "@/lib/store/standups";
import { ensureUserProfile } from "@/lib/store/users";
import { timeToMinutes } from "@/lib/tz";
import { DEFAULT_QUESTIONS, STANDUP_DEFAULTS, type StandupConfig } from "@/lib/types";

function parseList(value: string): string[] {
  return value
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseLines(value: string): string[] {
  return value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function createStandupAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const channel = String(formData.get("channel") ?? "").trim();
  const participants = parseList(String(formData.get("participants") ?? ""));
  const questions = parseLines(String(formData.get("questions") ?? ""));
  const time = String(formData.get("time") ?? STANDUP_DEFAULTS.time);
  const weekdays = formData.getAll("weekdays").map(Number);

  if (!name || !channel || participants.length === 0) {
    throw new Error("name, channel, and participants are required");
  }
  const minutes = timeToMinutes(time);
  if (!Number.isFinite(minutes) || minutes % 15 !== 0) {
    throw new Error("time must be in 15-minute increments (matches the scheduler tick)");
  }

  const now = new Date().toISOString();
  const config: StandupConfig = {
    id: crypto.randomUUID().slice(0, 8),
    name,
    channel,
    participants,
    questions: questions.length > 0 ? questions : [...DEFAULT_QUESTIONS],
    time,
    weekdays: weekdays.length > 0 ? weekdays : [...STANDUP_DEFAULTS.weekdays],
    remindAfterMinutes:
      Number(formData.get("remindAfterMinutes")) || STANDUP_DEFAULTS.remindAfterMinutes,
    maxReminders: Number(formData.get("maxReminders")) || STANDUP_DEFAULTS.maxReminders,
    closeAtTime: String(formData.get("closeAtTime") ?? "") || STANDUP_DEFAULTS.closeAtTime,
    createdAt: now,
    updatedAt: now,
  };

  await putStandup(config);

  // Pre-sync timezones so the first tick doesn't need Slack round-trips.
  // Best-effort: without a bot token (early local dev) profiles default to UTC.
  for (const userId of participants) {
    try {
      await ensureUserProfile(userId);
    } catch {
      /* synced lazily by the tick instead */
    }
  }

  redirect(`/standups/${config.id}`);
}

export async function deleteStandupAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("missing id");
  await deleteStandup(id);
  revalidatePath("/standups");
  redirect("/standups");
}

export async function startNowAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("missing id");
  await startStandupNow(id);
  revalidatePath(`/standups/${id}`);
}
