import {
  createTextReplyMessage,
  type LineBotService,
  type LineEvent,
} from "@/externals/line";

const ORDER_CREATE_REPLY_TEXT = [
  "🧾 Create order",
  "Please send a clear bill image now.",
  "Make sure the shop name, items, and total are visible.",
].join("\n");

export async function handleCreateOrderLineEvent({
  event,
  lineBotService,
}: {
  event: LineEvent;
  lineBotService: LineBotService;
}): Promise<void> {
  await lineBotService.sendReply(event.replyToken, [
    createTextReplyMessage({
      text: ORDER_CREATE_REPLY_TEXT,
    }),
  ]);
}
