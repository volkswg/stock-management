import {
  createMessageQuickReply,
  createTextReplyMessage,
  type ILineBotService,
  type LineEvent,
} from "@/externals/line";

export async function replyText(
  line: ILineBotService,
  event: LineEvent,
  text: string,
  choices: string[][] = [],
): Promise<void> {
  const quickReply = createMessageQuickReply(
    choices.map(([label, text]) => ({ label, text })),
  );
  const message = createTextReplyMessage({ text, quickReply });
  await line.sendReply(event.replyToken, [message]);
}
