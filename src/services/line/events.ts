import {
  createTextReplyMessage,
  type LineBotService,
  type LineEvent,
} from "@/externals/line";
import { formatHelpText, isHelpCommand } from "./help";

export async function handleLineEvent({
  event,
  lineBotService,
}: {
  event: LineEvent;
  lineBotService: LineBotService;
}): Promise<void> {
  if (event.type !== "message" || event.message?.type !== "text") {
    return;
  }

  const text = event.message.text;
  if (!text || !isHelpCommand(text)) {
    return;
  }

  await lineBotService.sendReply(event.replyToken, [
    createTextReplyMessage({
      text: formatHelpText(),
    }),
  ]);
}
