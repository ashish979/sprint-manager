import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { slack } from "@/lib/slack/client";

export interface UserOption {
  id: string;
  name: string;
}

const CACHE_KEY = { pk: "DIRECTORY", sk: "USERS" };
/** Workspace membership changes rarely — no need to refetch on every page load. */
const CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * Participant picker for dashboard forms. Cached in DynamoDB: `users.list`
 * needs pagination for workspaces over 200 members, and re-fetching every
 * page load risks Slack's rate limit (seen in practice — repeated reloads
 * during testing hit "ratelimited" and silently dropped the picker).
 * Falls back to the last-known-good cached list if a refresh fails, and
 * only to `null` (picker omitted) if there's no cache at all yet.
 */
export async function listUserOptions(): Promise<UserOption[] | null> {
  const cached = await db.send(new GetCommand({ TableName: env.tableName, Key: CACHE_KEY }));
  const item = cached.Item as { users: UserOption[]; updatedAt: string } | undefined;
  if (item && Date.now() - Date.parse(item.updatedAt) < CACHE_TTL_MS) {
    return item.users;
  }

  try {
    const users = (await slack.listUsers()).map((u) => ({ id: u.id, name: u.real_name || u.name }));
    await db.send(
      new PutCommand({
        TableName: env.tableName,
        Item: { ...CACHE_KEY, users, updatedAt: new Date().toISOString() },
      }),
    );
    return users;
  } catch (error) {
    console.error("users.list failed:", error);
    return item?.users ?? null;
  }
}
