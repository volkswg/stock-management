import { LineMessageType, type LineEvent } from "@/shared/types/line-protocol";
import type { UserState, MovementImageUploadProgress, MovementCreateMode } from "../contracts";
import type { WorkflowContext, WorkflowImages, WorkflowLine, WorkflowRuntime } from "./ports/workflows";
import { classifyLineEvent } from "./classify-event";
import { handleMovementEvent } from "./movement-events";
import { handleLineEvent } from "./order-events";
export async function processWebhookEvents<Bytes>({ events, lineBotService, getContext, getImages, getCreateMode, getPublicBaseUrl, runtime }: {
    events: LineEvent[] | undefined;
    lineBotService: WorkflowLine<Bytes>;
    getContext: () => WorkflowContext;
    getImages: () => WorkflowImages<Bytes> | undefined;
    getCreateMode: () => MovementCreateMode;
    getPublicBaseUrl: () => string;
    runtime: WorkflowRuntime;
}) {
    runtime.received(() => ({ eventCount: events?.length || 0 }));
    const resolvedUserStates = new Map<LineEvent, UserState>();
    let movementFailed = false;
    const imageUploads: MovementImageUploadProgress[] = [];
    const receivedImages = (events || []).filter((event) => event.message?.type === LineMessageType.Image).length;
    let attemptedImages = 0;
    let otherFlowImages = 0;
    let failedBeforeRouting = 0;
    const imageCounts = () => ({
        scope: "movement",
        received: receivedImages,
        routedToMovement: imageUploads.length,
        otherFlows: otherFlowImages,
        unprocessed: receivedImages - attemptedImages,
        failedBeforeRouting,
        uploaded: imageUploads.filter((image) => image.uploaded).length,
        saved: imageUploads.filter((image) => image.saved).length,
        alreadySaved: imageUploads.filter((image) => image.alreadySaved).length,
        completed: imageUploads.filter((image) => image.completed).length,
        failed: imageUploads.filter((image) => image.failed).length + failedBeforeRouting,
        ignored: imageUploads.filter((image) => image.ignored).length,
        saveUncertain: imageUploads.filter((image) => image.saveUncertain).length,
    });
    for (const event of events || []) {
        let imageUpload: MovementImageUploadProgress | undefined;
        if (event.message?.type === LineMessageType.Image)
            attemptedImages++;
        // Route and handle sequentially: earlier events may advance a Sheets checkpoint.
        try {
            const classification = await classifyLineEvent({
                event,
                getContext,
            });
            if (classification.kind === "movement") {
                if (classification.event.message.type === LineMessageType.Image) {
                    imageUpload = {
                        messageId: classification.event.message.id, uploaded: false, saved: false,
                        alreadySaved: false, completed: false, failed: false, ignored: false, saveUncertain: false,
                    };
                    imageUploads.push(imageUpload);
                }
                await handleMovementEvent({
                    event: classification.event,
                    session: classification.session,
                    context: getContext(),
                    drive: getImages,
                    line: lineBotService,
                    createMode: getCreateMode(),
                    imageUpload,
                    publicBaseUrl: getPublicBaseUrl(),
                    runtime,
                });
                continue;
            }
            if (event.message?.type === LineMessageType.Image)
                otherFlowImages++;
        }
        catch (error) {
            if (imageUpload)
                imageUpload.failed = true;
            else if (event.message?.type === LineMessageType.Image)
                failedBeforeRouting++;
            runtime.error("Failed to process movement event", () => ({
                webhookEventId: event.webhookEventId,
                error: error instanceof Error ? error.message : String(error),
            }));
            movementFailed = true;
            // Stop the batch so later events cannot advance a failed movement.
            break;
        }
        try {
            await handleLineEvent({
                event,
                lineBotService,
                getContext,
                getImages,
                resolvedUserStates,
                runtime,
            });
        }
        catch (error) {
            runtime.error("Failed to process LINE event", () => ({
                webhookEventId: event.webhookEventId,
                error: error instanceof Error ? error.message : String(error),
            }));
        }
    }
    return { movementFailed, imageCounts, imageUploads };
}
