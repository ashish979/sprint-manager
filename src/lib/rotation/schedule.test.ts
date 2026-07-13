import { describe, expect, it } from "vitest";

import { timeToMinutes } from "@/lib/tz";

import { isShiftDue, nextShiftDate } from "./schedule";

function at(date: string, time: string) {
  return { date, minutes: timeToMinutes(time) };
}

describe("nextShiftDate", () => {
  it("daily advances by one day", () => {
    expect(nextShiftDate("daily", "2026-07-08")).toBe("2026-07-09");
  });

  it("weekly advances by seven days", () => {
    expect(nextShiftDate("weekly", "2026-07-08")).toBe("2026-07-15");
  });

  it("biweekly advances by fourteen days", () => {
    expect(nextShiftDate("biweekly", "2026-07-08")).toBe("2026-07-22");
  });

  it("weekdays skips Saturday and Sunday", () => {
    // 2026-07-10 is a Friday.
    expect(nextShiftDate("weekdays", "2026-07-10")).toBe("2026-07-13");
  });

  it("weekdays advances normally mid-week", () => {
    // 2026-07-08 is a Wednesday.
    expect(nextShiftDate("weekdays", "2026-07-08")).toBe("2026-07-09");
  });

  it("monthly keeps the day-of-month", () => {
    expect(nextShiftDate("monthly", "2026-03-15")).toBe("2026-04-15");
  });

  it("monthly clamps to the shorter month's last day", () => {
    expect(nextShiftDate("monthly", "2026-01-31")).toBe("2026-02-28");
  });
});

describe("isShiftDue", () => {
  it("a brand-new rotation waits for announceTime, not just any tick", () => {
    expect(isShiftDue("weekly", at("2026-07-08", "09:00"), "09:30", undefined)).toBe(false);
    expect(isShiftDue("weekly", at("2026-07-08", "09:30"), "09:30", undefined)).toBe(true);
  });

  it("is not due before the next boundary date, regardless of time", () => {
    expect(isShiftDue("weekly", at("2026-07-10", "23:00"), "09:30", "2026-07-08")).toBe(false);
  });

  it("on the boundary date, waits for announceTime", () => {
    expect(isShiftDue("weekly", at("2026-07-15", "09:00"), "09:30", "2026-07-08")).toBe(false);
    expect(isShiftDue("weekly", at("2026-07-15", "09:30"), "09:30", "2026-07-08")).toBe(true);
  });

  it("is still due after a missed boundary regardless of time (delayed tick catches up)", () => {
    expect(isShiftDue("weekly", at("2026-07-20", "00:00"), "09:30", "2026-07-08")).toBe(true);
  });
});

describe("activeDays (skip weekends etc.)", () => {
  const WEEKDAYS_ONLY = [1, 2, 3, 4, 5];

  it("rolls a cadence date on a non-active day forward to the next active day", () => {
    // Fri 2026-07-10 → daily lands Sat 07-11 → rolls to Mon 07-13.
    expect(nextShiftDate("daily", "2026-07-10", WEEKDAYS_ONLY)).toBe("2026-07-13");
  });

  it("a brand-new rotation is not due on a non-active day", () => {
    // Sat 2026-07-11.
    expect(isShiftDue("daily", at("2026-07-11", "10:00"), "09:30", undefined, WEEKDAYS_ONLY)).toBe(
      false,
    );
  });

  it("a brand-new rotation is due on an active day at announceTime", () => {
    // Mon 2026-07-13.
    expect(isShiftDue("daily", at("2026-07-13", "09:30"), "09:30", undefined, WEEKDAYS_ONLY)).toBe(
      true,
    );
  });
});
