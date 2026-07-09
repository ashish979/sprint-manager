import { NextResponse } from "next/server";

import { getTeamSettings } from "@/lib/db";
import { assignNextInQueue } from "@/lib/rotation/engine";
import { shiftAnnounceMessage } from "@/lib/slack/blocks";
import { slack } from "@/lib/slack/client";
import { readVerifiedSlackRequest } from "@/lib/slack/request";
import {
  openAnswerModal,
  skipToday,
  submitFromView,
} from "@/lib/standup/engine";

/**
 * Slack interactivity endpoint: button clicks and modal submissions.
 * Must ack within 3 seconds or Slack shows an error to the user.
 */
export async function POST(req: Request) {
  const verified = await readVerifiedSlackRequest(req);
  if (!verified.ok) return verified.response;

  const raw = new URLSearchParams(verified.body).get("payload");
  if (!raw) {
    return NextResponse.json({ error: "missing payload" }, { status: 400 });
  }
  const payload = JSON.parse(raw);

  try {
    switch (payload.type) {
      case "block_actions": {
        const action = payload.actions?.[0];
        const meta = action?.value ? JSON.parse(action.value) : undefined;

        if (action?.action_id === "standup:answer" && meta) {
          await openAnswerModal(payload.trigger_id, {
            ...meta,
            dmChannel: payload.channel?.id,
            dmTs: payload.message?.ts,
          });
        } else if (action?.action_id === "standup:skip" && meta) {
          await skipToday({
            ...meta,
            userId: payload.user.id,
            responseUrl: payload.response_url,
          });
        } else if (action?.action_id === "rotation:assign_next" && meta) {
          const settings = await getTeamSettings();
          if (!settings.adminSlackIds.includes(payload.user.id)) {
            await slack.respond(payload.response_url, {
              text: "Only admins can manage rotations.",
            });
          } else {
            const result = await assignNextInQueue(meta.rotationId, meta.date);
            if (!result) {
              await slack.respond(payload.response_url, {
                text: "This shift is no longer current — can't reassign it now.",
              });
            } else {
              await slack.updateMessage({
                channel: payload.channel.id,
                ts: payload.message.ts,
                ...shiftAnnounceMessage(result.rotation, result.assignee, meta.date),
              });
            }
          }
        }
        break;
      }
      case "view_submission": {
        if (payload.view?.callback_id === "standup:submit") {
          await submitFromView(payload);
        }
        break;
      }
    }
  } catch (error) {
    console.error("interactivity handler failed:", error);
    // Still ack — Slack retries otherwise, and the user sees a scary error.
  }

  return new NextResponse(null, { status: 200 });
}
