import {
  createTextReplyMessage,
  type LineBotService,
  type LineEvent,
} from "@/externals/line";
import type { IGoogleSheetsService } from "@/externals/google/sheet";
import {
  completeOrderProducts,
  OrderStatus,
  UserStateFlowName,
} from "@/services/orders";
import { findLatestUserState } from "@/services/user-states";

const PRODUCTS_COMPLETED_REPLY_TEXT = [
  "✅ Product upload completed",
  "",
  "➡️ NEXT STEP: Please send the total price.",
].join("\n");

const NO_PENDING_PRODUCTS_REPLY_TEXT = [
  "⚠️ No pending product upload found.",
  "",
  "Complete the bill stage before completing product upload.",
].join("\n");

const PRODUCT_COMPLETION_FAILED_REPLY_TEXT = [
  "❌ Could not complete product upload.",
  "",
  "Please try again.",
].join("\n");

export async function handleCompleteProductsLineEvent({
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
  const latestUserState = await findLatestUserState({
    googleSheetsService,
    userId: lineUserId,
    flowname: UserStateFlowName.OrderCreate,
  });

  if (latestUserState?.state !== OrderStatus.WaitingForProductImage) {
    await lineBotService.sendReply(event.replyToken, [
      createTextReplyMessage({ text: NO_PENDING_PRODUCTS_REPLY_TEXT }),
    ]);
    return;
  }

  try {
    await completeOrderProducts({
      googleSheetsService,
      orderId: latestUserState.referenceId,
      userStateId: latestUserState.id,
      userStateCreatedAt: latestUserState.createdAt,
    });
  } catch (error) {
    console.error("Order product completion failed", {
      userId: lineUserId,
      orderId: latestUserState.referenceId,
      userStateId: latestUserState.id,
      error: error instanceof Error ? error.message : String(error),
    });
    await lineBotService.sendReply(event.replyToken, [
      createTextReplyMessage({ text: PRODUCT_COMPLETION_FAILED_REPLY_TEXT }),
    ]);
    return;
  }

  await lineBotService.sendReply(event.replyToken, [
    createTextReplyMessage({ text: PRODUCTS_COMPLETED_REPLY_TEXT }),
  ]);
}
