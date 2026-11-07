import { createMessageQuickReply, createTextReplyMessage } from "@/shared/lib/line-messages";
import type { LineEvent } from "@/shared/types/line-protocol";
import type { WorkflowLine } from "./ports/workflows";
export async function replyText<Bytes>(line: WorkflowLine<Bytes>, event: LineEvent, text: string, choices: string[][] = []): Promise<void> {
    const quickReply = createMessageQuickReply(choices.map(([label, text]) => ({ label, text })));
    const message = createTextReplyMessage({ text, quickReply });
    await line.sendReply(event.replyToken, [message]);
}
