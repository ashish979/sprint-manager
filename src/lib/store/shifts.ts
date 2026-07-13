import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import type { Shift } from "@/lib/types";

/**
 * SHIFT items (PLAN.md §2.2). Creation is a conditional write so the
 * 15-minute tick stays idempotent under retries — mirrors REPORT in
 * src/lib/store/reports.ts.
 */

const shiftKey = (rotationId: string, startDate: string) => ({
  pk: `ROTA#${rotationId}`,
  sk: `SHIFT#${startDate}`,
});

function isConditionalFailure(error: unknown): boolean {
  return (error as { name?: string })?.name === "ConditionalCheckFailedException";
}

export async function getShift(
  rotationId: string,
  startDate: string,
): Promise<Shift | undefined> {
  const res = await db.send(
    new GetCommand({ TableName: env.tableName, Key: shiftKey(rotationId, startDate) }),
  );
  return res.Item as Shift | undefined;
}

/** Returns true if this call created the shift (caller then advances the rotation). */
export async function createShiftIfAbsent(shift: Shift): Promise<boolean> {
  try {
    await db.send(
      new PutCommand({
        TableName: env.tableName,
        Item: { ...shiftKey(shift.rotationId, shift.startDate), ...shift },
        ConditionExpression: "attribute_not_exists(pk)",
      }),
    );
    return true;
  } catch (error) {
    if (isConditionalFailure(error)) return false;
    throw error;
  }
}

/** Overwrite a shift (used when reassigning today's on-duty person from Slack). */
export async function putShift(shift: Shift): Promise<void> {
  await db.send(
    new PutCommand({
      TableName: env.tableName,
      Item: { ...shiftKey(shift.rotationId, shift.startDate), ...shift },
    }),
  );
}

/** Most recent shift by startDate, or undefined if the rotation has never fired. */
export async function getLatestShift(rotationId: string): Promise<Shift | undefined> {
  const res = await db.send(
    new QueryCommand({
      TableName: env.tableName,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: { ":pk": `ROTA#${rotationId}`, ":prefix": "SHIFT#" },
      ScanIndexForward: false,
      Limit: 1,
    }),
  );
  return res.Items?.[0] as Shift | undefined;
}

/** Shift history, most recent first. */
export async function listShifts(rotationId: string): Promise<Shift[]> {
  const res = await db.send(
    new QueryCommand({
      TableName: env.tableName,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: { ":pk": `ROTA#${rotationId}`, ":prefix": "SHIFT#" },
      ScanIndexForward: false,
    }),
  );
  return (res.Items ?? []) as Shift[];
}
