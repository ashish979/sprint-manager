/**
 * Central place for runtime configuration.
 *
 * In deployed stages these are injected by sst.config.ts (secrets/links);
 * locally they come from .env.local (gitignored).
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  get slackSigningSecret() {
    return required("SLACK_SIGNING_SECRET");
  },
  get slackBotToken() {
    return required("SLACK_BOT_TOKEN");
  },
  get tableName() {
    return required("TABLE_NAME");
  },
  /** Slack workspace (team) id, e.g. T0123456789 — gates dashboard sign-in. */
  get slackTeamId() {
    return required("SLACK_TEAM_ID");
  },
  /** Public base URL (no trailing slash) — for Slack messages that link back to the dashboard. */
  get siteUrl() {
    return required("SITE_URL");
  },
};
