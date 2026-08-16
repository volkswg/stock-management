import {
  createTextReplyMessage,
  type LineBotService,
  type LineEvent,
} from "@/externals/line";
import type { IGoogleSheetsService } from "@/externals/google/sheet";
import { completeOrderTotalPrice, OrderStatus } from "@/services/orders";
import type { UserState } from "@/services/user-states";

const INVALID_TOTAL_PRICE_REPLY_TEXT = [
  "⚠️ Invalid total price",
  "",
  "Please send a number greater than 0.",
  "Example: 1250 or 1,250.50",
].join("\n");

const TOTAL_PRICE_SAVE_FAILED_REPLY_TEXT = [
  "❌ Could not save the total price.",
  "",
  "Please try again.",
].join("\n");

export async function handleOrderTotalPriceLineEvent({
  event,
  lineBotService,
  googleSheetsService,
  userState,
}: {
  event: LineEvent;
  lineBotService: LineBotService;
  googleSheetsService: IGoogleSheetsService;
  userState: UserState;
}): Promise<void> {
  if (userState.state !== OrderStatus.WaitingForTotalPrice) {
    return;
  }

  const totalPrice = parseTotalPrice(event.message?.text);
  if (!totalPrice) {
    await lineBotService.sendReply(event.replyToken, [
      createTextReplyMessage({ text: INVALID_TOTAL_PRICE_REPLY_TEXT }),
    ]);
    return;
  }

  try {
    await completeOrderTotalPrice({
      googleSheetsService,
      orderId: userState.referenceId,
      userStateId: userState.id,
      userStateCreatedAt: userState.createdAt,
      totalPrice,
    });
  } catch (error) {
    console.error("Order total price save failed", {
      userId: userState.userId,
      orderId: userState.referenceId,
      userStateId: userState.id,
      error: error instanceof Error ? error.message : String(error),
    });
    await lineBotService.sendReply(event.replyToken, [
      createTextReplyMessage({ text: TOTAL_PRICE_SAVE_FAILED_REPLY_TEXT }),
    ]);
    return;
  }

  await lineBotService.sendReply(event.replyToken, [
    createTextReplyMessage({
      text: [
        "✅ Total price saved",
        `Order ID: ${userState.referenceId}`,
        `Total price: ${formatTotalPrice(totalPrice)}`,
        "Order status: Paid",
      ].join("\n"),
    }),
  ]);
}

function parseTotalPrice(text: string | undefined): string | undefined {
  const value = text?.trim().replace(/^(?:thb|฿)\s*/i, "");
  if (
    !value ||
    !/^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?$/.test(value)
  ) {
    return undefined;
  }

  const normalizedValue = value.replace(/,/g, "");
  const amount = Number(normalizedValue);
  return Number.isFinite(amount) && amount > 0 ? normalizedValue : undefined;
}

function formatTotalPrice(totalPrice: string): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(Number(totalPrice));
}
