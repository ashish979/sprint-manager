import type { Session } from "next-auth";

import { auth } from "@/auth";

/**
 * Session accessor for pages/actions — use this instead of auth().
 *
 * Dev-only bypass: setting DEV_USER=<your Slack member id> in .env.local
 * yields a synthetic admin session without Slack OAuth (which requires an
 * HTTPS redirect URL and therefore a tunnel). Ignored in production builds.
 */
export async function getSession(): Promise<Session | null> {
  const devUser = process.env.DEV_USER;
  if (process.env.NODE_ENV !== "production" && devUser) {
    return {
      user: { name: `Dev user (${devUser})` },
      slackUserId: devUser,
      isAdmin: true,
      isEditor: true,
      isDev: true,
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    } as Session;
  }
  return auth();
}
