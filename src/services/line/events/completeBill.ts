import {
  createTextReplyMessage,
  type LineBotService,
  type LineEvent,
} from "@/externals/line";
import type { IGoogleSheetsService } from "@/externals/google/sheet";
import { completeOrderBill } from "@/services/orders";
import { findPendingUserState } from "@/services/user-states";

const BILL_COMPLETED_REPLY_TEXT = [
  "✅ Bill upload completed",
  "",
  "➡️ NEXT STEP: Please upload a product image.",
].join("\n");

const NO_PENDING_BILL_REPLY_TEXT = [
  "⚠️ No pending bill upload found.",
  "",
  "Create an order before completing bill upload.",
].join("\n");

const BILL_COMPLETION_FAILED_REPLY_TEXT = [
  "❌ Could not complete bill upload.",
  "",
  "Please try again.",
].join("\n");

export async function handleCompleteBillLineEvent({
  event,
  lineBotService,
  getGoogleSheetsService,
}: {
  event: LineEvent;
  lineBotService: LineBotService;
  getGoogleSheetsService: () => IGoogleSheetsService;
}): Promise<void> {
  const lineUserId = event.source?.userId;
  if (!lineUserId) {
    return;
  }

  const googleSheetsService = getGoogleSheetsService();
  const pendingUserState = await findPendingUserState({
    googleSheetsService,
    userId: lineUserId,
  });

  if (!pendingUserState) {
    await lineBotService.sendReply(event.replyToken, [
      createTextReplyMessage({ text: NO_PENDING_BILL_REPLY_TEXT }),
    ]);
    return;
  }

  try {
    await completeOrderBill({
      googleSheetsService,
      orderId: pendingUserState.referenceId,
      userStateId: pendingUserState.id,
      userStateCreatedAt: pendingUserState.createdAt,
    });
  } catch (error) {
    console.error("Order bill completion failed", {
      userId: lineUserId,
      orderId: pendingUserState.referenceId,
      userStateId: pendingUserState.id,
      error: error instanceof Error ? error.message : String(error),
    });

    await lineBotService.sendReply(event.replyToken, [
      createTextReplyMessage({ text: BILL_COMPLETION_FAILED_REPLY_TEXT }),
    ]);
    return;
  }

  await lineBotService.sendReply(event.replyToken, [
    createTextReplyMessage({ text: BILL_COMPLETED_REPLY_TEXT }),
  ]);
}
