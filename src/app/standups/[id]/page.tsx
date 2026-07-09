import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ConfirmSubmitButton } from "@/app/_components/confirm-submit-button";
import { isAdminSession } from "@/lib/authz";
import { getSession } from "@/lib/session";
import { blockerQuestionIndex, isBlockerAnswer } from "@/lib/standup/blockers";
import { ensureChannelInfo } from "@/lib/store/channels";
import { listReports } from "@/lib/store/reports";
import { getStandup } from "@/lib/store/standups";
import { getUserProfile } from "@/lib/store/users";
import { formatTime12h } from "@/lib/tz";
import type { QuestionConfig, Report, ReportStatus } from "@/lib/types";

import { deleteStandupAction, sendReminderAction, startNowAction } from "../actions";

export const dynamic = "force-dynamic";

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const chipClass =
  "rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";

const STATUS_BADGE: Record<ReportStatus, { label: string; class: string }> = {
  submitted: {
    label: "✅ submitted",
    class: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  },
  pending: {
    label: "⏳ pending",
    class: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  },
  skipped: {
    label: "🏖 skipped",
    class: "bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-300",
  },
  missed: {
    label: "❌ missed",
    class: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  },
  ooo: {
    label: "🌴 out of office",
    class: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  },
};

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function StandupDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/standups");

  const { id } = await params;
  const standup = await getStandup(id);
  if (!standup) notFound();

  const { date: rawDate } = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate ?? "") ? rawDate! : todayUtc();

  const [reports, admin, profiles, channelInfo] = await Promise.all([
    listReports(standup.id, date),
    isAdminSession(),
    Promise.all(standup.participants.map((u) => getUserProfile(u))),
    ensureChannelInfo(standup.channel),
  ]);
  const nameOf = (userId: string) =>
    profiles.find((p) => p?.userId === userId)?.name ?? userId;
  const reportOf = (userId: string): Report | undefined =>
    reports.find((r) => r.userId === userId);
  const blockerIdx = blockerQuestionIndex(standup.questions);

  return (
    <main className="mx-auto max-w-3xl p-8">
      <Link href="/standups" className="text-sm text-zinc-500 underline dark:text-zinc-400">
        ← All standups
      </Link>

      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{standup.name}</h1>
        {admin && (
          <div className="flex gap-2">
            <Link
              href={`/standups/${standup.id}/edit`}
              className="rounded border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Edit
            </Link>
            <form action={startNowAction}>
              <input type="hidden" name="id" value={standup.id} />
              <button className="rounded border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
                Start now
              </button>
            </form>
            <form action={deleteStandupAction}>
              <input type="hidden" name="id" value={standup.id} />
              <ConfirmSubmitButton
                confirmText={`Delete "${standup.name}"? This can't be undone.`}
                className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
              >
                Delete
              </ConfirmSubmitButton>
            </form>
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className={chipClass}>🕐 {formatTime12h(standup.time)} local</span>
        <span className={chipClass}>
          📆 {standup.weekdays.map((d) => WEEKDAY_LABELS[d]).join(" ")}
        </span>
        <span className={chipClass}>
          🔔 every {standup.remindAfterMinutes}m, up to {standup.maxReminders}×
        </span>
        <span className={chipClass}>🔒 closes {standup.closeAtTime}</span>
        <span className={chipClass}>#{channelInfo?.name ?? standup.channel}</span>
      </div>

      <form method="get" className="mt-6 flex items-center gap-2">
        <label className="text-sm font-medium" htmlFor="date">
          Reports for
        </label>
        <input
          id="date"
          type="date"
          name="date"
          defaultValue={date}
          className="rounded border px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        />
        <button className="rounded border px-3 py-1 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
          Go
        </button>
      </form>

      <ul className="mt-4 space-y-4">
        {standup.participants.map((userId) => {
          const report = reportOf(userId);
          const status: ReportStatus = report?.status ?? "pending";
          const badge = STATUS_BADGE[status];
          return (
            <li key={userId} className="rounded border p-4 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <span className="font-medium">{nameOf(userId)}</span>
                <span className={`rounded px-2 py-0.5 text-xs ${badge.class}`}>
                  {report ? badge.label : "— not prompted"}
                </span>
              </div>

              {report?.status === "submitted" && !standup.anonymous && (
                <AnswerList standup={standup} report={report} blockerIdx={blockerIdx} />
              )}

              {admin && report?.status === "pending" && (
                <form action={sendReminderAction} className="mt-2">
                  <input type="hidden" name="standupId" value={standup.id} />
                  <input type="hidden" name="date" value={date} />
                  <input type="hidden" name="userId" value={userId} />
                  <button className="rounded border px-2 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
                    Remind ({report.remindersSent} sent)
                  </button>
                </form>
              )}
            </li>
          );
        })}
      </ul>

      {standup.anonymous && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            Responses (anonymous)
          </h2>
          <ul className="mt-2 space-y-4">
            {reports
              .filter((r) => r.status === "submitted")
              .sort((a, b) => (a.submittedAt ?? "").localeCompare(b.submittedAt ?? ""))
              .map((report, i) => (
                <li key={report.userId} className="rounded border p-4 dark:border-zinc-800">
                  <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    Response {i + 1}
                  </div>
                  <AnswerList standup={standup} report={report} blockerIdx={blockerIdx} />
                </li>
              ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function AnswerList({
  standup,
  report,
  blockerIdx,
}: {
  standup: { questions: QuestionConfig[] };
  report: Report;
  blockerIdx: number;
}) {
  return (
    <dl className="mt-3 space-y-2">
      {standup.questions.map((question, i) => {
        const answer = report.answers[i]?.trim() ?? "";
        if (!answer) return null;
        const blocker = i === blockerIdx && isBlockerAnswer(answer);
        return (
          <div key={i}>
            <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{question.text}</dt>
            <dd
              className={`mt-0.5 whitespace-pre-wrap text-sm ${
                blocker
                  ? "rounded bg-red-50 p-2 font-medium text-red-800 dark:bg-red-950 dark:text-red-300"
                  : ""
              }`}
            >
              {blocker && "🚫 "}
              {answer}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
