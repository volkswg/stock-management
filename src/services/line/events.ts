import { type LineBotService, type LineEvent } from "@/externals/line";
import type { IGoogleDriveService } from "@/externals/google/drive";
import type { IGoogleSheetsService } from "@/externals/google/sheet";
import { classifyLineTextCommand } from "./text";
import { LineTextCommand } from "./enum";
import { handleCompleteBillLineEvent } from "./events/completeBill";
import { handleCreateOrderLineEvent } from "./events/createOrder";
import { handleHelpLineEvent } from "./events/help";
import { handleOrderBillImageLineEvent } from "./events/orderBillImage";

export async function handleLineEvent({
  event,
  lineBotService,
  getGoogleSheetsService,
  getGoogleDriveService,
}: {
  event: LineEvent;
  lineBotService: LineBotService;
  getGoogleSheetsService: () => IGoogleSheetsService;
  getGoogleDriveService: () => IGoogleDriveService | undefined;
}): Promise<void> {
  if (event.type !== "message" || !event.message) {
    return;
  }

  if (event.message.type === "image") {
    await handleOrderBillImageLineEvent({
      event,
      lineBotService,
      getGoogleSheetsService,
      getGoogleDriveService,
    });
    return;
  }

  if (event.message.type !== "text") {
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

    case LineTextCommand.CompleteBill:
      await handleCompleteBillLineEvent({
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
