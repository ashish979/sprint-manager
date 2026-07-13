import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

import { env } from "@/lib/env";

/** Shared DocumentClient — one per Lambda container. */
export const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

export interface TeamSettings {
  /** Slack user ids that can manage everything and grant roles (PLAN.md §6). */
  adminSlackIds: string[];
  /**
   * Slack user ids with write access: they can create standups/rotations and
   * manage the ones they created. Admins implicitly have this too.
   */
  editorSlackIds: string[];
}

/**
 * TEAM#SETTINGS item (PLAN.md §2.2). Absent until first configured —
 * treat that as "no admins/editors yet".
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
    editorSlackIds: result.Item?.editorSlackIds ?? [],
  };
}

/** Overwrites the role allowlists (admins-only action). */
export async function putTeamSettings(settings: TeamSettings): Promise<void> {
  await db.send(
    new PutCommand({
      TableName: env.tableName,
      Item: { pk: "TEAM", sk: "SETTINGS", ...settings },
    }),
  );
}
