/** Throwaway smoke test for the DynamoDB store layer (run against DynamoDB Local). */
import {
  createDayIfAbsent,
  createReportIfAbsent,
  getDay,
  listReports,
  markReportIfPending,
  saveSubmission,
  setDayThread,
} from "../src/lib/store/reports";
import { deleteStandup, getStandup, listStandups, putStandup } from "../src/lib/store/standups";
import { DEFAULT_QUESTIONS, type StandupConfig } from "../src/lib/types";

const SMOKE_ID = `smoke-${Date.now()}`;

const config: StandupConfig = {
  id: SMOKE_ID,
  name: "Smoke standup",
  questions: [...DEFAULT_QUESTIONS],
  time: "09:30",
  weekdays: [1, 2, 3, 4, 5],
  participants: ["U_SMOKE_A", "U_SMOKE_B"],
  channel: "C_SMOKE",
  remindAfterMinutes: 120,
  maxReminders: 2,
  closeAtTime: "23:45",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const assert = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`SMOKE FAIL: ${msg}`);
  console.log(`ok: ${msg}`);
};

async function main() {
  await putStandup(config);
  assert((await getStandup(SMOKE_ID))?.name === "Smoke standup", "put/get standup");
  assert((await listStandups()).some((s) => s.id === SMOKE_ID), "listStandups finds it");

  const date = "2026-07-08";
  await createDayIfAbsent({
    standupId: SMOKE_ID,
    date,
    channel: "C_SMOKE",
    status: "open",
    createdAt: new Date().toISOString(),
  });
  await setDayThread(SMOKE_ID, date, "111.222");
  assert((await getDay(SMOKE_ID, date))?.threadTs === "111.222", "day + threadTs");
  await setDayThread(SMOKE_ID, date, "999.999");
  assert((await getDay(SMOKE_ID, date))?.threadTs === "111.222", "threadTs write is first-wins");

  const report = {
    standupId: SMOKE_ID,
    date,
    userId: "U_SMOKE_A",
    status: "pending" as const,
    answers: [],
    promptedAt: new Date().toISOString(),
    remindersSent: 0,
  };
  assert(await createReportIfAbsent(report), "first report create wins");
  assert(!(await createReportIfAbsent(report)), "second create is a no-op");

  assert(await markReportIfPending(SMOKE_ID, date, "U_SMOKE_A", "skipped"), "pending→skipped");
  assert(
    !(await markReportIfPending(SMOKE_ID, date, "U_SMOKE_A", "missed")),
    "skipped→missed refused (conditional)",
  );

  await saveSubmission(SMOKE_ID, date, "U_SMOKE_A", ["a", "b", "", "fine"], "123.456");
  const reports = await listReports(SMOKE_ID, date);
  assert(reports.length === 1 && reports[0].status === "submitted", "late submission wins");
  assert(reports[0].answers[3] === "fine", "answers persisted");

  await deleteStandup(SMOKE_ID); // keep the dashboard clean
  console.log("✅ store smoke test passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
