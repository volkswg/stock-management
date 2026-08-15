import {
  createMessageQuickReply,
  createTextReplyMessage,
  type LineBotService,
  type LineEvent,
} from "@/externals/line";
import type { IGoogleDriveService } from "@/externals/google/drive";
import type { IGoogleSheetsService } from "@/externals/google/sheet";
import { createOrderItem, OrderStatus } from "@/services/orders";
import type { UserState } from "@/services/user-states";

const GOOGLE_DRIVE_NOT_CONFIGURED_REPLY_TEXT = [
  "⚠️ Cannot upload product image",
  "Google Drive is not configured.",
].join("\n");

const PRODUCT_IMAGE_UPLOAD_FAILED_REPLY_TEXT = [
  "❌ Product image upload failed",
  "",
  "Please try sending the image again.",
  "Your order is still waiting for product images.",
].join("\n");

const PRODUCT_RECORD_SAVE_FAILED_REPLY_TEXT = [
  "⚠️ Product image uploaded, but the order item could not be saved.",
  "",
  "Please contact support before sending the image again.",
].join("\n");

export async function handleOrderProductImageLineEvent({
  event,
  lineBotService,
  googleSheetsService,
  googleDriveService,
  userState,
}: {
  event: LineEvent;
  lineBotService: LineBotService;
  googleSheetsService: IGoogleSheetsService;
  googleDriveService: IGoogleDriveService | undefined;
  userState: UserState;
}): Promise<void> {
  const lineUserId = event.source?.userId;
  const messageId = event.message?.id;
  if (
    !lineUserId ||
    !messageId ||
    userState.state !== OrderStatus.WaitingForProductImage
  ) {
    return;
  }

  if (!googleDriveService) {
    await lineBotService.sendReply(event.replyToken, [
      createTextReplyMessage({ text: GOOGLE_DRIVE_NOT_CONFIGURED_REPLY_TEXT }),
    ]);
    return;
  }

  let googleDriveUrl: string;
  try {
    const image = await lineBotService.downloadMessageContent(messageId);
    const driveFile = await googleDriveService.uploadImage({
      fileName: createProductImageFileName({
        userId: lineUserId,
        messageId,
        contentType: image.contentType,
      }),
      contentType: image.contentType,
      bytes: image.bytes,
    });
    googleDriveUrl = driveFile.webViewLink;
  } catch (error) {
    console.error("Order product image upload failed", {
      userId: lineUserId,
      orderId: userState.referenceId,
      messageId,
      error: error instanceof Error ? error.message : String(error),
    });
    await lineBotService.sendReply(event.replyToken, [
      createTextReplyMessage({ text: PRODUCT_IMAGE_UPLOAD_FAILED_REPLY_TEXT }),
    ]);
    return;
  }

  try {
    await createOrderItem({
      googleSheetsService,
      orderId: userState.referenceId,
      imageUrl: googleDriveUrl,
      createdBy: lineUserId,
    });
  } catch (error) {
    console.error("Order item record save failed", {
      userId: lineUserId,
      orderId: userState.referenceId,
      messageId,
      error: error instanceof Error ? error.message : String(error),
    });
    await lineBotService.sendReply(event.replyToken, [
      createTextReplyMessage({ text: PRODUCT_RECORD_SAVE_FAILED_REPLY_TEXT }),
    ]);
    return;
  }

  await lineBotService.sendReply(event.replyToken, [
    createTextReplyMessage({
      text: createProductImageUploadedReplyText(googleDriveUrl),
      quickReply: createMessageQuickReply([
        {
          label: "Complete Products",
          text: "order:product:complete",
        },
      ]),
    }),
  ]);
}

function createProductImageUploadedReplyText(googleDriveUrl: string): string {
  return [
    "✅ Product image uploaded",
    "Google Drive link:",
    googleDriveUrl,
  ].join("\n");
}

function createProductImageFileName({
  userId,
  messageId,
  contentType,
}: {
  userId: string;
  messageId: string;
  contentType: string;
}): string {
  return [
    "order-product",
    sanitizeFileNamePart(userId),
    sanitizeFileNamePart(messageId),
  ].join("-") + getImageFileExtension(contentType);
}

function sanitizeFileNamePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function getImageFileExtension(contentType: string): string {
  if (contentType === "image/jpeg") return ".jpg";
  if (contentType === "image/png") return ".png";
  if (contentType === "image/webp") return ".webp";
  return "";
}
