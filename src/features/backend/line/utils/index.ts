import { LineMessageType, type LineEvent, type LineWebhookPayload } from "@/externals/line";
import type { IGoogleSheetsService } from "@/externals/google/sheet";
import { readMovementSession } from "@/services/movements/state";
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

const MOVEMENT_START_COMMANDS = [
  "create:movement",
  "create:new-movement",
  "resume:movement",
];

export type MovementEventClassification = {
  kind: "movement";
  event: LineEvent & {
    message: NonNullable<LineEvent["message"]>;
    source: NonNullable<LineEvent["source"]> & { userId: string };
  };
  session: Awaited<ReturnType<typeof readMovementSession>>;
};

export type LineEventClassification =
  | MovementEventClassification
  | { kind: "order" };

export function isMovementStartCommand(command: string): boolean {
  return MOVEMENT_START_COMMANDS.includes(command);
}

export async function classifyLineEvent({
  event,
  getGoogleSheetsService,
}: {
  event: LineEvent;
  getGoogleSheetsService: () => IGoogleSheetsService;
}): Promise<LineEventClassification> {
  const message = event.message;
  const userId = event.source?.userId;
  if (
    event.type !== "message" ||
    !message ||
    !userId ||
    (message.type !== LineMessageType.Text && message.type !== LineMessageType.Image)
  ) {
    return { kind: "order" };
  }

  const session = await readMovementSession(
    getGoogleSheetsService(),
    userId,
    event.webhookEventId || message.id,
  );
  const command = message.text?.trim().toLowerCase() || "";

  // Check retries before completed state so they still reach movement recovery.
  if (
    (session.state && session.processed) ||
    isMovementStartCommand(command) ||
    (session.state && session.state.step !== "complete")
  ) {
    return {
      kind: "movement",
      event: { ...event, message, source: { ...event.source, userId } },
      session,
    };
  }

  // The existing order handler also provides general guidance for other events.
  return { kind: "order" };
}
