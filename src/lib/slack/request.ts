import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { verifySlackSignature } from "@/lib/slack/verify";

/**
 * Read and authenticate a Slack webhook request.
 *
 * Returns the raw body on success (signature must be computed over the
 * unparsed bytes), or a 401 response to return as-is.
 */
export async function readVerifiedSlackRequest(
  req: Request,
): Promise<{ ok: true; body: string } | { ok: false; response: NextResponse }> {
  const body = await req.text();

  const valid = verifySlackSignature({
    signingSecret: env.slackSigningSecret,
    body,
    timestamp: req.headers.get("x-slack-request-timestamp"),
    signature: req.headers.get("x-slack-signature"),
  });

  if (!valid) {
    return {
      ok: false,
      response: NextResponse.json({ error: "invalid signature" }, { status: 401 }),
    };
  }

  return { ok: true, body };
}
