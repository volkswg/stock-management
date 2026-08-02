import {
  createTextReplyMessage,
  type LineBotService,
  type LineEvent,
} from "@/externals/line";
import type { IGoogleDriveService } from "@/externals/google/drive";
import type { IGoogleSheetsService } from "@/externals/google/sheet";
import { findPendingUserState } from "@/services/user-states";

const GOOGLE_DRIVE_NOT_CONFIGURED_REPLY_TEXT = [
  "⚠️ Cannot upload bill image",
  "Google Drive is not configured.",
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

  const pendingUserState = await findPendingUserState({
    googleSheetsService: getGoogleSheetsService(),
    userId: lineUserId,
  });
  if (!pendingUserState) {
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

  await lineBotService.sendReply(event.replyToken, [
    createTextReplyMessage({
      text: createBillImageUploadedReplyText(driveFile.webViewLink),
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
