import {
  createTextReplyMessage,
  type LineBotService,
  type LineEvent,
} from "@/externals/line";
import { formatHelpText } from "../help";

export async function handleHelpLineEvent({
  event,
  lineBotService,
}: {
  event: LineEvent;
  lineBotService: LineBotService;
}): Promise<void> {
  await lineBotService.sendReply(event.replyToken, [
    createTextReplyMessage({
      text: formatHelpText(),
    }),
  ]);
}
