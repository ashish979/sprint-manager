"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/authz";
import { resolveRemovedParticipants, sendManualReminder, startStandupNow } from "@/lib/standup/engine";
import { deleteStandup, getStandup, putStandup } from "@/lib/store/standups";
import { ensureUserProfile } from "@/lib/store/users";
import { timeToMinutes } from "@/lib/tz";
import { DEFAULT_QUESTIONS, STANDUP_DEFAULTS, type QuestionConfig, type StandupConfig } from "@/lib/types";

function parseList(value: string): string[] {
  return value
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Participants come from two independent sources — the textarea (ids
 * typed/pasted directly) and the optional picker (multi-select, when the
 * Slack directory lookup succeeded) — combined and deduped. Neither
 * replaces the other; either alone (or both together) is valid.
 */
function parseParticipants(formData: FormData): string[] {
  const typed = parseList(String(formData.get("participants") ?? ""));
  const picked = formData.getAll("participantsPicker").map(String).filter(Boolean);
  return [...new Set([...typed, ...picked])];
}

/** One JSON-encoded FormData entry per question row (QuestionsEditor), in order. */
function parseQuestions(formData: FormData): QuestionConfig[] {
  return formData
    .getAll("questions")
    .map((v) => JSON.parse(String(v)) as QuestionConfig)
    .map((q) => ({ text: q.text.trim(), required: q.required }))
    .filter((q) => q.text.length > 0);
}

/** Shared by createStandupAction/createAndStartStandupAction — everything up to the actual write. */
async function buildAndSaveStandup(formData: FormData): Promise<StandupConfig> {
  const name = String(formData.get("name") ?? "").trim();
  const channel = String(formData.get("channel") ?? "").trim();
  const participants = parseParticipants(formData);
  const questions = parseQuestions(formData);
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
    anonymous: formData.get("anonymous") === "on",
    createdAt: now,
    updatedAt: now,
  };

  await putStandup(config);

  // Pre-sync timezones so the first tick doesn't need Slack round-trips.
  // Best-effort: without a bot token (early local dev) profiles default to UTC.
  for (const userId of config.participants) {
    try {
      await ensureUserProfile(userId);
    } catch {
      /* synced lazily by the tick instead */
    }
  }

  return config;
}

export async function createStandupAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const config = await buildAndSaveStandup(formData);
  redirect(`/standups/${config.id}`);
}

/** Same as createStandupAction, but immediately prompts everyone instead of waiting for the next tick. */
export async function createAndStartStandupAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const config = await buildAndSaveStandup(formData);
  await startStandupNow(config.id);
  redirect(`/standups/${config.id}`);
}

export async function updateStandupAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("missing id");
  const existing = await getStandup(id);
  if (!existing) throw new Error(`standup ${id} not found`);

  const name = String(formData.get("name") ?? "").trim();
  const channel = String(formData.get("channel") ?? "").trim();
  const participants = parseParticipants(formData);
  const questions = parseQuestions(formData);
  const time = String(formData.get("time") ?? STANDUP_DEFAULTS.time);
  const weekdays = formData.getAll("weekdays").map(Number);

  if (!name || !channel || participants.length === 0) {
    throw new Error("name, channel, and participants are required");
  }
  const minutes = timeToMinutes(time);
  if (!Number.isFinite(minutes) || minutes % 15 !== 0) {
    throw new Error("time must be in 15-minute increments (matches the scheduler tick)");
  }

  const config: StandupConfig = {
    ...existing,
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
    anonymous: formData.get("anonymous") === "on",
    updatedAt: new Date().toISOString(),
  };

  await putStandup(config);

  for (const userId of participants) {
    try {
      await ensureUserProfile(userId);
    } catch {
      /* synced lazily by the tick instead */
    }
  }

  const removed = existing.participants.filter((u) => !participants.includes(u));
  await resolveRemovedParticipants(config, removed);

  revalidatePath(`/standups/${id}`);
  redirect(`/standups/${id}`);
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

export async function sendReminderAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const standupId = String(formData.get("standupId") ?? "");
  const date = String(formData.get("date") ?? "");
  const userId = String(formData.get("userId") ?? "");
  if (!standupId || !date || !userId) throw new Error("missing standupId/date/userId");
  await sendManualReminder(standupId, date, userId);
  revalidatePath(`/standups/${standupId}`);
}
