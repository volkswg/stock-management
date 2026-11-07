import { createTextReplyMessage } from "@/shared/lib/line-messages";
import { LineMessageType, type LineEvent } from "@/shared/types/line-protocol";
import { OrderStatus } from "@/modules/orders/contracts";
import { UserStateFlowName, type UserState } from "../contracts";
import { type WorkflowContext, type WorkflowLine, type WorkflowImages, type WorkflowRuntime } from "./ports/workflows";
import { resolveUserState } from "./resolve-user-state";
import { classifyLineTextCommand } from "../commands";
import { LineTextCommand } from "../contracts";
import { handleCompleteBillLineEvent } from "./order-events/complete-bill";
import { handleCompleteProductsLineEvent } from "./order-events/complete-products";
import { handleCreateOrderLineEvent } from "./order-events/create-order";
import { handleOrderBillImageLineEvent } from "./order-events/bill-image";
import { handleOrderProductImageLineEvent } from "./order-events/product-image";
import { handleOrderTotalPriceLineEvent } from "./order-events/total-price";
const START_FLOW_REPLY_TEXT = [
    "Choose an action to continue:",
    "",
    "🧾 New order: send create:order",
    "📦 Stock movement: send create:movement",
    "↩️ Resume movement: send resume:movement",
    "",
    "For orders, send photos when asked for bill or product images.",
].join("\n");
export async function handleLineEvent<Bytes>({ event, lineBotService, getContext, getImages, resolvedUserStates, runtime, }: {
    runtime: WorkflowRuntime;
    event: LineEvent;
    lineBotService: WorkflowLine<Bytes>;
    getContext: () => WorkflowContext;
    getImages: () => WorkflowImages<Bytes> | undefined;
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
        const context = getContext();
        const latestUserState = await resolveUserState({
            event,
            flowname: UserStateFlowName.OrderCreate,
            getContext,
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
            context,
            storage: getImages(),
            userState: latestUserState,
            runtime,
        };
        if (latestUserState.state === OrderStatus.WaitingForBillImage) {
            await handleOrderBillImageLineEvent(imageHandlerInput);
        }
        else if (latestUserState.state === OrderStatus.WaitingForProductImage) {
            await handleOrderProductImageLineEvent(imageHandlerInput);
        }
        else {
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
            const context = getContext();
            const latestUserState = await resolveUserState({
                event,
                flowname: UserStateFlowName.OrderCreate,
                getContext,
                resolvedUserStates,
            });
            if (latestUserState?.state === OrderStatus.WaitingForTotalPrice) {
                await handleOrderTotalPriceLineEvent({
                    event,
                    lineBotService,
                    context,
                    userState: latestUserState,
                    runtime,
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
                getContext,
                resolvedUserStates,
                runtime,
            });
            return;
        case LineTextCommand.CompleteBill:
            await handleCompleteBillLineEvent({
                event,
                lineBotService,
                getContext,
                resolvedUserStates,
                runtime,
            });
            return;
        case LineTextCommand.CompleteProducts:
            await handleCompleteProductsLineEvent({
                event,
                lineBotService,
                getContext,
                resolvedUserStates,
                runtime,
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
