import { NextResponse } from "next/server";

import { readVerifiedSlackRequest } from "@/lib/slack/request";
import { listRotations } from "@/lib/store/rotations";
import { getLatestShift, getShift } from "@/lib/store/shifts";
import { friendlyDate } from "@/lib/tz";

function ephemeral(text: string) {
  return NextResponse.json({ response_type: "ephemeral", text });
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Slash command endpoint (`/rota`, PLAN.md §1.2). */
export async function POST(req: Request) {
  const verified = await readVerifiedSlackRequest(req);
  if (!verified.ok) return verified.response;

  const params = new URLSearchParams(verified.body);
  const command = params.get("command");
  const text = params.get("text")?.trim() ?? "";

  if (command === "/rota") {
    const [sub, ...rest] = text.split(/\s+/).filter(Boolean);
    const name = rest.join(" ");
    if (sub !== "who" || !name) {
      return ephemeral("Usage: `/rota who <rotation-name>`");
    }

    const rotation = (await listRotations()).find(
      (r) => r.name.toLowerCase() === name.toLowerCase(),
    );
    if (!rotation) return ephemeral(`No rotation named "${name}".`);

    const shift = (await getShift(rotation.id, todayUtc())) ?? (await getLatestShift(rotation.id));
    if (!shift) return ephemeral(`*${rotation.name}* hasn't rotated yet.`);

    const next = rotation.members[rotation.cursor % rotation.members.length];
    return ephemeral(
      `*${rotation.name}*: <@${shift.assignee}> is on duty (since ${friendlyDate(
        shift.startDate,
      )}). Next up: <@${next}>.`,
    );
  }

  return ephemeral(`Unknown command: ${command ?? "(none)"}`);
}
