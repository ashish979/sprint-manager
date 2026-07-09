import { blockerQuestionIndex, isBlockerAnswer } from "@/lib/standup/blockers";
import { friendlyDate } from "@/lib/tz";
import type { QuestionConfig, Report, RotationConfig, StandupConfig } from "@/lib/types";

/** Block Kit builders for all standup surfaces. */

export interface ButtonMeta {
  standupId: string;
  date: string;
}

export interface ModalMeta extends ButtonMeta {
  dmChannel?: string;
  dmTs?: string;
}

const mention = (userId: string) => `<@${userId}>`;

const STATUS_ICON: Record<Report["status"], string> = {
  submitted: "✅",
  pending: "⏳",
  skipped: "🏖️",
  missed: "❌",
  ooo: "🌴",
};

function answerButtons(standup: Pick<StandupConfig, "id">, date: string): unknown {
  const value = JSON.stringify({ standupId: standup.id, date } satisfies ButtonMeta);
  return {
    type: "actions",
    elements: [
      {
        type: "button",
        style: "primary",
        action_id: "standup:answer",
        text: { type: "plain_text", text: "Answer standup" },
        value,
      },
      {
        type: "button",
        action_id: "standup:skip",
        text: { type: "plain_text", text: "Not today" },
        value,
      },
    ],
  };
}

/** A single "standup:answer" button — reopens the modal from a terminal DM. */
function updateAnswerButton(
  standup: Pick<StandupConfig, "id">,
  date: string,
  label: string,
): unknown {
  const value = JSON.stringify({ standupId: standup.id, date } satisfies ButtonMeta);
  return {
    type: "actions",
    elements: [
      {
        type: "button",
        action_id: "standup:answer",
        text: { type: "plain_text", text: label },
        value,
      },
    ],
  };
}

/** DM shown after a modal submission — keeps a way back in, since late/updated answers are welcome. */
export function submittedDmMessage(
  standup: StandupConfig,
  date: string,
): { text: string; blocks: unknown[] } {
  return {
    text: `✅ ${standup.name} submitted — thanks!`,
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: `✅ *${standup.name}* submitted — thanks!` },
      },
      updateAnswerButton(standup, date, "Update answer"),
    ],
  };
}

/** DM shown after "Not today" — still lets them change their mind. */
export function skippedDmMessage(
  standup: StandupConfig,
  date: string,
): { text: string; blocks: unknown[] } {
  return {
    text: `👍 No worries — skipping ${standup.name} today.`,
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: `👍 No worries — skipping *${standup.name}* today.` },
      },
      updateAnswerButton(standup, date, "Answer instead"),
    ],
  };
}

const STATUS_NOTE: Record<"skipped" | "missed" | "ooo" | "removed", string> = {
  skipped: "🏖️ skipped today's standup.",
  missed: "❌ missed today's standup.",
  ooo: "🌴 is out of office today.",
  removed: "was removed from this standup by an admin.",
};

/**
 * Lightweight thread note posted when someone resolves without submitting
 * (skip/miss/OOO/removed) — otherwise they silently vanish from the
 * "waiting on" list with nothing in the thread explaining why. Always
 * identified, even for anonymous standups: this is a participation event,
 * not answer content, and the anchor's roster already shows the same
 * identity.
 */
export function statusNoteMessage(
  userId: string,
  status: "skipped" | "missed" | "ooo" | "removed",
): { text: string; blocks: unknown[] } {
  const text = `${mention(userId)} ${STATUS_NOTE[status]}`;
  return { text, blocks: [{ type: "context", elements: [{ type: "mrkdwn", text }] }] };
}

// --- Channel anchor message (one per standup per day) ---

export function anchorMessage(
  standup: StandupConfig,
  date: string,
  reports: Report[],
  dayStatus: "open" | "closed",
): { text: string; blocks: unknown[] } {
  const byUser = new Map(reports.map((r) => [r.userId, r]));
  const submitted = reports.filter((r) => r.status === "submitted");
  const skipped = reports.filter((r) => r.status === "skipped");
  const missed = reports.filter((r) => r.status === "missed");
  const ooo = reports.filter((r) => r.status === "ooo");
  const resolved = new Set(reports.filter((r) => r.status !== "pending").map((r) => r.userId));
  const waiting = standup.participants.filter((u) => !resolved.has(u));

  const roster = standup.participants
    .map((userId) => {
      const report = byUser.get(userId);
      const icon = report ? STATUS_ICON[report.status] : STATUS_ICON.pending;
      return `${icon} ${mention(userId)}`;
    })
    .join("\n");

  let summary: string;
  if (dayStatus === "closed") {
    summary = `🏁 Closed — ${submitted.length}/${standup.participants.length} responded`;
    if (missed.length > 0) summary += `, ${missed.length} missed`;
    if (skipped.length > 0) summary += `, ${skipped.length} skipped`;
    if (ooo.length > 0) summary += `, ${ooo.length} OOO`;
  } else if (waiting.length === 0) {
    summary = `✅ Everyone's in — ${submitted.length} responded${
      skipped.length > 0 ? `, ${skipped.length} skipped` : ""
    }${ooo.length > 0 ? `, ${ooo.length} OOO` : ""}`;
  } else {
    summary = `⏳ ${submitted.length}/${standup.participants.length} responded — waiting on ${waiting
      .map(mention)
      .join(", ")}`;
  }

  return {
    text: `${standup.name} — ${friendlyDate(date)}`,
    blocks: [
      { type: "header", text: { type: "plain_text", text: `🌅 ${standup.name}`, emoji: true } },
      { type: "context", elements: [{ type: "mrkdwn", text: friendlyDate(date) }] },
      { type: "divider" },
      { type: "section", text: { type: "mrkdwn", text: roster } },
      { type: "context", elements: [{ type: "mrkdwn", text: summary }] },
    ],
  };
}

// --- DM prompt with Answer / Skip buttons ---

export function promptMessage(
  standup: StandupConfig,
  date: string,
): { text: string; blocks: unknown[] } {
  return {
    text: `Time for ${standup.name}!`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🌅 Good day! It's time for *${standup.name}* (${friendlyDate(date)}).`,
        },
      },
      answerButtons(standup, date),
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `I'll nudge you every ${standup.remindAfterMinutes} min (up to ${standup.maxReminders}×) until it closes at ${standup.closeAtTime}.`,
          },
        ],
      },
    ],
  };
}

/** Nudge DM — carries the same Answer/Skip buttons as the original prompt. */
export function reminderMessage(
  standup: StandupConfig,
  date: string,
  reminderNumber: number,
): { text: string; blocks: unknown[] } {
  return {
    text: `⏰ Reminder ${reminderNumber}/${standup.maxReminders}: ${standup.name}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `⏰ *Reminder ${reminderNumber}/${standup.maxReminders}* — still waiting on your update for *${standup.name}*.`,
        },
      },
      answerButtons(standup, date),
    ],
  };
}

// --- Answer modal ---

export function answerModal(standup: StandupConfig, meta: ModalMeta): unknown {
  return {
    type: "modal",
    callback_id: "standup:submit",
    private_metadata: JSON.stringify(meta),
    title: { type: "plain_text", text: standup.name.slice(0, 24) || "Standup" }, // max 24 chars
    submit: { type: "plain_text", text: "Submit" },
    close: { type: "plain_text", text: "Cancel" },
    blocks: [
      {
        type: "context",
        elements: [{ type: "mrkdwn", text: `📝 ${friendlyDate(meta.date)}` }],
      },
      { type: "divider" },
      ...standup.questions.map((question, i) => ({
        type: "input",
        block_id: `q_${i}`,
        optional: !question.required,
        label: {
          type: "plain_text",
          text: (question.required ? question.text : `${question.text} (optional)`).slice(0, 150),
        },
        element: {
          type: "plain_text_input",
          action_id: "answer",
          multiline: true,
          placeholder: { type: "plain_text", text: "Type your answer…" },
        },
      })),
    ],
  };
}

/** Answers from a view_submission payload, aligned to question order. */
export function answersFromView(
  questions: QuestionConfig[],
  stateValues: Record<string, Record<string, { value?: string | null }>>,
): string[] {
  return questions.map((_, i) => stateValues[`q_${i}`]?.answer?.value ?? "");
}

// --- Threaded reply under the anchor ---

export function replyMessage(
  standup: Pick<StandupConfig, "anonymous">,
  userId: string,
  questions: QuestionConfig[],
  answers: string[],
): { text: string; blocks: unknown[] } {
  const blockerIdx = blockerQuestionIndex(questions);
  const qa = questions
    .map((question, i) => ({
      question: question.text,
      answer: answers[i]?.trim() ?? "",
      isBlocker: i === blockerIdx && isBlockerAnswer(answers[i]?.trim() ?? ""),
    }))
    .filter(({ answer }) => answer.length > 0);

  const body =
    qa.length > 0
      ? qa
          .map(
            ({ question, answer, isBlocker }) =>
              `${isBlocker ? "🚫 " : ""}*${question}*\n${answer}`,
          )
          .join("\n\n")
      : "_No details shared._";

  // Both the notification `text` fallback (mobile push, screen readers) and the
  // visible block must avoid leaking identity when anonymous.
  const header = standup.anonymous ? "🙈 Anonymous response" : mention(userId);
  return {
    text: standup.anonymous ? "Someone posted their standup" : `${mention(userId)} posted their standup`,
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: `${header}\n\n${body}`.slice(0, 2900) },
      },
    ],
  };
}

// --- Rotation announce + on-duty DM ---

export function shiftAnnounceMessage(
  rotation: RotationConfig,
  assignee: string,
  date: string,
): { text: string; blocks: unknown[] } {
  return {
    text: `${rotation.name}: ${mention(assignee)} is on duty starting ${friendlyDate(date)}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🔄 *${rotation.name}*\n${mention(assignee)} is on duty starting ${friendlyDate(date)}.`,
        },
      },
      { type: "context", elements: [{ type: "mrkdwn", text: `Rotates ${rotation.cadence}` }] },
    ],
  };
}

export function onDutyDmMessage(
  rotation: RotationConfig,
  date: string,
): { text: string; blocks: unknown[] } {
  return {
    text: `You're on duty for ${rotation.name} starting ${friendlyDate(date)}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `📟 You're on duty for *${rotation.name}* starting ${friendlyDate(date)}. Thanks!`,
        },
      },
    ],
  };
}
