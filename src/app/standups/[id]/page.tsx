import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ConfirmSubmitButton } from "@/app/_components/confirm-submit-button";
import { isAdminSession } from "@/lib/authz";
import { getSession } from "@/lib/session";
import { blockerQuestionIndex, isBlockerAnswer } from "@/lib/standup/blockers";
import { ensureChannelInfo } from "@/lib/store/channels";
import { getDay, listReports } from "@/lib/store/reports";
import { getStandup } from "@/lib/store/standups";
import { getUserProfile } from "@/lib/store/users";
import { formatTime12h, todayIst } from "@/lib/tz";
import type { QuestionConfig, Report, ReportStatus } from "@/lib/types";

import { deleteStandupAction, sendReminderAction, startNowAction } from "../actions";

export const dynamic = "force-dynamic";

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const STATUS_BADGE: Record<ReportStatus, { label: string; className: string }> = {
  submitted: { label: "✅ submitted", className: "badge-success" },
  pending: { label: "⏳ pending", className: "badge-warning" },
  skipped: { label: "🏖 skipped", className: "badge-ghost" },
  missed: { label: "❌ missed", className: "badge-error" },
  ooo: { label: "🌴 out of office", className: "badge-info" },
};

const DAY_STATUS_BADGE = {
  closed: { label: "Closed", className: "badge-ghost" },
  open: { label: "In progress", className: "badge-success" },
  notStarted: { label: "Not started", className: "badge-ghost" },
} as const;

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
  const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate ?? "") ? rawDate! : todayIst();

  const [reports, admin, profiles, channelInfo, day] = await Promise.all([
    listReports(standup.id, date),
    isAdminSession(),
    Promise.all(standup.participants.map((u) => getUserProfile(u))),
    ensureChannelInfo(standup.channel),
    getDay(standup.id, date),
  ]);
  const nameOf = (userId: string) =>
    profiles.find((p) => p?.userId === userId)?.name ?? userId;
  const reportOf = (userId: string): Report | undefined =>
    reports.find((r) => r.userId === userId);
  const blockerIdx = blockerQuestionIndex(standup.questions);
  const dayStatus = DAY_STATUS_BADGE[day ? day.status : "notStarted"];

  // "Start now" always prompts for today regardless of which date is being
  // viewed above — so whether to show it must check today specifically, not
  // whatever `date` the admin has navigated to via the report date picker.
  const today = todayIst();
  const todayDay = date === today ? day : await getDay(standup.id, today);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <Link href="/standups" className="link link-hover text-sm text-base-content/60">
        ← All standups
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{standup.name}</h1>
          <span className={`badge badge-sm ${dayStatus.className}`}>{dayStatus.label}</span>
        </div>
        {admin && (
          <div className="flex gap-2">
            <Link href={`/standups/${standup.id}/edit`} className="btn btn-outline btn-sm">
              Edit
            </Link>
            {!todayDay && (
              <form action={startNowAction}>
                <input type="hidden" name="id" value={standup.id} />
                <button className="btn btn-primary btn-sm">Start now</button>
              </form>
            )}
            <form action={deleteStandupAction}>
              <input type="hidden" name="id" value={standup.id} />
              <ConfirmSubmitButton
                confirmText={`Delete "${standup.name}"? This can't be undone.`}
                className="btn btn-outline btn-error btn-sm"
              >
                Delete
              </ConfirmSubmitButton>
            </form>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="badge badge-ghost badge-lg">🕐 {formatTime12h(standup.time)} local</span>
        <span className="badge badge-ghost badge-lg">
          📆 {standup.weekdays.map((d) => WEEKDAY_LABELS[d]).join(" ")}
        </span>
        <span className="badge badge-ghost badge-lg">
          🔔 every {standup.remindAfterMinutes}m, up to {standup.maxReminders}×
        </span>
        <span className="badge badge-ghost badge-lg">🔒 closes {standup.closeAtTime}</span>
        <span className="badge badge-ghost badge-lg">#{channelInfo?.name ?? standup.channel}</span>
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
          className="input input-sm input-bordered"
        />
        <button className="btn btn-sm btn-neutral">Go</button>
      </form>

      <ul className="mt-4 space-y-3">
        {standup.participants.map((userId) => {
          const report = reportOf(userId);
          const status: ReportStatus = report?.status ?? "pending";
          const badge = STATUS_BADGE[status];
          return (
            <li key={userId} className="card border border-base-300 bg-base-100 shadow-sm">
              <div className="card-body gap-0 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{nameOf(userId)}</span>
                  <span className={`badge badge-sm ${report ? badge.className : "badge-ghost"}`}>
                    {report ? badge.label : "— not prompted"}
                  </span>
                </div>

                {report?.status === "submitted" && !standup.anonymous && (
                  <AnswerList standup={standup} report={report} blockerIdx={blockerIdx} />
                )}

                {admin && report?.status === "pending" && (
                  <form action={sendReminderAction} className="mt-3">
                    <input type="hidden" name="standupId" value={standup.id} />
                    <input type="hidden" name="date" value={date} />
                    <input type="hidden" name="userId" value={userId} />
                    <button className="btn btn-ghost btn-xs">
                      Remind ({report.remindersSent} sent)
                    </button>
                  </form>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {standup.anonymous && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-base-content/60">Responses (anonymous)</h2>
          <ul className="mt-2 space-y-3">
            {reports
              .filter((r) => r.status === "submitted")
              .sort((a, b) => (a.submittedAt ?? "").localeCompare(b.submittedAt ?? ""))
              .map((report, i) => (
                <li key={report.userId} className="card border border-base-300 bg-base-100 shadow-sm">
                  <div className="card-body gap-0 p-4">
                    <div className="text-sm font-medium text-base-content/60">Response {i + 1}</div>
                    <AnswerList standup={standup} report={report} blockerIdx={blockerIdx} />
                  </div>
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
            <dt className="text-xs font-medium text-base-content/50">{question.text}</dt>
            <dd
              className={`mt-0.5 whitespace-pre-wrap text-sm ${
                blocker ? "rounded-field bg-error/10 p-2 font-medium text-error" : ""
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
