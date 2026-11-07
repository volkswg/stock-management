import "server-only";
import type { IGoogleSheetsService, GoogleSheetRow, MovementWorksheet } from "@/externals/google/sheet/types";
import type { IGoogleDriveService } from "@/infrastructure/files/google-drive/types";
import type { LineBotService, ILineBotService } from "@/infrastructure/external/line";
import type { LineEvent } from "@/shared/types/line-protocol";
import type { AppConfig } from "@/config";
import { createSortableId } from "@/services/utils/createSortableId";
import { OrderStatus, type Order } from "@/modules/orders/contracts";
import { createDraftRecord, createOrderBill, createOrderItem, prepareOrderTransition, orderExists } from "@/modules/orders/server";
import { createMovementJourneyAdapter, movementJourneyItems, synchronizeMovementJourney, findResumableMovementJourney, appendMovementJourneyItem } from "@/modules/inventory/server";
import { EventKindEnum, type MovementState, type MovementImageUploadProgress, type UserState, type UserStateFlowName, type MovementEventClassification, type LineEventClassification } from "./contracts";
import type { WorkflowContext } from "./application/ports/workflows";
import { createSessionAdapter } from "./infrastructure/google-sheets/sessions";
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
export { MASTER_HEADERS, DETAIL_HEADERS, ensureHeader } from "@/modules/inventory/server";
const runtime = createWorkflowRuntime(createSortableId);
function createContext(sheets: IGoogleSheetsService) {
    const inventory = createMovementJourneyAdapter(sheets), adapter = createSessionAdapter(sheets, inventory);
    const context: WorkflowContext = { sessions: adapter.orders, movements: adapter.movements,
        orders: { draft: createdBy => createDraftRecord({ googleSheetsService: sheets, createdBy }), bill: input => createOrderBill({ ...input, googleSheetsService: sheets }), item: input => createOrderItem({ ...input, googleSheetsService: sheets }), transition: orderId => prepareOrderTransition({ googleSheetsService: sheets, orderId }), exists: orderId => orderExists({ googleSheetsService: sheets, orderId }) },
        inventory: { items: masterId => movementJourneyItems(sheets, masterId), sync: (state, complete) => synchronizeMovementJourney(sheets, state, complete), resumable: userId => findResumableMovementJourney(sheets, userId), append: readItem => appendMovementJourneyItem(sheets, readItem) }, photoContext: adapter.photoContext };
    return { context, adapter, inventory };
}
// Supported raw-row compatibility is confined to server composition, never application ports.
export type LegacyMovementEventClassification = {
    kind: EventKindEnum.Movement;
    event: MovementEventClassification['event'];
    session: {
        state?: MovementState;
        processed: boolean;
        photoItems?: GoogleSheetRow[];
    };
};
export type LegacyLineEventClassification = LegacyMovementEventClassification | {
    kind: EventKindEnum.Order;
};
export async function classifyWebhookEvent({ event, getGoogleSheetsService }: {
    event: LineEvent;
    getGoogleSheetsService: () => IGoogleSheetsService;
}): Promise<LineEventClassification> { return executeClassify({ event, getContext: () => createContext(getGoogleSheetsService()).context }); }
export async function classifyLineEvent({ event, getGoogleSheetsService }: {
    event: LineEvent;
    getGoogleSheetsService: () => IGoogleSheetsService;
}): Promise<LegacyLineEventClassification> {
    let selected: ReturnType<typeof createContext> | undefined;
    const result = await executeClassify({ event, getContext: () => { selected = createContext(getGoogleSheetsService()); return selected.context; } });
    if (result.kind === EventKindEnum.Order)
        return result;
    return { ...result, session: { ...result.session, photoItems: result.session.photoItems && selected!.inventory.rawItems(result.session.photoItems) } };
}
export async function handleLineEvent({ event, lineBotService, getGoogleSheetsService, getGoogleDriveService, resolvedUserStates }: {
    event: LineEvent;
    lineBotService: LineBotService;
    getGoogleSheetsService: () => IGoogleSheetsService;
    getGoogleDriveService: () => IGoogleDriveService | undefined;
    resolvedUserStates: Map<LineEvent, UserState>;
}): Promise<void> { return executeLineEvent({ event, lineBotService, getContext: () => createContext(getGoogleSheetsService()).context, getImages: getGoogleDriveService, resolvedUserStates, runtime }); }
export async function resolveUserState({ event, flowname, getGoogleSheetsService, resolvedUserStates }: {
    event: LineEvent;
    flowname: UserStateFlowName;
    getGoogleSheetsService: () => IGoogleSheetsService;
    resolvedUserStates: Map<LineEvent, UserState>;
}): Promise<UserState | undefined> { return executeResolve({ event, flowname, getContext: () => createContext(getGoogleSheetsService()).context, resolvedUserStates }); }
export async function handleMovementJourney({ event, session, sheets, drive, line, publicBaseUrl, createMode = 'quantity_photo', imageUpload }: {
    event: MovementEventClassification['event'];
    session: MovementEventClassification['session'];
    sheets: IGoogleSheetsService;
    drive: () => IGoogleDriveService | undefined;
    line: ILineBotService;
    publicBaseUrl: string;
    createMode?: AppConfig['movementCreateMode'];
    imageUpload?: MovementImageUploadProgress;
}): Promise<void> { return executeMovementEvent({ event, session, context: createContext(sheets).context, drive, line, publicBaseUrl, createMode, imageUpload, runtime }); }
export async function handleMovementEvent({ event, session, sheets, drive, line, publicBaseUrl, createMode = 'quantity_photo', imageUpload }: {
    event: LegacyMovementEventClassification['event'];
    session: LegacyMovementEventClassification['session'];
    sheets: IGoogleSheetsService;
    drive: () => IGoogleDriveService | undefined;
    line: ILineBotService;
    publicBaseUrl: string;
    createMode?: AppConfig['movementCreateMode'];
    imageUpload?: MovementImageUploadProgress;
}): Promise<void> {
    const selected = createContext(sheets), view = { get state() { return session.state; }, get processed() { return session.processed; }, get photoItems() { const rows = session.photoItems; return rows && selected.inventory.projectItems(rows); } };
    return executeMovementEvent({ event, session: view, context: selected.context, drive, line, publicBaseUrl, createMode, imageUpload, runtime });
}
export async function readMovementTables(sheets: IGoogleSheetsService, tables: MovementWorksheet[]): Promise<GoogleSheetRow[][]> { return createContext(sheets).adapter.readTables(tables); }
export async function readMovementSession(sheets: IGoogleSheetsService, userId: string, eventId: string, loadedRows?: GoogleSheetRow[]): Promise<{
    state?: MovementState;
    processed: boolean;
}> { const selected = createContext(sheets); return sessions.readMovementSession(selected.context.movements, userId, eventId, loadedRows == null ? undefined : selected.adapter.snapshot(loadedRows)); }
export async function saveMovementState(sheets: IGoogleSheetsService, state: MovementState): Promise<void> { return sessions.saveMovementState(createContext(sheets).context.movements, state, runtime); }
export async function movementItems(sheets: IGoogleSheetsService, masterId: string): Promise<GoogleSheetRow[]> { const selected = createContext(sheets); return selected.inventory.rawItems(await selected.context.inventory.items(masterId)); }
export async function saveMaster(sheets: IGoogleSheetsService, state: MovementState, complete = false): Promise<GoogleSheetRow[]> { const selected = createContext(sheets); return selected.inventory.rawItems(await selected.context.inventory.sync(state, complete)); }
export async function resumeLegacyMovement(sheets: IGoogleSheetsService, userId: string): Promise<MovementState | undefined> { return sessions.resumeLegacyMovement(createContext(sheets).context, userId, runtime); }
export async function findLatestUserState({ googleSheetsService, userId, flowname }: {
    googleSheetsService: IGoogleSheetsService;
    userId: string;
    flowname: UserStateFlowName;
}): Promise<UserState | undefined> { return createContext(googleSheetsService).context.sessions.findLatest(userId, flowname); }
export async function createDraftOrder({ googleSheetsService, createdBy }: {
    googleSheetsService: IGoogleSheetsService;
    createdBy: string;
}): Promise<Order> { return sessions.createDraftOrder(createContext(googleSheetsService).context, createdBy); }
export async function updateOrderCreateState({ googleSheetsService, orderId, userStateId, userStateCreatedAt, state }: {
    googleSheetsService: IGoogleSheetsService;
    orderId: string;
    userStateId: string;
    userStateCreatedAt: string;
    state: OrderStatus;
}): Promise<void> { return sessions.updateOrderCreateState(createContext(googleSheetsService).context, { orderId, userStateId, userStateCreatedAt, state }, runtime); }
export async function completeOrderBill({ googleSheetsService, orderId, userStateId, userStateCreatedAt }: {
    googleSheetsService: IGoogleSheetsService;
    orderId: string;
    userStateId: string;
    userStateCreatedAt: string;
}): Promise<void> { return sessions.completeOrderBill(createContext(googleSheetsService).context, { orderId, userStateId, userStateCreatedAt }, runtime); }
export async function completeOrderProducts({ googleSheetsService, orderId, userStateId, userStateCreatedAt }: {
    googleSheetsService: IGoogleSheetsService;
    orderId: string;
    userStateId: string;
    userStateCreatedAt: string;
}): Promise<void> { return sessions.completeOrderProducts(createContext(googleSheetsService).context, { orderId, userStateId, userStateCreatedAt }, runtime); }
export async function completeOrderTotalPrice({ googleSheetsService, orderId, userStateId, totalPrice }: {
    googleSheetsService: IGoogleSheetsService;
    orderId: string;
    userStateId: string;
    totalPrice: string;
}): Promise<void> { return sessions.completeOrderTotalPrice(createContext(googleSheetsService).context, { orderId, userStateId, totalPrice }, runtime); }
export async function replyText(line: ILineBotService, event: LineEvent, text: string, choices: string[][] = []): Promise<void> { return executeReply(line, event, text, choices); }
export async function handleCompleteBillLineEvent({ event, lineBotService, getGoogleSheetsService, resolvedUserStates, }: {
    event: LineEvent;
    lineBotService: LineBotService;
    getGoogleSheetsService: () => IGoogleSheetsService;
    resolvedUserStates: Map<LineEvent, UserState>;
}): Promise<void> {
    return billEvents.handleCompleteBillLineEvent({ event, lineBotService, getContext: () => createContext(getGoogleSheetsService()).context, resolvedUserStates, runtime });
}
export async function handleCompleteProductsLineEvent({ event, lineBotService, getGoogleSheetsService, resolvedUserStates, }: {
    event: LineEvent;
    lineBotService: LineBotService;
    getGoogleSheetsService: () => IGoogleSheetsService;
    resolvedUserStates: Map<LineEvent, UserState>;
}): Promise<void> {
    return productEvents.handleCompleteProductsLineEvent({ event, lineBotService, getContext: () => createContext(getGoogleSheetsService()).context, resolvedUserStates, runtime });
}
export async function handleCreateOrderLineEvent({ event, lineBotService, getGoogleSheetsService, resolvedUserStates, }: {
    event: LineEvent;
    lineBotService: LineBotService;
    getGoogleSheetsService: () => IGoogleSheetsService;
    resolvedUserStates: Map<LineEvent, UserState>;
}): Promise<void> {
    return createEvents.handleCreateOrderLineEvent({ event, lineBotService, getContext: () => createContext(getGoogleSheetsService()).context, resolvedUserStates, runtime });
}
export async function handleOrderBillImageLineEvent({ event, lineBotService, googleSheetsService, googleDriveService, userState, }: {
    event: LineEvent;
    lineBotService: LineBotService;
    googleSheetsService: IGoogleSheetsService;
    googleDriveService: IGoogleDriveService | undefined;
    userState: UserState;
}): Promise<void> {
    return billImages.handleOrderBillImageLineEvent({ event, lineBotService, context: createContext(googleSheetsService).context, storage: googleDriveService, userState, runtime });
}
export async function handleOrderProductImageLineEvent({ event, lineBotService, googleSheetsService, googleDriveService, userState, }: {
    event: LineEvent;
    lineBotService: LineBotService;
    googleSheetsService: IGoogleSheetsService;
    googleDriveService: IGoogleDriveService | undefined;
    userState: UserState;
}): Promise<void> {
    return productImages.handleOrderProductImageLineEvent({ event, lineBotService, context: createContext(googleSheetsService).context, storage: googleDriveService, userState, runtime });
}
export async function handleOrderTotalPriceLineEvent({ event, lineBotService, googleSheetsService, userState, }: {
    event: LineEvent;
    lineBotService: LineBotService;
    googleSheetsService: IGoogleSheetsService;
    userState: UserState;
}): Promise<void> {
    return totalEvents.handleOrderTotalPriceLineEvent({ event, lineBotService, context: createContext(googleSheetsService).context, userState, runtime });
}
import { processWebhookEvents } from "./application/webhook";
export async function processLineWebhook({ events, lineBotService, getGoogleSheetsService, getGoogleDriveService, getCreateMode, getPublicBaseUrl }: {
    events: LineEvent[] | undefined;
    lineBotService: LineBotService;
    getGoogleSheetsService: () => IGoogleSheetsService;
    getGoogleDriveService: () => IGoogleDriveService | undefined;
    getCreateMode: () => AppConfig['movementCreateMode'];
    getPublicBaseUrl: () => string;
}) { return processWebhookEvents({ events, lineBotService, getContext: () => createContext(getGoogleSheetsService()).context, getImages: getGoogleDriveService, getCreateMode, getPublicBaseUrl, runtime }); }
