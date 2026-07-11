import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import type { Report, StandupDay } from "@/lib/types";

/**
 * DAY + REPORT items (PLAN.md §2.2). All state transitions use conditional
 * writes so the 15-minute tick stays idempotent under retries.
 */

const dayKey = (standupId: string, date: string) => ({
  pk: `STANDUP#${standupId}`,
  sk: `DAY#${date}`,
});

const reportKey = (standupId: string, date: string, userId: string) => ({
  pk: `STANDUP#${standupId}`,
  sk: `REPORT#${date}#${userId}`,
});

function isConditionalFailure(error: unknown): boolean {
  return (error as { name?: string })?.name === "ConditionalCheckFailedException";
}

// --- Days ---

export async function getDay(
  standupId: string,
  date: string,
): Promise<StandupDay | undefined> {
  const res = await db.send(
    new GetCommand({ TableName: env.tableName, Key: dayKey(standupId, date) }),
  );
  return res.Item as StandupDay | undefined;
}

/** Create the day if absent; returns the current day either way. */
export async function createDayIfAbsent(day: StandupDay): Promise<StandupDay> {
  try {
    await db.send(
      new PutCommand({
        TableName: env.tableName,
        Item: { ...dayKey(day.standupId, day.date), ...day },
        ConditionExpression: "attribute_not_exists(pk)",
      }),
    );
    return day;
  } catch (error) {
    if (!isConditionalFailure(error)) throw error;
    return (await getDay(day.standupId, day.date))!;
  }
}

/**
 * Atomically record the anchor thread ts. Returns true only if THIS call set
 * it — i.e. it won the race. A concurrent caller (an admin "Start now"
 * overlapping the scheduled tick) gets false and must clean up its own
 * duplicate anchor rather than leave two in the channel.
 */
export async function claimDayThread(
  standupId: string,
  date: string,
  threadTs: string,
): Promise<boolean> {
  try {
    await db.send(
      new UpdateCommand({
        TableName: env.tableName,
        Key: dayKey(standupId, date),
        UpdateExpression: "SET threadTs = :ts",
        ConditionExpression: "attribute_not_exists(threadTs)",
        ExpressionAttributeValues: { ":ts": threadTs },
      }),
    );
    return true;
  } catch (error) {
    if (isConditionalFailure(error)) return false;
    throw error;
  }
}

/** Open days for a standup — used to resolve removed participants' pending reports. */
export async function listOpenDays(standupId: string): Promise<StandupDay[]> {
  const res = await db.send(
    new QueryCommand({
      TableName: env.tableName,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      FilterExpression: "#status = :open",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":pk": `STANDUP#${standupId}`,
        ":prefix": "DAY#",
        ":open": "open",
      },
    }),
  );
  return (res.Items ?? []) as StandupDay[];
}

export async function closeDay(standupId: string, date: string): Promise<void> {
  await db.send(
    new UpdateCommand({
      TableName: env.tableName,
      Key: dayKey(standupId, date),
      UpdateExpression: "SET #status = :closed",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":closed": "closed" },
    }),
  );
}

// --- Reports ---

export async function getReport(
  standupId: string,
  date: string,
  userId: string,
): Promise<Report | undefined> {
  const res = await db.send(
    new GetCommand({
      TableName: env.tableName,
      Key: reportKey(standupId, date, userId),
    }),
  );
  return res.Item as Report | undefined;
}

/** Returns true if this call created the report (caller then sends the DM). */
export async function createReportIfAbsent(report: Report): Promise<boolean> {
  try {
    await db.send(
      new PutCommand({
        TableName: env.tableName,
        Item: { ...reportKey(report.standupId, report.date, report.userId), ...report },
        ConditionExpression: "attribute_not_exists(pk)",
      }),
    );
    return true;
  } catch (error) {
    if (isConditionalFailure(error)) return false;
    throw error;
  }
}

export async function setReportDm(
  standupId: string,
  date: string,
  userId: string,
  dm: { channel: string; ts: string },
): Promise<void> {
  await db.send(
    new UpdateCommand({
      TableName: env.tableName,
      Key: reportKey(standupId, date, userId),
      UpdateExpression: "SET dmChannel = :c, dmTs = :t",
      ExpressionAttributeValues: { ":c": dm.channel, ":t": dm.ts },
    }),
  );
}

/**
 * pending → skipped/missed. Returns false if the report had already left
 * pending (e.g. user submitted moments before the cutoff tick).
 */
export async function markReportIfPending(
  standupId: string,
  date: string,
  userId: string,
  status: "skipped" | "missed",
): Promise<boolean> {
  try {
    await db.send(
      new UpdateCommand({
        TableName: env.tableName,
        Key: reportKey(standupId, date, userId),
        UpdateExpression: "SET #status = :status",
        ConditionExpression: "#status = :pending",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":status": status, ":pending": "pending" },
      }),
    );
    return true;
  } catch (error) {
    if (isConditionalFailure(error)) return false;
    throw error;
  }
}

/** Any state → submitted (late submissions after missed/skipped are welcome). */
export async function saveSubmission(
  standupId: string,
  date: string,
  userId: string,
  answers: string[],
  replyTs?: string,
): Promise<void> {
  await db.send(
    new UpdateCommand({
      TableName: env.tableName,
      Key: reportKey(standupId, date, userId),
      UpdateExpression:
        "SET #status = :submitted, answers = :answers, submittedAt = :at" +
        (replyTs ? ", replyTs = :replyTs" : ""),
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":submitted": "submitted",
        ":answers": answers,
        ":at": new Date().toISOString(),
        ...(replyTs ? { ":replyTs": replyTs } : {}),
      },
    }),
  );
}

export async function incrementReminders(
  standupId: string,
  date: string,
  userId: string,
): Promise<void> {
  await db.send(
    new UpdateCommand({
      TableName: env.tableName,
      Key: reportKey(standupId, date, userId),
      UpdateExpression: "ADD remindersSent :one",
      ExpressionAttributeValues: { ":one": 1 },
    }),
  );
}

export async function listReports(
  standupId: string,
  date: string,
): Promise<Report[]> {
  const res = await db.send(
    new QueryCommand({
      TableName: env.tableName,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: {
        ":pk": `STANDUP#${standupId}`,
        ":prefix": `REPORT#${date}#`,
      },
    }),
  );
  return (res.Items ?? []) as Report[];
}
