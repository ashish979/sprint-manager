import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { isAdminSession } from "@/lib/authz";
import { getSession } from "@/lib/session";
import { blockerQuestionIndex, isBlockerAnswer } from "@/lib/standup/blockers";
import { listReports } from "@/lib/store/reports";
import { getStandup } from "@/lib/store/standups";
import { getUserProfile } from "@/lib/store/users";
import type { Report, ReportStatus } from "@/lib/types";

import { deleteStandupAction, sendReminderAction, startNowAction } from "../actions";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<ReportStatus, { label: string; class: string }> = {
  submitted: { label: "✅ submitted", class: "bg-green-100 text-green-800" },
  pending: { label: "⏳ pending", class: "bg-yellow-100 text-yellow-800" },
  skipped: { label: "🏖 skipped", class: "bg-gray-100 text-gray-600" },
  missed: { label: "❌ missed", class: "bg-red-100 text-red-700" },
  ooo: { label: "🌴 out of office", class: "bg-blue-100 text-blue-800" },
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

  const [reports, admin, profiles] = await Promise.all([
    listReports(standup.id, date),
    isAdminSession(),
    Promise.all(standup.participants.map((u) => getUserProfile(u))),
  ]);
  const nameOf = (userId: string) =>
    profiles.find((p) => p?.userId === userId)?.name ?? userId;
  const reportOf = (userId: string): Report | undefined =>
    reports.find((r) => r.userId === userId);
  const blockerIdx = blockerQuestionIndex(standup.questions);

  return (
    <main className="mx-auto max-w-3xl p-8">
      <Link href="/standups" className="text-sm text-gray-500 underline">
        ← All standups
      </Link>

      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{standup.name}</h1>
        {admin && (
          <div className="flex gap-2">
            <Link
              href={`/standups/${standup.id}/edit`}
              className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Edit
            </Link>
            <form action={startNowAction}>
              <input type="hidden" name="id" value={standup.id} />
              <button className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50">
                Start now
              </button>
            </form>
            <form action={deleteStandupAction}>
              <input type="hidden" name="id" value={standup.id} />
              <button className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">
                Delete
              </button>
            </form>
          </div>
        )}
      </div>

      <p className="mt-1 text-sm text-gray-500">
        {standup.time} local · reminds every {standup.remindAfterMinutes} min ×
        {standup.maxReminders} · closes {standup.closeAtTime} · channel{" "}
        <code>{standup.channel}</code>
      </p>

      <form method="get" className="mt-6 flex items-center gap-2">
        <label className="text-sm font-medium" htmlFor="date">
          Reports for
        </label>
        <input
          id="date"
          type="date"
          name="date"
          defaultValue={date}
          className="rounded border px-2 py-1 text-sm"
        />
        <button className="rounded border px-3 py-1 text-sm hover:bg-gray-50">Go</button>
      </form>

      <ul className="mt-4 space-y-4">
        {standup.participants.map((userId) => {
          const report = reportOf(userId);
          const status: ReportStatus = report?.status ?? "pending";
          const badge = STATUS_BADGE[status];
          return (
            <li key={userId} className="rounded border p-4">
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
                  <button className="rounded border px-2 py-1 text-xs hover:bg-gray-50">
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
          <h2 className="text-sm font-semibold text-gray-500">Responses (anonymous)</h2>
          <ul className="mt-2 space-y-4">
            {reports
              .filter((r) => r.status === "submitted")
              .sort((a, b) => (a.submittedAt ?? "").localeCompare(b.submittedAt ?? ""))
              .map((report, i) => (
                <li key={report.userId} className="rounded border p-4">
                  <div className="text-sm font-medium text-gray-500">Response {i + 1}</div>
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
  standup: { questions: string[] };
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
            <dt className="text-xs font-medium text-gray-500">{question}</dt>
            <dd
              className={`mt-0.5 whitespace-pre-wrap text-sm ${
                blocker ? "rounded bg-red-50 p-2 font-medium text-red-800" : ""
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
