import { env } from "@/lib/env";

/**
 * Minimal Slack Web API client (no SDK — keeps Lambda bundles small).
 *
 * Everything is sent form-encoded with JSON-stringified complex values,
 * which every Web API method accepts (JSON bodies are only accepted by
 * some methods).
 */

interface SlackResponse {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
}

async function call<T extends SlackResponse>(
  method: string,
  args: Record<string, unknown>,
): Promise<T> {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined || value === null) continue;
    body.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
  }

  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.slackBotToken}`,
      "content-type": "application/x-www-form-urlencoded; charset=utf-8",
    },
    body,
  });
  const data = (await res.json()) as T;
  if (!data.ok) {
    throw new Error(`Slack ${method} failed: ${data.error ?? "unknown_error"}`);
  }
  return data;
}

export interface MessageArgs {
  channel: string;
  text: string;
  blocks?: unknown[];
  thread_ts?: string;
}

export const slack = {
  /** Returns the posted message's ts. */
  async postMessage(args: MessageArgs): Promise<string> {
    const res = await call<SlackResponse & { ts: string }>("chat.postMessage", {
      ...args,
    });
    return res.ts;
  },

  async updateMessage(args: MessageArgs & { ts: string }): Promise<void> {
    await call("chat.update", { ...args });
  },

  /** Opens (or fetches) the DM channel with a user; returns its id. */
  async openDm(userId: string): Promise<string> {
    const res = await call<SlackResponse & { channel: { id: string } }>(
      "conversations.open",
      { users: userId },
    );
    return res.channel.id;
  },

  async openView(triggerId: string, view: unknown): Promise<void> {
    await call("views.open", { trigger_id: triggerId, view });
  },

  async userInfo(
    userId: string,
  ): Promise<{ tz?: string; real_name?: string; deleted?: boolean }> {
    const res = await call<
      SlackResponse & { user: { tz?: string; real_name?: string; deleted?: boolean } }
    >("users.info", { user: userId });
    return res.user;
  },

  /** For block_actions response_url — replaces the original message. */
  async respond(responseUrl: string, text: string): Promise<void> {
    await fetch(responseUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ replace_original: true, text }),
    });
  },
};
