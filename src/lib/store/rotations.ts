import { DeleteCommand, GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import type { RotationConfig } from "@/lib/types";

const key = (id: string) => ({ pk: `ROTA#${id}`, sk: "CONFIG" });

export async function putRotation(config: RotationConfig): Promise<void> {
  await db.send(
    new PutCommand({
      TableName: env.tableName,
      Item: { ...key(config.id), ...config },
    }),
  );
}

export async function getRotation(id: string): Promise<RotationConfig | undefined> {
  const res = await db.send(
    new GetCommand({ TableName: env.tableName, Key: key(id) }),
  );
  return res.Item as RotationConfig | undefined;
}

/**
 * Scan is fine here: a handful of CONFIG items in a tiny table, read once
 * per tick / dashboard view. pk prefix filter matters — STANDUP#…/CONFIG
 * items share the same sk.
 */
export async function listRotations(): Promise<RotationConfig[]> {
  const res = await db.send(
    new ScanCommand({
      TableName: env.tableName,
      FilterExpression: "sk = :config AND begins_with(pk, :prefix)",
      ExpressionAttributeValues: { ":config": "CONFIG", ":prefix": "ROTA#" },
    }),
  );
  return (res.Items ?? []) as RotationConfig[];
}

/** Removes the config only; SHIFT/OVERRIDE history stays queryable. */
export async function deleteRotation(id: string): Promise<void> {
  await db.send(new DeleteCommand({ TableName: env.tableName, Key: key(id) }));
}
