"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/authz";
import { ensureUserProfile, setOutOfOffice, setPreferredTime } from "@/lib/store/users";
import { timeToMinutes } from "@/lib/tz";

export async function setPreferredTimeAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  const userId = session.slackUserId;
  if (!userId) throw new Error("no slack user id on session");

  const raw = String(formData.get("time") ?? "").trim();
  if (raw) {
    const minutes = timeToMinutes(raw);
    if (!Number.isFinite(minutes) || minutes % 15 !== 0) {
      throw new Error("time must be in 15-minute increments");
    }
  }

  // Guarantee the row is fully populated before a targeted field update.
  await ensureUserProfile(userId);
  await setPreferredTime(userId, raw || undefined);
  revalidatePath("/preferences");
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function setOutOfOfficeAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  const userId = session.slackUserId;
  if (!userId) throw new Error("no slack user id on session");

  const from = String(formData.get("from") ?? "").trim();
  const to = String(formData.get("to") ?? "").trim();
  if (!DATE_RE.test(from) || !DATE_RE.test(to) || from > to) {
    throw new Error("from/to must be valid dates with from <= to");
  }

  await ensureUserProfile(userId);
  await setOutOfOffice(userId, { from, to });
  revalidatePath("/preferences");
}

export async function clearOutOfOfficeAction(): Promise<void> {
  const session = await requireSession();
  const userId = session.slackUserId;
  if (!userId) throw new Error("no slack user id on session");

  await setOutOfOffice(userId, undefined);
  revalidatePath("/preferences");
}
