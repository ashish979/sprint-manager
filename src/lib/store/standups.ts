import { DeleteCommand, GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import type { StandupConfig } from "@/lib/types";

const key = (id: string) => ({ pk: `STANDUP#${id}`, sk: "CONFIG" });

export async function putStandup(config: StandupConfig): Promise<void> {
  await db.send(
    new PutCommand({
      TableName: env.tableName,
      Item: { ...key(config.id), ...config },
    }),
  );
}

export async function getStandup(id: string): Promise<StandupConfig | undefined> {
  const res = await db.send(
    new GetCommand({ TableName: env.tableName, Key: key(id) }),
  );
  return res.Item as StandupConfig | undefined;
}

/**
 * Scan is fine here: a handful of CONFIG items in a tiny table, read once
 * per tick / dashboard view.
 */
export async function listStandups(): Promise<StandupConfig[]> {
  const res = await db.send(
    new ScanCommand({
      TableName: env.tableName,
      FilterExpression: "sk = :config",
      ExpressionAttributeValues: { ":config": "CONFIG" },
    }),
  );
  return (res.Items ?? []) as StandupConfig[];
}

/** Removes the config only; DAY/REPORT history stays queryable. */
export async function deleteStandup(id: string): Promise<void> {
  await db.send(new DeleteCommand({ TableName: env.tableName, Key: key(id) }));
}
