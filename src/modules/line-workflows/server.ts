import "server-only";
import { processPostgresWebhook } from "./infrastructure/postgres/webhook";
import type { Storage } from "./infrastructure/postgres/storage";
import type { IGoogleDriveService } from "@/infrastructure/files/google-drive/types";
import type { LineBotService } from "@/infrastructure/external/line";
import type { LineEvent } from "@/shared/types/line-protocol";
import type { AppConfig } from "@/config";
import { createSortableId } from "@/infrastructure/runtime/create-sortable-id";
import { createDraftRecord, createOrderBill, createOrderItem, prepareOrderTransition, orderExists } from "@/modules/orders/server";
import { createMovementJourneyAdapter, movementJourneyItems, synchronizeMovementJourney, findResumableMovementJourney, appendMovementJourneyItem } from "@/modules/inventory/server";
import type { WorkflowContext } from "./application/ports/workflows";
import { createSessionAdapter } from "./infrastructure/postgres/sessions";
import { createWorkflowRuntime } from "./infrastructure/runtime";
export { parseLineWebhookPayload } from "./infrastructure/payload";
const runtime = createWorkflowRuntime(createSortableId);
function createContext(storage: Storage) {
    const inventory = createMovementJourneyAdapter(storage), adapter = createSessionAdapter(storage, inventory);
    const context: WorkflowContext = { sessions: adapter.orders, movements: adapter.movements,
        orders: { draft: createdBy => createDraftRecord({ storage: storage, createdBy }), bill: input => createOrderBill({ ...input, storage: storage }), item: input => createOrderItem({ ...input, storage: storage }), transition: orderId => prepareOrderTransition({ storage: storage, orderId }), exists: orderId => orderExists({ storage: storage, orderId }) },
        inventory: { items: masterId => movementJourneyItems(storage, masterId), sync: (state, complete) => synchronizeMovementJourney(storage, state, complete), resumable: userId => findResumableMovementJourney(storage, userId), append: readItem => appendMovementJourneyItem(storage, readItem) }, photoContext: adapter.photoContext };
    return { context, adapter, inventory };
}
export async function processLineWebhook({ events, lineBotService, getStorage, getGoogleDriveService, getCreateMode, getPublicBaseUrl }: {
    events: LineEvent[] | undefined;
    lineBotService: LineBotService;
    getStorage: () => Storage;
    getGoogleDriveService: () => IGoogleDriveService | undefined;
    getCreateMode: () => AppConfig['movementCreateMode'];
    getPublicBaseUrl: () => string;
}) { return processPostgresWebhook({ events, lineBotService, getContext: () => createContext(getStorage()).context, getImages: getGoogleDriveService, getCreateMode, getPublicBaseUrl, runtime }); }
