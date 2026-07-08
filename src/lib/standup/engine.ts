import {
  anchorMessage,
  answerModal,
  answersFromView,
  type ModalMeta,
  promptMessage,
  reminderText,
  replyMessage,
} from "@/lib/slack/blocks";
import { slack } from "@/lib/slack/client";
import {
  closeDay,
  createDayIfAbsent,
  createReportIfAbsent,
  getDay,
  getReport,
  incrementReminders,
  listReports,
  markReportIfPending,
  saveSubmission,
  setDayThread,
  setReportDm,
} from "@/lib/store/reports";
import { getStandup, listStandups } from "@/lib/store/standups";
import { ensureUserProfile } from "@/lib/store/users";
import { localParts } from "@/lib/tz";
import type { Report, StandupConfig, StandupDay } from "@/lib/types";

import { isPromptDue, pendingReportAction } from "./schedule";

/**
 * Standup orchestration (PLAN.md §2.3). Called from the tick Lambda
 * (sweep) and the Slack interactivity endpoint (buttons/modal).
 *
 * Idempotency: every side effect is keyed on a conditional DynamoDB write
 * (create report, pending→missed, …) so a retried or overlapping tick never
 * double-sends.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

// --- Tick sweep ---

export async function sweep(now: Date = new Date()): Promise<void> {
  const standups = await listStandups();
  for (const standup of standups) {
    for (const userId of standup.participants) {
      try {
        await sweepParticipant(standup, userId, now);
      } catch (error) {
        console.error(`sweep failed for ${standup.id}/${userId}:`, error);
      }
    }
  }
}

async function sweepParticipant(
  standup: StandupConfig,
  userId: string,
  now: Date,
): Promise<void> {
  const profile = await ensureUserProfile(userId);
  const tz = profile?.tz ?? "UTC";
  const local = localParts(now, tz);

  // Safety net: a report left pending across local midnight is missed.
  const yesterday = localParts(new Date(now.getTime() - DAY_MS), tz);
  const yesterdayReport = await getReport(standup.id, yesterday.date, userId);
  if (yesterdayReport?.status === "pending") {
    await resolveAsMissed(standup, yesterday.date, userId);
  }

  const report = await getReport(standup.id, local.date, userId);

  if (!report) {
    if (isPromptDue(local, standup)) {
      await promptParticipant(standup, userId, local.date, now);
    }
    return;
  }

  if (report.status !== "pending") return;

  const action = pendingReportAction({
    now,
    local,
    reportDate: report.date,
    promptedAt: report.promptedAt,
    remindersSent: report.remindersSent,
    config: standup,
  });

  if (action.type === "miss") {
    await resolveAsMissed(standup, report.date, userId);
  } else if (action.type === "remind" && report.dmChannel) {
    // Increment first: if the DM fails we skip a nudge rather than spam.
    await incrementReminders(standup.id, report.date, userId);
    await slack.postMessage({
      channel: report.dmChannel,
      text: reminderText(standup, action.reminderNumber),
    });
  }
}

// --- Prompting ---

/** Anchor message first (thread parent), then the report + DM. */
export async function promptParticipant(
  standup: StandupConfig,
  userId: string,
  date: string,
  now: Date,
): Promise<void> {
  const day = await ensureDayWithAnchor(standup, date);

  const created = await createReportIfAbsent({
    standupId: standup.id,
    date,
    userId,
    status: "pending",
    answers: [],
    promptedAt: now.toISOString(),
    remindersSent: 0,
  });
  if (!created) return; // another tick already prompted

  const dmChannel = await slack.openDm(userId);
  const dmTs = await slack.postMessage({
    channel: dmChannel,
    ...promptMessage(standup, date),
  });
  await setReportDm(standup.id, date, userId, { channel: dmChannel, ts: dmTs });
  await refreshAnchor(standup, date, day);
}

/** Admin "start now" — prompts everyone regardless of schedule. */
export async function startStandupNow(standupId: string): Promise<void> {
  const standup = await getStandup(standupId);
  if (!standup) throw new Error(`standup ${standupId} not found`);
  const now = new Date();
  for (const userId of standup.participants) {
    const profile = await ensureUserProfile(userId);
    const local = localParts(now, profile?.tz ?? "UTC");
    await promptParticipant(standup, userId, local.date, now);
  }
}

async function ensureDayWithAnchor(
  standup: StandupConfig,
  date: string,
): Promise<StandupDay> {
  const day = await createDayIfAbsent({
    standupId: standup.id,
    date,
    channel: standup.channel,
    status: "open",
    createdAt: new Date().toISOString(),
  });
  if (!day.threadTs) {
    const ts = await slack.postMessage({
      channel: standup.channel,
      ...anchorMessage(standup, date, [], "open"),
    });
    await setDayThread(standup.id, date, ts);
    // Re-read: a concurrent tick may have won the if_not_exists race.
    return (await getDay(standup.id, date)) ?? { ...day, threadTs: ts };
  }
  return day;
}

// --- Interactivity flows ---

export async function openAnswerModal(
  triggerId: string,
  meta: ModalMeta,
): Promise<void> {
  const standup = await getStandup(meta.standupId);
  if (!standup) throw new Error(`standup ${meta.standupId} not found`);
  await slack.openView(triggerId, answerModal(standup, meta));
}

export async function submitFromView(payload: {
  user: { id: string };
  view: {
    private_metadata: string;
    state: { values: Record<string, Record<string, { value?: string | null }>> };
  };
}): Promise<void> {
  const meta = JSON.parse(payload.view.private_metadata) as ModalMeta;
  const userId = payload.user.id;
  const standup = await getStandup(meta.standupId);
  if (!standup) return;

  const answers = answersFromView(standup.questions, payload.view.state.values);
  const day = await ensureDayWithAnchor(standup, meta.date);
  const existing = await getReport(standup.id, meta.date, userId);

  // Late answers (or a lost report record) still count.
  if (!existing) {
    await createReportIfAbsent({
      standupId: standup.id,
      date: meta.date,
      userId,
      status: "pending",
      answers: [],
      promptedAt: new Date().toISOString(),
      remindersSent: 0,
    });
  }

  const reply = replyMessage(userId, standup.questions, answers);
  let replyTs = existing?.replyTs;
  if (replyTs && day.threadTs) {
    await slack.updateMessage({ channel: standup.channel, ts: replyTs, ...reply });
  } else if (day.threadTs) {
    replyTs = await slack.postMessage({
      channel: standup.channel,
      thread_ts: day.threadTs,
      ...reply,
    });
  }

  await saveSubmission(standup.id, meta.date, userId, answers, replyTs);

  if (meta.dmChannel && meta.dmTs) {
    await slack.updateMessage({
      channel: meta.dmChannel,
      ts: meta.dmTs,
      text: `✅ *${standup.name}* submitted — thanks! You can reopen it from the thread in <#${standup.channel}>.`,
      blocks: [],
    });
  }

  await refreshAnchor(standup, meta.date, day);
  await maybeCloseDay(standup, meta.date);
}

export async function skipToday(opts: {
  standupId: string;
  date: string;
  userId: string;
  responseUrl: string;
}): Promise<void> {
  const standup = await getStandup(opts.standupId);
  if (!standup) return;

  const marked = await markReportIfPending(
    opts.standupId,
    opts.date,
    opts.userId,
    "skipped",
  );
  await slack.respond(
    opts.responseUrl,
    marked
      ? `👍 No worries — skipping *${standup.name}* today.`
      : "This standup is already recorded for today.",
  );
  if (marked) {
    await refreshAnchor(standup, opts.date);
    await maybeCloseDay(standup, opts.date);
  }
}

// --- Anchor + day lifecycle ---

async function resolveAsMissed(
  standup: StandupConfig,
  date: string,
  userId: string,
): Promise<void> {
  const marked = await markReportIfPending(standup.id, date, userId, "missed");
  if (marked) {
    await refreshAnchor(standup, date);
    await maybeCloseDay(standup, date);
  }
}

async function refreshAnchor(
  standup: StandupConfig,
  date: string,
  knownDay?: StandupDay,
): Promise<void> {
  const day = knownDay ?? (await getDay(standup.id, date));
  if (!day?.threadTs) return;
  const reports = await listReports(standup.id, date);
  await slack.updateMessage({
    channel: day.channel,
    ts: day.threadTs,
    ...anchorMessage(standup, date, reports, day.status),
  });
}

/** Close once every participant's report has left pending. */
async function maybeCloseDay(standup: StandupConfig, date: string): Promise<void> {
  const day = await getDay(standup.id, date);
  if (!day || day.status === "closed") return;
  const reports = await listReports(standup.id, date);
  const unresolved =
    reports.some((r: Report) => r.status === "pending") ||
    reports.length < standup.participants.length;
  if (unresolved) return;
  await closeDay(standup.id, date);
  await refreshAnchor(standup, date, { ...day, status: "closed" });
}
