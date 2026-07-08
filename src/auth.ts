import NextAuth from "next-auth";
import Slack from "next-auth/providers/slack";

import { getTeamSettings } from "@/lib/db";

/**
 * Sign in with Slack (OIDC) — PLAN.md §1.3/§6.
 *
 * Access rule: membership of our Slack workspace = access; the admin
 * allowlist lives in the TEAM#SETTINGS DynamoDB item and is snapshotted
 * into the JWT at sign-in (re-login picks up allowlist changes).
 */

declare module "next-auth" {
  interface Session {
    slackUserId?: string;
    isAdmin: boolean;
    /** True for the DEV_USER synthetic session (see src/lib/session.ts). */
    isDev?: boolean;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Slack({
      clientId: process.env.SLACK_CLIENT_ID,
      clientSecret: process.env.SLACK_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    signIn({ profile }) {
      // Only members of our workspace may sign in.
      return profile?.["https://slack.com/team_id"] === process.env.SLACK_TEAM_ID;
    },
    async jwt({ token, profile }) {
      // `profile` is only present on the sign-in request.
      if (profile) {
        const slackUserId = profile["https://slack.com/user_id"] as string;
        token.slackUserId = slackUserId;
        try {
          const settings = await getTeamSettings();
          token.isAdmin = settings.adminSlackIds.includes(slackUserId);
        } catch (error) {
          // Table unreachable (e.g. local dev without AWS) — default to member.
          console.error("admin allowlist lookup failed:", error);
          token.isAdmin = false;
        }
      }
      return token;
    },
    session({ session, token }) {
      session.slackUserId = token.slackUserId as string | undefined;
      session.isAdmin = Boolean(token.isAdmin);
      return session;
    },
  },
});
