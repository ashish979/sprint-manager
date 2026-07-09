import { describe, expect, it } from "vitest";

import { formatTime12h, friendlyDate, localParts, timeToMinutes } from "./tz";

describe("localParts", () => {
  // 2026-07-08T04:30:00Z = 10:00 IST (UTC+5:30) = 21:30 PDT on Jul 7 (UTC-7)
  const instant = new Date("2026-07-08T04:30:00Z");

  it("projects into Asia/Kolkata", () => {
    expect(localParts(instant, "Asia/Kolkata")).toEqual({
      date: "2026-07-08",
      weekday: 3, // Wednesday
      minutes: 10 * 60,
    });
  });

  it("crosses the date line westwards (Los Angeles is still Tuesday)", () => {
    expect(localParts(instant, "America/Los_Angeles")).toEqual({
      date: "2026-07-07",
      weekday: 2, // Tuesday
      minutes: 21 * 60 + 30,
    });
  });

  it("handles midnight without the 24:00 quirk", () => {
    const midnightUtc = new Date("2026-07-08T00:00:00Z");
    expect(localParts(midnightUtc, "UTC").minutes).toBe(0);
  });
});

describe("timeToMinutes", () => {
  it("parses HH:MM", () => {
    expect(timeToMinutes("09:15")).toBe(555);
    expect(timeToMinutes("00:00")).toBe(0);
    expect(timeToMinutes("23:45")).toBe(1425);
  });

  it("returns NaN for garbage", () => {
    expect(timeToMinutes("9am")).toBeNaN();
    expect(timeToMinutes("")).toBeNaN();
  });
});

describe("friendlyDate", () => {
  it("formats yyyy-mm-dd", () => {
    expect(friendlyDate("2026-07-08")).toBe("Wed, Jul 8");
  });
});

describe("formatTime12h", () => {
  it("formats morning, noon, midnight, and evening", () => {
    expect(formatTime12h("09:15")).toBe("9:15 AM");
    expect(formatTime12h("00:00")).toBe("12:00 AM");
    expect(formatTime12h("12:00")).toBe("12:00 PM");
    expect(formatTime12h("19:00")).toBe("7:00 PM");
    expect(formatTime12h("23:45")).toBe("11:45 PM");
  });

  it("returns garbage input unchanged", () => {
    expect(formatTime12h("garbage")).toBe("garbage");
  });
});
