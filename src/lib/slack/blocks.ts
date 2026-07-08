import { friendlyDate } from "@/lib/tz";
import type { Report, RotationConfig, StandupConfig } from "@/lib/types";

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

// --- Channel anchor message (one per standup per day) ---

export function anchorMessage(
  standup: StandupConfig,
  date: string,
  reports: Report[],
  dayStatus: "open" | "closed",
): { text: string; blocks: unknown[] } {
  const byStatus = (s: Report["status"]) => reports.filter((r) => r.status === s);
  const submitted = byStatus("submitted");
  const skipped = byStatus("skipped");
  const missed = byStatus("missed");
  const resolved = new Set(reports.filter((r) => r.status !== "pending").map((r) => r.userId));
  const waiting = standup.participants.filter((u) => !resolved.has(u));

  let status: string;
  if (dayStatus === "closed") {
    status = `🏁 Closed — ${submitted.length}/${standup.participants.length} responded`;
    if (missed.length > 0) status += `, ${missed.length} missed`;
    if (skipped.length > 0) status += `, ${skipped.length} skipped`;
  } else if (waiting.length === 0) {
    status = `✅ Everyone is in — ${submitted.length} responded${
      skipped.length > 0 ? `, ${skipped.length} skipped` : ""
    }`;
  } else {
    status = `⏳ ${submitted.length}/${standup.participants.length} responded — waiting on ${waiting
      .map(mention)
      .join(", ")}`;
  }

  const title = `🌅 *${standup.name}* — ${friendlyDate(date)}`;
  return {
    text: `${standup.name} — ${friendlyDate(date)}`,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: title } },
      { type: "context", elements: [{ type: "mrkdwn", text: status }] },
    ],
  };
}

// --- DM prompt with Answer / Skip buttons ---

export function promptMessage(
  standup: StandupConfig,
  date: string,
): { text: string; blocks: unknown[] } {
  const value = JSON.stringify({ standupId: standup.id, date } satisfies ButtonMeta);
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
      {
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
      },
    ],
  };
}

export function reminderText(
  standup: StandupConfig,
  reminderNumber: number,
): string {
  return `⏰ Reminder ${reminderNumber}/${standup.maxReminders}: *${standup.name}* is still waiting for your update. Scroll up to answer or skip.`;
}

// --- Answer modal ---

export function answerModal(standup: StandupConfig, meta: ModalMeta): unknown {
  return {
    type: "modal",
    callback_id: "standup:submit",
    private_metadata: JSON.stringify(meta),
    title: { type: "plain_text", text: "Daily standup" }, // max 24 chars
    submit: { type: "plain_text", text: "Submit" },
    close: { type: "plain_text", text: "Cancel" },
    blocks: standup.questions.map((question, i) => ({
      type: "input",
      block_id: `q_${i}`,
      optional: true,
      label: { type: "plain_text", text: question.slice(0, 150) },
      element: {
        type: "plain_text_input",
        action_id: "answer",
        multiline: true,
      },
    })),
  };
}

/** Answers from a view_submission payload, aligned to question order. */
export function answersFromView(
  questions: string[],
  stateValues: Record<string, Record<string, { value?: string | null }>>,
): string[] {
  return questions.map((_, i) => stateValues[`q_${i}`]?.answer?.value ?? "");
}

// --- Threaded reply under the anchor ---

export function replyMessage(
  userId: string,
  questions: string[],
  answers: string[],
): { text: string; blocks: unknown[] } {
  const qa = questions
    .map((question, i) => ({ question, answer: answers[i]?.trim() ?? "" }))
    .filter(({ answer }) => answer.length > 0);

  const body =
    qa.length > 0
      ? qa.map(({ question, answer }) => `*${question}*\n${answer}`).join("\n\n")
      : "_No details shared._";

  return {
    text: `${mention(userId)} posted their standup`,
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: `${mention(userId)}\n\n${body}`.slice(0, 2900) },
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
  const text = `🔄 *${rotation.name}* — ${mention(assignee)} is on duty starting ${friendlyDate(date)}.`;
  return {
    text: `${rotation.name}: ${mention(assignee)} is on duty starting ${friendlyDate(date)}`,
    blocks: [{ type: "section", text: { type: "mrkdwn", text } }],
  };
}

export function onDutyDmMessage(
  rotation: RotationConfig,
  date: string,
): { text: string; blocks: unknown[] } {
  const text = `📟 You're on duty for *${rotation.name}* starting ${friendlyDate(date)}. Thanks!`;
  return {
    text: `You're on duty for ${rotation.name} starting ${friendlyDate(date)}`,
    blocks: [{ type: "section", text: { type: "mrkdwn", text } }],
  };
}
