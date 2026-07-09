import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { slack } from "@/lib/slack/client";
import type { OutOfOfficeRange, UserProfile } from "@/lib/types";

const key = (userId: string) => ({ pk: `USER#${userId}`, sk: "PROFILE" });

/** Re-fetch a profile from Slack when older than this (picks up tz moves). */
const PROFILE_TTL_MS = 20 * 60 * 60 * 1000;

export async function getUserProfile(userId: string): Promise<UserProfile | undefined> {
  const res = await db.send(
    new GetCommand({ TableName: env.tableName, Key: key(userId) }),
  );
  return res.Item as UserProfile | undefined;
}

export async function putUserProfile(profile: UserProfile): Promise<void> {
  await db.send(
    new PutCommand({
      TableName: env.tableName,
      Item: { ...key(profile.userId), ...profile },
    }),
  );
}

/**
 * Profile with Slack-synced timezone; refreshed lazily. Falls back to a
 * stale profile (or undefined) if Slack is unreachable.
 */
export async function ensureUserProfile(userId: string): Promise<UserProfile | undefined> {
  const existing = await getUserProfile(userId);
  if (existing && Date.now() - Date.parse(existing.updatedAt) < PROFILE_TTL_MS) {
    return existing;
  }
  try {
    const user = await slack.userInfo(userId);
    const profile: UserProfile = {
      userId,
      tz: user.tz ?? existing?.tz ?? "UTC",
      name: user.real_name ?? existing?.name,
      // Preserve fields Slack doesn't know about — otherwise this refresh
      // (every 20h) silently wipes them.
      preferredTime: existing?.preferredTime,
      outOfOffice: existing?.outOfOffice,
      updatedAt: new Date().toISOString(),
    };
    await putUserProfile(profile);
    return profile;
  } catch (error) {
    console.error(`users.info failed for ${userId}:`, error);
    return existing;
  }
}

export async function setPreferredTime(
  userId: string,
  time: string | undefined,
): Promise<void> {
  await db.send(
    new UpdateCommand({
      TableName: env.tableName,
      Key: key(userId),
      UpdateExpression: time ? "SET preferredTime = :t" : "REMOVE preferredTime",
      ExpressionAttributeValues: time ? { ":t": time } : undefined,
    }),
  );
}

export async function setOutOfOffice(
  userId: string,
  range: OutOfOfficeRange | undefined,
): Promise<void> {
  await db.send(
    new UpdateCommand({
      TableName: env.tableName,
      Key: key(userId),
      UpdateExpression: range ? "SET outOfOffice = :r" : "REMOVE outOfOffice",
      ExpressionAttributeValues: range ? { ":r": range } : undefined,
    }),
  );
}
