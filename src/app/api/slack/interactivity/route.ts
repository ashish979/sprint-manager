import { NextResponse } from "next/server";

import {
  handleRotationQuickAction,
  openManageQueueModal,
  submitManageQueue,
} from "@/lib/rotation/engine";
import { readVerifiedSlackRequest } from "@/lib/slack/request";
import { openAnswerModal, skipToday, submitFromView } from "@/lib/standup/engine";

/**
 * Slack interactivity endpoint: button clicks, menu selections and modal
 * submissions. Must ack within 3 seconds or Slack shows an error to the user.
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
        const id = action?.action_id;

        if (id === "standup:answer" && action.value) {
          await openAnswerModal(payload.trigger_id, {
            ...JSON.parse(action.value),
            dmChannel: payload.channel?.id,
            dmTs: payload.message?.ts,
          });
        } else if (id === "standup:skip" && action.value) {
          await skipToday({
            ...JSON.parse(action.value),
            userId: payload.user.id,
            responseUrl: payload.response_url,
          });
        } else if (id === "rotation:manage" && action.value) {
          const { rotationId } = JSON.parse(action.value);
          await openManageQueueModal(payload.trigger_id, rotationId);
        } else if (id === "rotation:quick" && action.selected_option) {
          const { rotationId, op } = JSON.parse(action.selected_option.value);
          await handleRotationQuickAction({
            rotationId,
            op,
            userId: payload.user.id,
            responseUrl: payload.response_url,
          });
        }
        break;
      }
      case "view_submission": {
        if (payload.view?.callback_id === "standup:submit") {
          await submitFromView(payload);
        } else if (payload.view?.callback_id === "rotation:manage:submit") {
          const result = await submitManageQueue(payload);
          if (result?.errors) {
            return NextResponse.json({ response_action: "errors", errors: result.errors });
          }
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
