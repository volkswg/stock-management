import { LineEvent, LineWebhookPayload } from "@/externals/line";
import { isRecord } from "@/features/backend/shared/utils";

export const isLineEvent = (value: unknown): value is LineEvent => {
  return isRecord(value) && typeof value.type === "string";
};

export const parseLineWebhookPayload = (
  rawBody: Buffer,
): LineWebhookPayload => {
  const payload = JSON.parse(rawBody.toString("utf8")) as unknown;

  if (!isRecord(payload)) {
    return {};
  }

  return {
    events: Array.isArray(payload.events)
      ? payload.events.filter(isLineEvent)
      : undefined,
  };
};
