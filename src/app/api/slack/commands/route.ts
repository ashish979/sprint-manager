import { NextResponse } from "next/server";

import { readVerifiedSlackRequest } from "@/lib/slack/request";

/**
 * Slash command endpoint (`/rota`, PLAN.md §1.2).
 *
 * Phase 1: verifies + answers with a placeholder. Phase 3 implements
 * `/rota who <name>` from DynamoDB.
 */
export async function POST(req: Request) {
  const verified = await readVerifiedSlackRequest(req);
  if (!verified.ok) return verified.response;

  const params = new URLSearchParams(verified.body);
  const command = params.get("command");
  const text = params.get("text")?.trim() ?? "";

  if (command === "/rota") {
    return NextResponse.json({
      response_type: "ephemeral",
      text:
        text.length > 0
          ? `Rotations aren't live yet — \`/rota ${text}\` will work once Phase 3 ships. 🚧`
          : "Usage: `/rota who <rotation-name>` (coming in Phase 3) 🚧",
    });
  }

  return NextResponse.json({
    response_type: "ephemeral",
    text: `Unknown command: ${command ?? "(none)"}`,
  });
}
