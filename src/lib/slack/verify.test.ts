import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { verifySlackSignature } from "./verify";

const SECRET = "8f742231b10e8888abcd99yyyzzz85a5";

function sign(body: string, timestamp: string, secret = SECRET): string {
  return `v0=${createHmac("sha256", secret)
    .update(`v0:${timestamp}:${body}`)
    .digest("hex")}`;
}

describe("verifySlackSignature", () => {
  const body = "token=xyz&team_id=T123&command=%2Frota";
  const now = 1_751_900_000_000; // fixed clock
  const timestamp = String(Math.floor(now / 1000));

  it("accepts a valid signature", () => {
    expect(
      verifySlackSignature({
        signingSecret: SECRET,
        body,
        timestamp,
        signature: sign(body, timestamp),
        now,
      }),
    ).toBe(true);
  });

  it("rejects a tampered body", () => {
    expect(
      verifySlackSignature({
        signingSecret: SECRET,
        body: body + "&evil=1",
        timestamp,
        signature: sign(body, timestamp),
        now,
      }),
    ).toBe(false);
  });

  it("rejects a signature made with the wrong secret", () => {
    expect(
      verifySlackSignature({
        signingSecret: SECRET,
        body,
        timestamp,
        signature: sign(body, timestamp, "wrong-secret"),
        now,
      }),
    ).toBe(false);
  });

  it("rejects timestamps older than 5 minutes (replay)", () => {
    const old = String(Math.floor(now / 1000) - 6 * 60);
    expect(
      verifySlackSignature({
        signingSecret: SECRET,
        body,
        timestamp: old,
        signature: sign(body, old),
        now,
      }),
    ).toBe(false);
  });

  it("rejects missing or garbage headers", () => {
    expect(
      verifySlackSignature({
        signingSecret: SECRET,
        body,
        timestamp: null,
        signature: sign(body, timestamp),
        now,
      }),
    ).toBe(false);
    expect(
      verifySlackSignature({
        signingSecret: SECRET,
        body,
        timestamp: "not-a-number",
        signature: sign(body, timestamp),
        now,
      }),
    ).toBe(false);
    expect(
      verifySlackSignature({
        signingSecret: SECRET,
        body,
        timestamp,
        signature: null,
        now,
      }),
    ).toBe(false);
  });
});
