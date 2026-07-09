import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { slack } from "@/lib/slack/client";
import type { ChannelInfo } from "@/lib/types";

const key = (channelId: string) => ({ pk: `CHANNEL#${channelId}`, sk: "INFO" });

/** Re-fetch a channel's name from Slack when older than this. */
const CHANNEL_TTL_MS = 20 * 60 * 60 * 1000;

export async function getChannelInfo(channelId: string): Promise<ChannelInfo | undefined> {
  const res = await db.send(new GetCommand({ TableName: env.tableName, Key: key(channelId) }));
  return res.Item as ChannelInfo | undefined;
}

async function putChannelInfo(info: ChannelInfo): Promise<void> {
  await db.send(
    new PutCommand({ TableName: env.tableName, Item: { ...key(info.channelId), ...info } }),
  );
}

/**
 * Channel name with Slack-synced caching; refreshed lazily. Falls back to a
 * stale name (or undefined) if Slack is unreachable or the bot can't see
 * the channel (e.g. a private channel it hasn't been invited to).
 */
export async function ensureChannelInfo(channelId: string): Promise<ChannelInfo | undefined> {
  const existing = await getChannelInfo(channelId);
  if (existing && Date.now() - Date.parse(existing.updatedAt) < CHANNEL_TTL_MS) {
    return existing;
  }
  try {
    const channel = await slack.channelInfo(channelId);
    if (!channel.name) return existing;
    const info: ChannelInfo = {
      channelId,
      name: channel.name,
      updatedAt: new Date().toISOString(),
    };
    await putChannelInfo(info);
    return info;
  } catch (error) {
    console.error(`conversations.info failed for ${channelId}:`, error);
    return existing;
  }
}
