import {
  createTextReplyMessage,
  LineMessageType,
  type LineBotService,
  type LineEvent,
} from "@/externals/line";
import type { IGoogleDriveService } from "@/externals/google/drive";
import type { IGoogleSheetsService } from "@/externals/google/sheet";
import { OrderStatus, UserStateFlowName } from "@/services/orders";
import type { UserState } from "@/services/user-states";
import { classifyLineTextCommand } from "./text";
import { LineTextCommand } from "./enum";
import { handleCompleteBillLineEvent } from "./events/completeBill";
import { handleCompleteProductsLineEvent } from "./events/completeProducts";
import { handleCreateOrderLineEvent } from "./events/createOrder";
import { handleOrderBillImageLineEvent } from "./events/orderBillImage";
import { handleOrderProductImageLineEvent } from "./events/orderProductImage";
import { handleOrderTotalPriceLineEvent } from "./events/orderTotalPrice";
import { resolveUserState } from "./utils/resolveUserState";

const START_FLOW_REPLY_TEXT = [
  "Choose an action to continue:",
  "",
  "🧾 New order: send create:order",
  "📦 Stock movement: send create:movement",
  "↩️ Resume movement: send resume:movement",
  "",
  "For orders, send photos when asked for bill or product images.",
].join("\n");

export async function handleLineEvent({
  event,
  lineBotService,
  getGoogleSheetsService,
  getGoogleDriveService,
  resolvedUserStates,
}: {
  event: LineEvent;
  lineBotService: LineBotService;
  getGoogleSheetsService: () => IGoogleSheetsService;
  getGoogleDriveService: () => IGoogleDriveService | undefined;
  resolvedUserStates: Map<LineEvent, UserState>;
}): Promise<void> {
  if (event.type !== "message" || !event.message) {
    return;
  }

  if (event.message.type === LineMessageType.Image) {
    const lineUserId = event.source?.userId;
    if (!lineUserId) {
      return;
    }

    const googleSheetsService = getGoogleSheetsService();
    const latestUserState = await resolveUserState({
      event,
      flowname: UserStateFlowName.OrderCreate,
      getGoogleSheetsService,
      resolvedUserStates,
    });

    if (!latestUserState) {
      await lineBotService.sendReply(event.replyToken, [
        createTextReplyMessage({ text: START_FLOW_REPLY_TEXT }),
      ]);
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
    } else {
      await lineBotService.sendReply(event.replyToken, [
        createTextReplyMessage({
          text: latestUserState.state === OrderStatus.WaitingForTotalPrice
            ? "➡️ Send the order total price as a number.\nExample: 1,250.50"
            : START_FLOW_REPLY_TEXT,
        }),
      ]);
    }
    return;
  }

  if (event.message.type !== LineMessageType.Text) {
    return;
  }

  const command = classifyLineTextCommand(event.message.text);

  if (command === LineTextCommand.Unknown) {
    const lineUserId = event.source?.userId;
    if (lineUserId) {
      const googleSheetsService = getGoogleSheetsService();
      const latestUserState = await resolveUserState({
        event,
        flowname: UserStateFlowName.OrderCreate,
        getGoogleSheetsService,
        resolvedUserStates,
      });

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
    case LineTextCommand.CreateOrder:
      await handleCreateOrderLineEvent({
        event,
        lineBotService,
        getGoogleSheetsService,
        resolvedUserStates,
      });
      return;

    case LineTextCommand.CompleteBill:
      await handleCompleteBillLineEvent({
        event,
        lineBotService,
        getGoogleSheetsService,
        resolvedUserStates,
      });
      return;

    case LineTextCommand.CompleteProducts:
      await handleCompleteProductsLineEvent({
        event,
        lineBotService,
        getGoogleSheetsService,
        resolvedUserStates,
      });
      return;

    case LineTextCommand.Unknown:
    default:
      await lineBotService.sendReply(event.replyToken, [
        createTextReplyMessage({ text: START_FLOW_REPLY_TEXT }),
      ]);
      return;
  }
}
