import type { LineEvent, LineWebhookPayload } from "@/shared/types/line-protocol";
import { isRecord } from "@/shared/lib/is-record";
export const isLineEvent = (value: unknown): value is LineEvent => {
    return isRecord(value) && typeof value.type === "string";
};
export function projectLineWebhookPayload(payload: unknown): LineWebhookPayload {
    if (!isRecord(payload))
        return {};
    return { events: Array.isArray(payload.events) ? payload.events.filter(isLineEvent) : undefined };
}
