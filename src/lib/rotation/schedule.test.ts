import { describe, expect, it } from "vitest";

import { isShiftDue, nextShiftDate } from "./schedule";

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
  it("is due immediately if the rotation has never fired", () => {
    expect(isShiftDue("weekly", "2026-07-08", undefined)).toBe(true);
  });

  it("is not due before the next boundary", () => {
    expect(isShiftDue("weekly", "2026-07-10", "2026-07-08")).toBe(false);
  });

  it("is due exactly on the boundary date", () => {
    expect(isShiftDue("weekly", "2026-07-15", "2026-07-08")).toBe(true);
  });

  it("is still due after a missed boundary (delayed tick catches up)", () => {
    expect(isShiftDue("weekly", "2026-07-20", "2026-07-08")).toBe(true);
  });
});
