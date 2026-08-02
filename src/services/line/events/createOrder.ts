import {
  createTextReplyMessage,
  type LineBotService,
  type LineEvent,
} from "@/externals/line";

const ORDER_CREATE_REPLY_TEXT = [
  `🧾 Order Created`,
  "",
  "➡️ NEXT STEP: Please upload the bills image.",
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
