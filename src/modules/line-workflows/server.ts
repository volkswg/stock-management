import { processPostgresWebhook } from "./infrastructure/postgres/webhook";
import "server-only";
import type { Storage } from "./infrastructure/postgres/storage";
import type { IGoogleDriveService } from "@/infrastructure/files/google-drive/types";
import type { LineBotService, ILineBotService } from "@/infrastructure/external/line";
import type { LineEvent } from "@/shared/types/line-protocol";
import type { AppConfig } from "@/config";
import { createSortableId } from "@/infrastructure/runtime/create-sortable-id";
import { OrderStatus, type Order } from "@/modules/orders/contracts";
import { createDraftRecord, createOrderBill, createOrderItem, prepareOrderTransition, orderExists } from "@/modules/orders/server";
import { createMovementJourneyAdapter, movementJourneyItems, synchronizeMovementJourney, findResumableMovementJourney, appendMovementJourneyItem } from "@/modules/inventory/server";
import { type MovementState, type MovementImageUploadProgress, type UserState, type UserStateFlowName, type MovementEventClassification, type LineEventClassification } from "./contracts";
import type { WorkflowContext } from "./application/ports/workflows";
import { createSessionAdapter } from "./infrastructure/postgres/sessions";
import { createWorkflowRuntime } from "./infrastructure/runtime";
import * as sessions from "./application/sessions";
import { handleLineEvent as executeLineEvent } from "./application/order-events";
import { handleMovementEvent as executeMovementEvent } from "./application/movement-events";
import { classifyLineEvent as executeClassify } from "./application/classify-event";
import { resolveUserState as executeResolve } from "./application/resolve-user-state";
import { replyText as executeReply } from "./application/reply";
import * as billEvents from "./application/order-events/complete-bill";
import * as productEvents from "./application/order-events/complete-products";
import * as createEvents from "./application/order-events/create-order";
import * as billImages from "./application/order-events/bill-image";
import * as productImages from "./application/order-events/product-image";
import * as totalEvents from "./application/order-events/total-price";
export { parseLineWebhookPayload } from "./infrastructure/payload";
export { isLineEvent } from "./domain/payload";
export { isMovementStartCommand } from "./application/classify-event";
export { classifyLineTextCommand } from "./commands";
export { MOVEMENT_FLOW } from "./contracts";
const runtime = createWorkflowRuntime(createSortableId);
function createContext(sheets: Storage) {
    const inventory = createMovementJourneyAdapter(sheets), adapter = createSessionAdapter(sheets, inventory);
    const context: WorkflowContext = { sessions: adapter.orders, movements: adapter.movements,
        orders: { draft: createdBy => createDraftRecord({ storage: sheets, createdBy }), bill: input => createOrderBill({ ...input, storage: sheets }), item: input => createOrderItem({ ...input, storage: sheets }), transition: orderId => prepareOrderTransition({ storage: sheets, orderId }), exists: orderId => orderExists({ storage: sheets, orderId }) },
        inventory: { items: masterId => movementJourneyItems(sheets, masterId), sync: (state, complete) => synchronizeMovementJourney(sheets, state, complete), resumable: userId => findResumableMovementJourney(sheets, userId), append: readItem => appendMovementJourneyItem(sheets, readItem) }, photoContext: adapter.photoContext };
    return { context, adapter, inventory };
}
export async function classifyWebhookEvent({ event, getStorage }: {
    event: LineEvent;
    getStorage: () => Storage;
}): Promise<LineEventClassification> { return executeClassify({ event, getContext: () => createContext(getStorage()).context }); }
export async function handleLineEvent({ event, lineBotService, getStorage, getGoogleDriveService, resolvedUserStates }: {
    event: LineEvent;
    lineBotService: LineBotService;
    getStorage: () => Storage;
    getGoogleDriveService: () => IGoogleDriveService | undefined;
    resolvedUserStates: Map<LineEvent, UserState>;
}): Promise<void> { return executeLineEvent({ event, lineBotService, getContext: () => createContext(getStorage()).context, getImages: getGoogleDriveService, resolvedUserStates, runtime }); }
export async function resolveUserState({ event, flowname, getStorage, resolvedUserStates }: {
    event: LineEvent;
    flowname: UserStateFlowName;
    getStorage: () => Storage;
    resolvedUserStates: Map<LineEvent, UserState>;
}): Promise<UserState | undefined> { return executeResolve({ event, flowname, getContext: () => createContext(getStorage()).context, resolvedUserStates }); }
export async function handleMovementJourney({ event, session, sheets, drive, line, publicBaseUrl, createMode = 'quantity_photo', imageUpload }: {
    event: MovementEventClassification['event'];
    session: MovementEventClassification['session'];
    sheets: Storage;
    drive: () => IGoogleDriveService | undefined;
    line: ILineBotService;
    publicBaseUrl: string;
    createMode?: AppConfig['movementCreateMode'];
    imageUpload?: MovementImageUploadProgress;
}): Promise<void> { return executeMovementEvent({ event, session, context: createContext(sheets).context, drive, line, publicBaseUrl, createMode, imageUpload, runtime }); }
export async function saveMovementState(sheets: Storage, state: MovementState): Promise<void> { return sessions.saveMovementState(createContext(sheets).context.movements, state, runtime); }
export async function resumeLegacyMovement(sheets: Storage, userId: string): Promise<MovementState | undefined> { return sessions.resumeLegacyMovement(createContext(sheets).context, userId, runtime); }
export async function findLatestUserState({ storage, userId, flowname }: {
    storage: Storage;
    userId: string;
    flowname: UserStateFlowName;
}): Promise<UserState | undefined> { return createContext(storage).context.sessions.findLatest(userId, flowname); }
export async function createDraftOrder({ storage, createdBy }: {
    storage: Storage;
    createdBy: string;
}): Promise<Order> { return sessions.createDraftOrder(createContext(storage).context, createdBy); }
export async function updateOrderCreateState({ storage, orderId, userStateId, userStateCreatedAt, state }: {
    storage: Storage;
    orderId: string;
    userStateId: string;
    userStateCreatedAt: string;
    state: OrderStatus;
}): Promise<void> { return sessions.updateOrderCreateState(createContext(storage).context, { orderId, userStateId, userStateCreatedAt, state }, runtime); }
export async function completeOrderBill({ storage, orderId, userStateId, userStateCreatedAt }: {
    storage: Storage;
    orderId: string;
    userStateId: string;
    userStateCreatedAt: string;
}): Promise<void> { return sessions.completeOrderBill(createContext(storage).context, { orderId, userStateId, userStateCreatedAt }, runtime); }
export async function completeOrderProducts({ storage, orderId, userStateId, userStateCreatedAt }: {
    storage: Storage;
    orderId: string;
    userStateId: string;
    userStateCreatedAt: string;
}): Promise<void> { return sessions.completeOrderProducts(createContext(storage).context, { orderId, userStateId, userStateCreatedAt }, runtime); }
export async function completeOrderTotalPrice({ storage, orderId, userStateId, totalPrice }: {
    storage: Storage;
    orderId: string;
    userStateId: string;
    totalPrice: string;
}): Promise<void> { return sessions.completeOrderTotalPrice(createContext(storage).context, { orderId, userStateId, totalPrice }, runtime); }
export async function replyText(line: ILineBotService, event: LineEvent, text: string, choices: string[][] = []): Promise<void> { return executeReply(line, event, text, choices); }
export async function handleCompleteBillLineEvent({ event, lineBotService, getStorage, resolvedUserStates, }: {
    event: LineEvent;
    lineBotService: LineBotService;
    getStorage: () => Storage;
    resolvedUserStates: Map<LineEvent, UserState>;
}): Promise<void> {
    return billEvents.handleCompleteBillLineEvent({ event, lineBotService, getContext: () => createContext(getStorage()).context, resolvedUserStates, runtime });
}
export async function handleCompleteProductsLineEvent({ event, lineBotService, getStorage, resolvedUserStates, }: {
    event: LineEvent;
    lineBotService: LineBotService;
    getStorage: () => Storage;
    resolvedUserStates: Map<LineEvent, UserState>;
}): Promise<void> {
    return productEvents.handleCompleteProductsLineEvent({ event, lineBotService, getContext: () => createContext(getStorage()).context, resolvedUserStates, runtime });
}
export async function handleCreateOrderLineEvent({ event, lineBotService, getStorage, resolvedUserStates, }: {
    event: LineEvent;
    lineBotService: LineBotService;
    getStorage: () => Storage;
    resolvedUserStates: Map<LineEvent, UserState>;
}): Promise<void> {
    return createEvents.handleCreateOrderLineEvent({ event, lineBotService, getContext: () => createContext(getStorage()).context, resolvedUserStates, runtime });
}
export async function handleOrderBillImageLineEvent({ event, lineBotService, storage, googleDriveService, userState, }: {
    event: LineEvent;
    lineBotService: LineBotService;
    storage: Storage;
    googleDriveService: IGoogleDriveService | undefined;
    userState: UserState;
}): Promise<void> {
    return billImages.handleOrderBillImageLineEvent({ event, lineBotService, context: createContext(storage).context, storage: googleDriveService, userState, runtime });
}
export async function handleOrderProductImageLineEvent({ event, lineBotService, storage, googleDriveService, userState, }: {
    event: LineEvent;
    lineBotService: LineBotService;
    storage: Storage;
    googleDriveService: IGoogleDriveService | undefined;
    userState: UserState;
}): Promise<void> {
    return productImages.handleOrderProductImageLineEvent({ event, lineBotService, context: createContext(storage).context, storage: googleDriveService, userState, runtime });
}
export async function handleOrderTotalPriceLineEvent({ event, lineBotService, storage, userState, }: {
    event: LineEvent;
    lineBotService: LineBotService;
    storage: Storage;
    userState: UserState;
}): Promise<void> {
    return totalEvents.handleOrderTotalPriceLineEvent({ event, lineBotService, context: createContext(storage).context, userState, runtime });
}
export async function processLineWebhook({ events, lineBotService, getStorage, getGoogleDriveService, getCreateMode, getPublicBaseUrl }: {
    events: LineEvent[] | undefined;
    lineBotService: LineBotService;
    getStorage: () => Storage;
    getGoogleDriveService: () => IGoogleDriveService | undefined;
    getCreateMode: () => AppConfig['movementCreateMode'];
    getPublicBaseUrl: () => string;
}) { return processPostgresWebhook({ events, lineBotService, getContext: () => createContext(getStorage()).context, getImages: getGoogleDriveService, getCreateMode, getPublicBaseUrl, runtime }); }
