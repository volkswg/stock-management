import { OrderStatus } from "@/modules/orders/contracts";
import { isRecord } from "@/shared/lib/is-record";
import { MOVEMENT_FLOW, UserStateFlowName, type MovementState, type MovementStep, type UserState } from "../contracts";
import type { MovementSessionStore, MovementSessionSnapshot, WorkflowContext, WorkflowRuntime } from "./ports/workflows";
export async function readMovementSession(store: MovementSessionStore, userId: string, eventId: string, loaded?: MovementSessionSnapshot): Promise<{
    state?: MovementState;
    processed: boolean;
}> {
    const snapshot = loaded ?? await store.read(), entry = snapshot.latestForReading(userId);
    if (!entry)
        return { processed: false };
    if (!String(entry.context || "").trim()) {
        if (entry.step === "complete") {
            await snapshot.eraseMovement(userId);
            return { processed: false };
        }
        throw new Error("Movement user state is missing its active context.");
    }
    let context: unknown;
    try {
        context = JSON.parse(String(entry.context));
    }
    catch {
        throw new Error("Movement user state contains invalid context.");
    }
    if (!isRecord(context) || !["masterId", "itemId", "userId", "startedAt", "shop", "quantity", "remark", "imageUrl", "lastEventId"].every(key => typeof context[key] === "string") || !isStep(context.step) || context.masterId !== entry.referenceId || context.userId !== userId || context.step !== entry.step)
        throw new Error("Movement user state is incomplete. Please resume the movement.");
    const state = context as MovementState;
    return { state, processed: state.lastEventId === eventId };
}
export async function saveMovementState(store: MovementSessionStore, state: MovementState, runtime: WorkflowRuntime): Promise<void> {
    const snapshot = await store.read(), existing = snapshot.findForWriting(() => state.userId);
    if (state.step === "complete") {
        await snapshot.eraseMovement(state.userId);
        return;
    }
    const isSameMovement = existing?.referenceId === state.masterId, now = runtime.now();
    const value = { id: existing?.id || snapshot.nextIdentifier(), userId: state.userId, flowname: MOVEMENT_FLOW, referenceId: state.masterId, state: state.step, createdAt: isSameMovement ? existing?.createdAt || state.startedAt : state.startedAt, updatedAt: now, context: JSON.stringify(state) };
    await snapshot.writeMovement(existing, value);
}
export async function createDraftOrder(context: WorkflowContext, createdBy: string) { const order = await context.orders.draft(createdBy); const id = await context.sessions.nextIdentifier(); const userState: UserState = { id, userId: createdBy, flowname: UserStateFlowName.OrderCreate, referenceId: order.id, state: OrderStatus.WaitingForBillImage, createdAt: order.createdAt, updatedAt: order.createdAt }; await context.sessions.append(userState); return order; }
export async function updateOrderCreateState(context: WorkflowContext, { orderId, userStateId, userStateCreatedAt, state }: {
    orderId: string;
    userStateId: string;
    userStateCreatedAt: string;
    state: OrderStatus;
}, runtime: WorkflowRuntime) {
    const order = await context.orders.transition(orderId), session = context.sessions.reference(userStateId), now = runtime.now();
    await order.status(state);
    await order.touch(now);
    await session.update(state, userStateCreatedAt, now);
}
export async function completeOrderBill(context: WorkflowContext, input: {
    orderId: string;
    userStateId: string;
    userStateCreatedAt: string;
}, runtime: WorkflowRuntime) { await updateOrderCreateState(context, { ...input, state: OrderStatus.WaitingForProductImage }, runtime); }
export async function completeOrderProducts(context: WorkflowContext, input: {
    orderId: string;
    userStateId: string;
    userStateCreatedAt: string;
}, runtime: WorkflowRuntime) { await updateOrderCreateState(context, { ...input, state: OrderStatus.WaitingForTotalPrice }, runtime); }
export async function completeOrderTotalPrice(context: WorkflowContext, { orderId, userStateId, totalPrice }: {
    orderId: string;
    userStateId: string;
    totalPrice: string;
}, runtime: WorkflowRuntime) { const order = await context.orders.transition(orderId), session = context.sessions.reference(userStateId), now = runtime.now(); await order.price(totalPrice); await order.status(OrderStatus.Complete); await order.touch(now); await session.clear(); }
export async function resumeLegacyMovement(context: WorkflowContext, userId: string, runtime: WorkflowRuntime): Promise<MovementState | undefined> { const master = await context.inventory.resumable(userId); if (!master)
    return undefined; return { masterId: master.masterId, itemId: `MOVED-${runtime.createId()}`, userId, step: master.items.length ? 'bag_closed' : 'shop', startedAt: master.startedAt(), shop: '', quantity: '', remark: '', imageUrl: '', lastEventId: '' }; }
function isStep(value: unknown): value is MovementStep {
    return typeof value === "string" && ["shop", "quantity", "product_image", "close_bag", "bag_closed", "complete"].includes(value);
}
