import { createTextReplyMessage } from "@/shared/lib/line-messages";
import { type LineEvent } from "@/shared/types/line-protocol";
import { OrderStatus } from "@/modules/orders/contracts";
import { UserStateFlowName, type UserState } from "../../contracts";
import { type WorkflowContext, type WorkflowLine, type WorkflowRuntime } from "../ports/workflows";
import { resolveUserState } from "../resolve-user-state";
import { completeOrderProducts } from "../sessions";
const PRODUCTS_COMPLETED_REPLY_TEXT = [
    "✅ Product upload completed",
    "",
    "➡️ NEXT STEP: Please send the total price.",
].join("\n");
const NO_PENDING_PRODUCTS_REPLY_TEXT = [
    "⚠️ No pending product upload found.",
    "",
    "Complete the bill stage before completing product upload.",
].join("\n");
const PRODUCT_COMPLETION_FAILED_REPLY_TEXT = [
    "❌ Could not complete product upload.",
    "",
    "Please try again.",
].join("\n");
export async function handleCompleteProductsLineEvent<Bytes>({ event, lineBotService, getContext, resolvedUserStates, runtime, }: {
    runtime: WorkflowRuntime;
    event: LineEvent;
    lineBotService: WorkflowLine<Bytes>;
    getContext: () => WorkflowContext;
    resolvedUserStates: Map<LineEvent, UserState>;
}): Promise<void> {
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
    if (latestUserState?.state !== OrderStatus.WaitingForProductImage) {
        await lineBotService.sendReply(event.replyToken, [
            createTextReplyMessage({ text: NO_PENDING_PRODUCTS_REPLY_TEXT }),
        ]);
        return;
    }
    try {
        await completeOrderProducts(context, { orderId: latestUserState.referenceId, userStateId: latestUserState.id, userStateCreatedAt: latestUserState.createdAt }, runtime);
    }
    catch (error) {
        runtime.error("Order product completion failed", () => ({
            userId: lineUserId,
            orderId: latestUserState.referenceId,
            userStateId: latestUserState.id,
            error: error instanceof Error ? error.message : String(error),
        }));
        await lineBotService.sendReply(event.replyToken, [
            createTextReplyMessage({ text: PRODUCT_COMPLETION_FAILED_REPLY_TEXT }),
        ]);
        return;
    }
    await lineBotService.sendReply(event.replyToken, [
        createTextReplyMessage({ text: PRODUCTS_COMPLETED_REPLY_TEXT }),
    ]);
}
