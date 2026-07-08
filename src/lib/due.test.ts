import { describe, expect, it } from "vitest";

import { dueKey, floorToTick } from "./due";

describe("floorToTick", () => {
  it("floors to the previous 15-minute boundary", () => {
    const d = new Date("2026-07-07T09:14:59Z");
    expect(floorToTick(d).toISOString()).toBe("2026-07-07T09:00:00.000Z");
  });

  it("leaves exact boundaries unchanged", () => {
    const d = new Date("2026-07-07T09:45:00Z");
    expect(floorToTick(d).toISOString()).toBe("2026-07-07T09:45:00.000Z");
  });

  it("does not mutate its input", () => {
    const d = new Date("2026-07-07T09:59:59Z");
    floorToTick(d);
    expect(d.toISOString()).toBe("2026-07-07T09:59:59.000Z");
  });
});

describe("dueKey", () => {
  it("formats a zero-padded UTC key", () => {
    expect(dueKey(new Date("2026-07-07T09:17:30Z"))).toBe(
      "DUE#2026-07-07-09-15",
    );
  });

  it("pads single-digit months, days, hours and minutes", () => {
    expect(dueKey(new Date("2026-01-02T03:04:00Z"))).toBe(
      "DUE#2026-01-02-03-00",
    );
  });
});
