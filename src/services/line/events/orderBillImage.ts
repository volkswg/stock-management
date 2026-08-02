import {
  createTextReplyMessage,
  type LineBotService,
  type LineEvent,
} from "@/externals/line";
import type { IGoogleSheetsService } from "@/externals/google/sheet";
import { findPendingUserState } from "@/services/user-states";

const BILL_IMAGE_RECEIVED_REPLY_TEXT = [
  "🧾 Bill image received",
  "We found your pending order flow.",
].join("\n");

export async function handleOrderBillImageLineEvent({
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

  const pendingUserState = await findPendingUserState({
    googleSheetsService: getGoogleSheetsService(),
    userId: lineUserId,
  });
  if (!pendingUserState) {
    return;
  }

  await lineBotService.sendReply(event.replyToken, [
    createTextReplyMessage({
      text: BILL_IMAGE_RECEIVED_REPLY_TEXT,
    }),
  ]);
}
