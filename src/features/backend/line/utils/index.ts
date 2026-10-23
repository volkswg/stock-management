import { LineMessageType, type LineEvent, type LineWebhookPayload } from "@/externals/line";
import type { IGoogleSheetsService } from "@/externals/google/sheet";
import { readMovementSession } from "@/services/movements/state";
import { isRecord } from "@/features/backend/shared/utils";
import { MovementStartCommandEnum, EventKindEnum } from "@/features/backend/line/enum";

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

export type MovementEventClassification = {
  kind: EventKindEnum.Movement;
  event: LineEvent & {
    message: NonNullable<LineEvent["message"]>;
    source: NonNullable<LineEvent["source"]> & { userId: string };
  };
  session: Awaited<ReturnType<typeof readMovementSession>>;
};

export type LineEventClassification =
  | MovementEventClassification
  | { kind: EventKindEnum.Order };

export function isMovementStartCommand(command: string): command is MovementStartCommandEnum {
  return Object.values(MovementStartCommandEnum).some((value) => value === command);
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
    return { kind: EventKindEnum.Order };
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
      kind: EventKindEnum.Movement,
      event: { ...event, message, source: { ...event.source, userId } },
      session,
    };
  }

  // The existing order handler also provides general guidance for other events.
  return { kind: EventKindEnum.Order };
}
