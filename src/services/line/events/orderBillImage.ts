import {
  createMessageQuickReply,
  createTextReplyMessage,
  type LineBotService,
  type LineEvent,
} from "@/externals/line";
import type { IGoogleDriveService } from "@/externals/google/drive";
import type { IGoogleSheetsService } from "@/externals/google/sheet";
import {
  createOrderBill,
  OrderStatus,
  UserStateFlowName,
} from "@/services/orders";
import { findLatestUserState } from "@/services/user-states";

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

export async function handleOrderBillImageLineEvent({
  event,
  lineBotService,
  getGoogleSheetsService,
  getGoogleDriveService,
}: {
  event: LineEvent;
  lineBotService: LineBotService;
  getGoogleSheetsService: () => IGoogleSheetsService;
  getGoogleDriveService: () => IGoogleDriveService | undefined;
}): Promise<void> {
  const lineUserId = event.source?.userId;
  const messageId = event.message?.id;
  if (!lineUserId || !messageId) {
    return;
  }

  const googleSheetsService = getGoogleSheetsService();
  const latestUserState = await findLatestUserState({
    googleSheetsService,
    userId: lineUserId,
    flowname: UserStateFlowName.OrderCreate,
  });
  if (latestUserState?.state !== OrderStatus.WaitingForBillImage) {
    return;
  }

  const googleDriveService = getGoogleDriveService();
  if (!googleDriveService) {
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
    const driveFile = await googleDriveService.uploadImage({
      fileName: createBillImageFileName({
        userId: lineUserId,
        messageId,
        contentType: image.contentType,
      }),
      contentType: image.contentType,
      bytes: image.bytes,
    });
    googleDriveUrl = driveFile.webViewLink;
  } catch (error) {
    console.error("Order bill image upload failed", {
      userId: lineUserId,
      orderId: latestUserState.referenceId,
      messageId,
      error: error instanceof Error ? error.message : String(error),
    });

    await lineBotService.sendReply(event.replyToken, [
      createTextReplyMessage({
        text: BILL_IMAGE_UPLOAD_FAILED_REPLY_TEXT,
      }),
    ]);
    return;
  }

  try {
    await createOrderBill({
      googleSheetsService,
      orderId: latestUserState.referenceId,
      imageUrl: googleDriveUrl,
      createdBy: lineUserId,
    });
  } catch (error) {
    console.error("Order bill record save failed", {
      userId: lineUserId,
      orderId: latestUserState.referenceId,
      messageId,
      error: error instanceof Error ? error.message : String(error),
    });

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

function createBillImageFileName({
  userId,
  messageId,
  contentType,
}: {
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
  if (contentType === "image/jpeg") return ".jpg";
  if (contentType === "image/png") return ".png";
  if (contentType === "image/webp") return ".webp";
  return "";
}
