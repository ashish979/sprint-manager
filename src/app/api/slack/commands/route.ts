import { NextResponse } from "next/server";

import { getTeamSettings } from "@/lib/db";
import { readVerifiedSlackRequest } from "@/lib/slack/request";
import { getReport } from "@/lib/store/reports";
import { listRotations } from "@/lib/store/rotations";
import { getLatestShift, getShift } from "@/lib/store/shifts";
import { listStandups } from "@/lib/store/standups";
import { sendManualReminder } from "@/lib/standup/engine";
import { getUserProfile } from "@/lib/store/users";
import { friendlyDate, localParts, todayIst } from "@/lib/tz";
import type { StandupConfig } from "@/lib/types";

function ephemeral(text: string) {
  return NextResponse.json({ response_type: "ephemeral", text });
}

async function findStandupByName(name: string): Promise<StandupConfig | undefined> {
  return (await listStandups()).find((s) => s.name.toLowerCase() === name.toLowerCase());
}

/** `/standup remind <name>` — nudges everyone still pending today, admin-only. */
async function handleRemind(name: string, requesterId: string | null) {
  if (!name) return ephemeral("Usage: `/standup remind <standup-name>`");

  const settings = await getTeamSettings();
  if (!requesterId || !settings.adminSlackIds.includes(requesterId)) {
    return ephemeral("Only admins can send reminders.");
  }

  const standup = await findStandupByName(name);
  if (!standup) return ephemeral(`No standup named "${name}".`);

  let reminded = 0;
  for (const participantId of standup.participants) {
    const profile = await getUserProfile(participantId);
    const date = localParts(new Date(), profile?.tz ?? "Asia/Kolkata").date;
    const report = await getReport(standup.id, date, participantId);
    if (report?.status !== "pending") continue;
    try {
      await sendManualReminder(standup.id, date, participantId);
      reminded++;
    } catch (error) {
      console.error(`remind failed for ${standup.id}/${participantId}:`, error);
    }
  }

  return ephemeral(
    reminded > 0
      ? `⏰ Reminded ${reminded} pending participant${reminded === 1 ? "" : "s"} for *${standup.name}*.`
      : `Everyone's already responded (or not yet prompted) for *${standup.name}* today.`,
  );
}

/** `/standup` — root command; subcommands added here don't need new Slack app config. */
async function handleStandupCommand(text: string, requesterId: string | null) {
  const [sub, ...rest] = text.split(/\s+/).filter(Boolean);
  const arg = rest.join(" ");

  if (sub === "remind") return handleRemind(arg, requesterId);

  return ephemeral("Usage: `/standup remind <standup-name>`");
}

/** `/rota` — see PLAN.md §1.2. */
async function handleRotaCommand(text: string) {
  const [sub, ...rest] = text.split(/\s+/).filter(Boolean);
  const name = rest.join(" ");
  if (sub !== "who" || !name) {
    return ephemeral("Usage: `/rota who <rotation-name>`");
  }

  const rotation = (await listRotations()).find(
    (r) => r.name.toLowerCase() === name.toLowerCase(),
  );
  if (!rotation) return ephemeral(`No rotation named "${name}".`);

  const shift = (await getShift(rotation.id, todayIst())) ?? (await getLatestShift(rotation.id));
  if (!shift) return ephemeral(`*${rotation.name}* hasn't rotated yet.`);

  const next = rotation.members[rotation.cursor % rotation.members.length];
  return ephemeral(
    `*${rotation.name}*: <@${shift.assignee}> is on duty (since ${friendlyDate(
      shift.startDate,
    )}). Next up: <@${next}>.`,
  );
}

export async function POST(req: Request) {
  const verified = await readVerifiedSlackRequest(req);
  if (!verified.ok) return verified.response;

  const params = new URLSearchParams(verified.body);
  const command = params.get("command");
  const text = params.get("text")?.trim() ?? "";

  if (command === "/standup") return handleStandupCommand(text, params.get("user_id"));
  if (command === "/rota") return handleRotaCommand(text);

  return ephemeral(`Unknown command: ${command ?? "(none)"}`);
}
