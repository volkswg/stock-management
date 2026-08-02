import {
  createTextReplyMessage,
  type LineBotService,
  type LineEvent,
} from "@/externals/line";
import type { IGoogleSheetsService } from "@/externals/google/sheet";
import { createDraftOrder } from "@/services/orders";

const ORDER_CREATED_REPLY_TEXT = ({
  orderId,
}: {
  orderId: string;
}): string =>
  [
    "🧾 Order created",
    `Order ID: ${orderId}`,
    "",
    "➡️ NEXT STEP: Please upload the bill image.",
  ].join("\n");

const MISSING_LINE_USER_REPLY_TEXT = [
  "⚠️ Cannot create order",
  "",
  "LINE user id is missing. Please create the order from your LINE account chat.",
].join("\n");

export async function handleCreateOrderLineEvent({
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
    await lineBotService.sendReply(event.replyToken, [
      createTextReplyMessage({
        text: MISSING_LINE_USER_REPLY_TEXT,
      }),
    ]);
    return;
  }

  const order = await createDraftOrder({
    googleSheetsService: getGoogleSheetsService(),
    createdBy: lineUserId,
  });

  await lineBotService.sendReply(event.replyToken, [
    createTextReplyMessage({
      text: ORDER_CREATED_REPLY_TEXT({ orderId: order.id }),
    }),
  ]);
}
