import { LineMessageType, type LineEvent } from "@/shared/types/line-protocol";
import { MovementStartCommandEnum, EventKindEnum, type LineEventClassification } from "../contracts";
import type { WorkflowContext } from "./ports/workflows";
import { readMovementSession } from "./sessions";
export function isMovementStartCommand(command: string): command is MovementStartCommandEnum {
    return Object.values(MovementStartCommandEnum).some((value) => value === command);
}
export async function classifyLineEvent({ event, getContext, }: {
    event: LineEvent;
    getContext: () => WorkflowContext;
}): Promise<LineEventClassification> {
    // Only our destination postback is adapted to the existing text journey.
    // The original provider event is still the durable command intent.
    const selection = event.type === "postback" && typeof event.postback?.data === "string"
        && (event.postback.data.startsWith("movement:shop:") || event.postback.data.startsWith("movement:shops:")) && event.postback.data.length <= 300
        && event.webhookEventId;
    const message = selection
        ? { type: LineMessageType.Text, id: event.webhookEventId!, text: event.postback!.data }
        : event.message;
    const userId = event.source?.userId;
    if ((!selection && event.type !== "message") ||
        !message ||
        !userId ||
        (message.type !== LineMessageType.Text && message.type !== LineMessageType.Image)) {
        return { kind: EventKindEnum.Order };
    }
    const context = getContext();
    const photoContext = message.type === LineMessageType.Image ? await context.photoContext() : undefined;
    const session = await readMovementSession(context.movements, userId, event.webhookEventId || message.id, photoContext?.sessions);
    const command = message.text?.trim().toLowerCase() || "";
    // Check retries before completed state so they still reach movement recovery.
    if ((session.state && session.processed) ||
        isMovementStartCommand(command) ||
        (session.state && session.state.step !== "complete")) {
        return {
            kind: EventKindEnum.Movement,
            event: { ...event, message, source: { ...event.source, userId } },
            session: {
                ...session,
                photoItems: photoContext?.items(() => session.state?.masterId),
            },
        };
    }
    // The existing order handler also provides general guidance for other events.
    return { kind: EventKindEnum.Order };
}
