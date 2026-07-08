import { describe, expect, it } from "vitest";

import type { LocalParts } from "@/lib/tz";

import { isPromptDue, pendingReportAction } from "./schedule";

const config = {
  time: "09:30",
  weekdays: [1, 2, 3, 4, 5],
  closeAtTime: "23:45",
  remindAfterMinutes: 120,
  maxReminders: 2,
};

const wednesday = (minutes: number): LocalParts => ({
  date: "2026-07-08",
  weekday: 3,
  minutes,
});

describe("isPromptDue", () => {
  it("is due from the scheduled time until close", () => {
    expect(isPromptDue(wednesday(9 * 60 + 30), config)).toBe(true);
    expect(isPromptDue(wednesday(15 * 60), config)).toBe(true);
  });

  it("is not due before the scheduled time", () => {
    expect(isPromptDue(wednesday(9 * 60 + 15), config)).toBe(false);
  });

  it("is not due at or after the close cutoff", () => {
    expect(isPromptDue(wednesday(23 * 60 + 45), config)).toBe(false);
  });

  it("is not due on unscheduled weekdays", () => {
    const sunday: LocalParts = { date: "2026-07-12", weekday: 0, minutes: 600 };
    expect(isPromptDue(sunday, config)).toBe(false);
  });
});

describe("pendingReportAction", () => {
  const promptedAt = "2026-07-08T04:00:00.000Z"; // 09:30 IST

  const base = {
    local: wednesday(11 * 60),
    reportDate: "2026-07-08",
    promptedAt,
    remindersSent: 0,
    config,
  };

  const at = (iso: string) => new Date(iso);

  it("does nothing before the first reminder is due", () => {
    expect(
      pendingReportAction({ ...base, now: at("2026-07-08T05:00:00Z") }),
    ).toEqual({ type: "none" });
  });

  it("sends reminder 1 after remindAfterMinutes", () => {
    expect(
      pendingReportAction({ ...base, now: at("2026-07-08T06:00:00Z") }),
    ).toEqual({ type: "remind", reminderNumber: 1 });
  });

  it("sends reminder 2 after twice the interval", () => {
    expect(
      pendingReportAction({
        ...base,
        remindersSent: 1,
        now: at("2026-07-08T08:00:00Z"),
      }),
    ).toEqual({ type: "remind", reminderNumber: 2 });
  });

  it("stops at maxReminders", () => {
    expect(
      pendingReportAction({
        ...base,
        remindersSent: 2,
        now: at("2026-07-08T12:00:00Z"),
      }),
    ).toEqual({ type: "none" });
  });

  it("marks missed at the close cutoff", () => {
    expect(
      pendingReportAction({
        ...base,
        local: wednesday(23 * 60 + 45),
        now: at("2026-07-08T18:15:00Z"),
      }),
    ).toEqual({ type: "miss" });
  });

  it("marks missed when the local day rolled over", () => {
    expect(
      pendingReportAction({
        ...base,
        local: { date: "2026-07-09", weekday: 4, minutes: 30 },
        now: at("2026-07-08T19:00:00Z"),
      }),
    ).toEqual({ type: "miss" });
  });
});
