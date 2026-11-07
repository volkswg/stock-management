import { createMessageQuickReply, createTextReplyMessage } from "@/shared/lib/line-messages";
import { type LineEvent } from "@/shared/types/line-protocol";
import { OrderStatus } from "@/modules/orders/contracts";
import { type UserState } from "../../contracts";
import { type WorkflowContext, type WorkflowLine, type WorkflowImages, type WorkflowRuntime } from "../ports/workflows";
const GOOGLE_DRIVE_NOT_CONFIGURED_REPLY_TEXT = [
    "⚠️ Cannot upload bill image",
    "Google Drive is not configured.",
].join("\n");
const BILL_IMAGE_UPLOAD_FAILED_REPLY_TEXT = [
    "❌ Bill image upload failed",
    "",
    "Please try sending the image again.",
    "Your order is still waiting for a bill image.",
].join("\n");
const BILL_RECORD_SAVE_FAILED_REPLY_TEXT = [
    "⚠️ Bill image uploaded, but the order record could not be saved.",
    "",
    "Please contact support before sending the image again.",
].join("\n");
export async function handleOrderBillImageLineEvent<Bytes>({ event, lineBotService, context, storage, userState, runtime, }: {
    runtime: WorkflowRuntime;
    event: LineEvent;
    lineBotService: WorkflowLine<Bytes>;
    context: WorkflowContext;
    storage: WorkflowImages<Bytes> | undefined;
    userState: UserState;
}): Promise<void> {
    const lineUserId = event.source?.userId;
    const messageId = event.message?.id;
    if (!lineUserId || !messageId) {
        return;
    }
    if (userState.state !== OrderStatus.WaitingForBillImage) {
        return;
    }
    if (!storage) {
        await lineBotService.sendReply(event.replyToken, [
            createTextReplyMessage({
                text: GOOGLE_DRIVE_NOT_CONFIGURED_REPLY_TEXT,
            }),
        ]);
        return;
    }
    let googleDriveUrl: string;
    try {
        const image = await lineBotService.downloadMessageContent(messageId);
        const driveFile = await storage.uploadImage({
            fileName: createBillImageFileName({
                userId: lineUserId,
                messageId,
                contentType: image.contentType,
            }),
            contentType: image.contentType,
            bytes: image.bytes,
        });
        googleDriveUrl = driveFile.webViewLink;
    }
    catch (error) {
        runtime.error("Order bill image upload failed", () => ({
            userId: lineUserId,
            orderId: userState.referenceId,
            messageId,
            error: error instanceof Error ? error.message : String(error),
        }));
        await lineBotService.sendReply(event.replyToken, [
            createTextReplyMessage({
                text: BILL_IMAGE_UPLOAD_FAILED_REPLY_TEXT,
            }),
        ]);
        return;
    }
    try {
        await context.orders.bill({ orderId: userState.referenceId, imageUrl: googleDriveUrl, createdBy: lineUserId });
    }
    catch (error) {
        runtime.error("Order bill record save failed", () => ({
            userId: lineUserId,
            orderId: userState.referenceId,
            messageId,
            error: error instanceof Error ? error.message : String(error),
        }));
        await lineBotService.sendReply(event.replyToken, [
            createTextReplyMessage({
                text: BILL_RECORD_SAVE_FAILED_REPLY_TEXT,
            }),
        ]);
        return;
    }
    await lineBotService.sendReply(event.replyToken, [
        createTextReplyMessage({
            text: createBillImageUploadedReplyText(googleDriveUrl),
            quickReply: createMessageQuickReply([
                {
                    label: "Complete Bill",
                    text: "order:bill:complete",
                },
            ]),
        }),
    ]);
}
function createBillImageUploadedReplyText(googleDriveUrl: string): string {
    return [
        "✅ Bill image uploaded",
        "Google Drive link:",
        googleDriveUrl,
    ].join("\n");
}
function createBillImageFileName({ userId, messageId, contentType, }: {
    userId: string;
    messageId: string;
    contentType: string;
}): string {
    return [
        "order-bill",
        sanitizeFileNamePart(userId),
        sanitizeFileNamePart(messageId),
    ].join("-") + getImageFileExtension(contentType);
}
function sanitizeFileNamePart(value: string): string {
    return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}
function getImageFileExtension(contentType: string): string {
    if (contentType === "image/jpeg")
        return ".jpg";
    if (contentType === "image/png")
        return ".png";
    if (contentType === "image/webp")
        return ".webp";
    return "";
}
