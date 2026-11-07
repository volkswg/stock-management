import { createTextReplyMessage } from "@/shared/lib/line-messages";
import { type LineEvent } from "@/shared/types/line-protocol";
import { OrderStatus } from "@/modules/orders/contracts";
import { UserStateFlowName, type UserState } from "../../contracts";
import { type WorkflowContext, type WorkflowLine, type WorkflowRuntime } from "../ports/workflows";
import { resolveUserState } from "../resolve-user-state";
import { completeOrderBill } from "../sessions";
const BILL_COMPLETED_REPLY_TEXT = [
    "✅ Bill upload completed",
    "",
    "➡️ NEXT STEP: Please upload a product image.",
].join("\n");
const NO_PENDING_BILL_REPLY_TEXT = [
    "⚠️ No pending bill upload found.",
    "",
    "Create an order before completing bill upload.",
].join("\n");
const BILL_COMPLETION_FAILED_REPLY_TEXT = [
    "❌ Could not complete bill upload.",
    "",
    "Please try again.",
].join("\n");
export async function handleCompleteBillLineEvent<Bytes>({ event, lineBotService, getContext, resolvedUserStates, runtime, }: {
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
    if (latestUserState?.state !== OrderStatus.WaitingForBillImage) {
        await lineBotService.sendReply(event.replyToken, [
            createTextReplyMessage({ text: NO_PENDING_BILL_REPLY_TEXT }),
        ]);
        return;
    }
    try {
        await completeOrderBill(context, { orderId: latestUserState.referenceId, userStateId: latestUserState.id, userStateCreatedAt: latestUserState.createdAt }, runtime);
    }
    catch (error) {
        runtime.error("Order bill completion failed", () => ({
            userId: lineUserId,
            orderId: latestUserState.referenceId,
            userStateId: latestUserState.id,
            error: error instanceof Error ? error.message : String(error),
        }));
        await lineBotService.sendReply(event.replyToken, [
            createTextReplyMessage({ text: BILL_COMPLETION_FAILED_REPLY_TEXT }),
        ]);
        return;
    }
    await lineBotService.sendReply(event.replyToken, [
        createTextReplyMessage({ text: BILL_COMPLETED_REPLY_TEXT }),
    ]);
}
