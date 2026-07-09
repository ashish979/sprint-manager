import { DeleteCommand, GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import type { QuestionConfig, StandupConfig } from "@/lib/types";

const key = (id: string) => ({ pk: `STANDUP#${id}`, sk: "CONFIG" });

/** Standups created before per-question `required` existed stored plain strings. */
function normalizeQuestions(raw: unknown): QuestionConfig[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((q) => (typeof q === "string" ? { text: q, required: true } : (q as QuestionConfig)));
}

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
  if (!res.Item) return undefined;
  const item = res.Item as StandupConfig;
  return { ...item, questions: normalizeQuestions(item.questions) };
}

/**
 * Scan is fine here: a handful of CONFIG items in a tiny table, read once
 * per tick / dashboard view. pk prefix filter matters — ROTA#…/CONFIG items
 * share the same sk.
 */
export async function listStandups(): Promise<StandupConfig[]> {
  const res = await db.send(
    new ScanCommand({
      TableName: env.tableName,
      FilterExpression: "sk = :config AND begins_with(pk, :prefix)",
      ExpressionAttributeValues: { ":config": "CONFIG", ":prefix": "STANDUP#" },
    }),
  );
  return ((res.Items ?? []) as StandupConfig[]).map((item) => ({
    ...item,
    questions: normalizeQuestions(item.questions),
  }));
}

/** Removes the config only; DAY/REPORT history stays queryable. */
export async function deleteStandup(id: string): Promise<void> {
  await db.send(new DeleteCommand({ TableName: env.tableName, Key: key(id) }));
}
