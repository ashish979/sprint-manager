import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

import { env } from "@/lib/env";

/** Shared DocumentClient — one per Lambda container. */
export const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

export interface TeamSettings {
  /** Slack user ids allowed to manage standups/rotations (PLAN.md §6). */
  adminSlackIds: string[];
}

/**
 * TEAM#SETTINGS item (PLAN.md §2.2). Absent until first configured —
 * treat that as "no admins yet".
 */
export async function getTeamSettings(): Promise<TeamSettings> {
  const result = await db.send(
    new GetCommand({
      TableName: env.tableName,
      Key: { pk: "TEAM", sk: "SETTINGS" },
    }),
  );
  return {
    adminSlackIds: result.Item?.adminSlackIds ?? [],
  };
}
