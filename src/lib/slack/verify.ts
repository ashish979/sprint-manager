import { createHmac, timingSafeEqual } from "node:crypto";

/** Reject requests whose Slack timestamp is older than this (replay protection). */
const MAX_AGE_SECONDS = 5 * 60;

/**
 * Verify a Slack request signature (https://api.slack.com/authentication/verifying-requests-from-slack).
 *
 * @param signingSecret Slack app signing secret
 * @param body          Raw, unparsed request body
 * @param timestamp     `x-slack-request-timestamp` header
 * @param signature     `x-slack-signature` header (v0=<hex>)
 * @param now           Current time in ms (injectable for tests)
 */
export function verifySlackSignature({
  signingSecret,
  body,
  timestamp,
  signature,
  now = Date.now(),
}: {
  signingSecret: string;
  body: string;
  timestamp: string | null;
  signature: string | null;
  now?: number;
}): boolean {
  if (!timestamp || !signature) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(now / 1000 - ts) > MAX_AGE_SECONDS) return false;

  const expected = `v0=${createHmac("sha256", signingSecret)
    .update(`v0:${timestamp}:${body}`)
    .digest("hex")}`;

  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signature);
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}
