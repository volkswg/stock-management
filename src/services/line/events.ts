import { type LineBotService, type LineEvent } from "@/externals/line";
import type { IGoogleDriveService } from "@/externals/google/drive";
import type { IGoogleSheetsService } from "@/externals/google/sheet";
import { OrderStatus, UserStateFlowName } from "@/services/orders";
import {
  findLatestUserState,
  type UserState,
} from "@/services/user-states";
import { classifyLineTextCommand } from "./text";
import { LineTextCommand } from "./enum";
import { handleCompleteBillLineEvent } from "./events/completeBill";
import { handleCompleteProductsLineEvent } from "./events/completeProducts";
import { handleCreateOrderLineEvent } from "./events/createOrder";
import { handleHelpLineEvent } from "./events/help";
import { handleOrderBillImageLineEvent } from "./events/orderBillImage";
import { handleOrderProductImageLineEvent } from "./events/orderProductImage";
import { handleOrderTotalPriceLineEvent } from "./events/orderTotalPrice";

export async function handleLineEvent({
  event,
  lineBotService,
  getGoogleSheetsService,
  getGoogleDriveService,
  resolvedUserState,
}: {
  event: LineEvent;
  lineBotService: LineBotService;
  getGoogleSheetsService: () => IGoogleSheetsService;
  getGoogleDriveService: () => IGoogleDriveService | undefined;
  resolvedUserState?: UserState;
}): Promise<void> {
  if (event.type !== "message" || !event.message) {
    return;
  }

  if (event.message.type === "image") {
    const lineUserId = event.source?.userId;
    if (!lineUserId) {
      return;
    }

    const googleSheetsService = getGoogleSheetsService();
    const latestUserState =
      resolvedUserState ||
      (await findLatestUserState({
        googleSheetsService,
        userId: lineUserId,
        flowname: UserStateFlowName.OrderCreate,
      }));

    if (!latestUserState) {
      return;
    }

    const imageHandlerInput = {
      event,
      lineBotService,
      googleSheetsService,
      googleDriveService: getGoogleDriveService(),
      userState: latestUserState,
    };

    if (latestUserState.state === OrderStatus.WaitingForBillImage) {
      await handleOrderBillImageLineEvent(imageHandlerInput);
    } else if (
      latestUserState.state === OrderStatus.WaitingForProductImage
    ) {
      await handleOrderProductImageLineEvent(imageHandlerInput);
    }
    return;
  }

  if (event.message.type !== "text") {
    return;
  }

  const command = classifyLineTextCommand(event.message.text);

  if (command === LineTextCommand.Legacy) {
    const lineUserId = event.source?.userId;
    if (lineUserId) {
      const googleSheetsService = getGoogleSheetsService();
      const latestUserState =
        resolvedUserState ||
        (await findLatestUserState({
          googleSheetsService,
          userId: lineUserId,
          flowname: UserStateFlowName.OrderCreate,
        }));

      if (latestUserState?.state === OrderStatus.WaitingForTotalPrice) {
        await handleOrderTotalPriceLineEvent({
          event,
          lineBotService,
          googleSheetsService,
          userState: latestUserState,
        });
        return;
      }
    }
  }

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

    case LineTextCommand.CompleteProducts:
      await handleCompleteProductsLineEvent({
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
