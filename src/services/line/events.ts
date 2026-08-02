import { type LineBotService, type LineEvent } from "@/externals/line";
import type { IGoogleSheetsService } from "@/externals/google/sheet";
import { classifyLineTextCommand } from "./text";
import { LineTextCommand } from "./enum";
import { handleCreateOrderLineEvent } from "./events/createOrder";
import { handleHelpLineEvent } from "./events/help";

export async function handleLineEvent({
  event,
  lineBotService,
  getGoogleSheetsService,
}: {
  event: LineEvent;
  lineBotService: LineBotService;
  getGoogleSheetsService: () => IGoogleSheetsService;
}): Promise<void> {
  if (event.type !== "message" || event.message?.type !== "text") {
    return;
  }

  const command = classifyLineTextCommand(event.message.text);

  switch (command) {
    case LineTextCommand.Help:
      await handleHelpLineEvent({ event, lineBotService });
      return;

    case LineTextCommand.CreateOrder:
      await handleCreateOrderLineEvent({
        event,
        lineBotService,
        getGoogleSheetsService,
      });
      return;

    case LineTextCommand.Legacy:
    default:
      // Handle legacy commands or unrecognized commands here if needed
      return;
  }
}
