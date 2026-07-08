import { NextResponse } from "next/server";

import { readVerifiedSlackRequest } from "@/lib/slack/request";

/**
 * Slack interactivity endpoint: button clicks, modal submissions.
 *
 * Phase 1: verifies + acks. Phase 2 routes payloads (answer-standup button,
 * standup modal submission) to real handlers.
 */
export async function POST(req: Request) {
  const verified = await readVerifiedSlackRequest(req);
  if (!verified.ok) return verified.response;

  // Interactivity payloads arrive form-encoded with a JSON `payload` field.
  const params = new URLSearchParams(verified.body);
  const raw = params.get("payload");
  if (!raw) {
    return NextResponse.json({ error: "missing payload" }, { status: 400 });
  }

  const payload = JSON.parse(raw);
  console.log("slack interactivity (Phase 1 stub):", payload.type);

  // Empty 200 tells Slack the interaction was received.
  return new NextResponse(null, { status: 200 });
}
