import {
  createTextReplyMessage,
  type LineBotService,
  type LineEvent,
} from "@/externals/line";
import type { IGoogleSheetsService } from "@/externals/google/sheet";
import {
  createDraftOrder,
  isActiveOrderCreateState,
  OrderStatus,
  UserStateFlowName,
} from "@/services/orders";
import {
  findLatestUserState,
  type UserState,
} from "@/services/user-states";

const ORDER_CREATED_REPLY_TEXT = ({
  orderId,
}: {
  orderId: string;
}): string =>
  [
    "🧾 Order created",
    `Order ID: ${orderId}`,
    "",
    "➡️ NEXT STEP: Please upload the bill image.",
  ].join("\n");

const MISSING_LINE_USER_REPLY_TEXT = [
  "⚠️ Cannot create order",
  "",
  "LINE user id is missing. Please create the order from your LINE account chat.",
].join("\n");

const ACTIVE_ORDER_EXISTS_REPLY_TEXT = ({
  orderId,
  state,
}: {
  orderId: string;
  state: OrderStatus;
}): string =>
  [
    "⚠️ You already have an order in progress",
    "",
    `Order ID: ${orderId}`,
    `Current step: ${formatOrderStep(state)}`,
    "",
    "Please complete the current order before creating another one.",
  ].join("\n");

const ORDER_STATE_CHECK_FAILED_REPLY_TEXT = [
  "❌ Cannot create order right now",
  "",
  "Please try again later.",
].join("\n");

export async function handleCreateOrderLineEvent({
  event,
  lineBotService,
  getGoogleSheetsService,
}: {
  event: LineEvent;
  lineBotService: LineBotService;
  getGoogleSheetsService: () => IGoogleSheetsService;
}): Promise<void> {
  const lineUserId = event.source?.userId;
  if (!lineUserId) {
    await lineBotService.sendReply(event.replyToken, [
      createTextReplyMessage({
        text: MISSING_LINE_USER_REPLY_TEXT,
      }),
    ]);
    return;
  }

  const googleSheetsService = getGoogleSheetsService();
  let latestUserState: UserState | undefined;
  try {
    latestUserState = await findLatestUserState({
      googleSheetsService,
      userId: lineUserId,
      flowname: UserStateFlowName.OrderCreate,
    });
  } catch (error) {
    console.error("Order creation state check failed", {
      userId: lineUserId,
      error: error instanceof Error ? error.message : String(error),
    });
    await lineBotService.sendReply(event.replyToken, [
      createTextReplyMessage({ text: ORDER_STATE_CHECK_FAILED_REPLY_TEXT }),
    ]);
    return;
  }

  if (latestUserState && isActiveOrderCreateState(latestUserState.state)) {
    await lineBotService.sendReply(event.replyToken, [
      createTextReplyMessage({
        text: ACTIVE_ORDER_EXISTS_REPLY_TEXT({
          orderId: latestUserState.referenceId,
          state: latestUserState.state,
        }),
      }),
    ]);
    return;
  }

  const order = await createDraftOrder({
    googleSheetsService,
    createdBy: lineUserId,
  });

  await lineBotService.sendReply(event.replyToken, [
    createTextReplyMessage({
      text: ORDER_CREATED_REPLY_TEXT({ orderId: order.id }),
    }),
  ]);
}

function formatOrderStep(state: OrderStatus): string {
  if (state === OrderStatus.WaitingForBillImage) {
    return "Waiting for bill images";
  }
  if (state === OrderStatus.WaitingForProductImage) {
    return "Waiting for product images";
  }
  return state;
}
