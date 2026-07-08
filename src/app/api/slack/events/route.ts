import { NextResponse } from "next/server";

import { readVerifiedSlackRequest } from "@/lib/slack/request";

/**
 * Slack Events API endpoint (PLAN.md §2.1).
 *
 * Phase 1: answers the url_verification handshake and acknowledges events.
 * Event handling proper lands with standups in Phase 2.
 */
export async function POST(req: Request) {
  const verified = await readVerifiedSlackRequest(req);
  if (!verified.ok) return verified.response;

  const payload = JSON.parse(verified.body);

  // One-time handshake when the endpoint URL is saved in the Slack app config.
  if (payload.type === "url_verification") {
    return NextResponse.json({ challenge: payload.challenge });
  }

  // Slack retries unless we ack within 3s; heavy work must happen elsewhere.
  return NextResponse.json({ ok: true });
}
