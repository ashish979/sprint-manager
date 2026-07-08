import { DeleteCommand, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import type { ShiftOverride } from "@/lib/types";

/**
 * OVERRIDE items (PLAN.md §1.2/§2.4) — queued from the dashboard, consumed
 * by the tick when it creates the SHIFT for that date.
 */

const key = (rotationId: string, date: string) => ({
  pk: `ROTA#${rotationId}`,
  sk: `OVERRIDE#${date}`,
});

export async function putOverride(override: ShiftOverride): Promise<void> {
  await db.send(
    new PutCommand({
      TableName: env.tableName,
      Item: { ...key(override.rotationId, override.date), ...override },
    }),
  );
}

export async function getOverride(
  rotationId: string,
  date: string,
): Promise<ShiftOverride | undefined> {
  const res = await db.send(
    new GetCommand({ TableName: env.tableName, Key: key(rotationId, date) }),
  );
  return res.Item as ShiftOverride | undefined;
}

export async function deleteOverride(rotationId: string, date: string): Promise<void> {
  await db.send(new DeleteCommand({ TableName: env.tableName, Key: key(rotationId, date) }));
}
