import {
  createTextReplyMessage,
  type LineBotService,
  type LineEvent,
} from "@/externals/line";
import type { IGoogleSheetsService } from "@/externals/google/sheet";
import {
  completeOrderBill,
  OrderStatus,
  UserStateFlowName,
} from "@/services/orders";
import type { UserState } from "@/services/user-states";
import { resolveUserState } from "../utils/resolveUserState";

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
  resolvedUserStates,
}: {
  event: LineEvent;
  lineBotService: LineBotService;
  getGoogleSheetsService: () => IGoogleSheetsService;
  resolvedUserStates: Map<LineEvent, UserState>;
}): Promise<void> {
  const lineUserId = event.source?.userId;
  if (!lineUserId) {
    return;
  }

  const googleSheetsService = getGoogleSheetsService();
  const latestUserState = await resolveUserState({
    event,
    flowname: UserStateFlowName.OrderCreate,
    getGoogleSheetsService,
    resolvedUserStates,
  });

  if (latestUserState?.state !== OrderStatus.WaitingForBillImage) {
    await lineBotService.sendReply(event.replyToken, [
      createTextReplyMessage({ text: NO_PENDING_BILL_REPLY_TEXT }),
    ]);
    return;
  }

  try {
    await completeOrderBill({
      googleSheetsService,
      orderId: latestUserState.referenceId,
      userStateId: latestUserState.id,
      userStateCreatedAt: latestUserState.createdAt,
    });
  } catch (error) {
    console.error("Order bill completion failed", {
      userId: lineUserId,
      orderId: latestUserState.referenceId,
      userStateId: latestUserState.id,
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
