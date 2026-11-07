import type { IGoogleSheetsService } from "@/externals/google/sheet/types";
import type { IGoogleDriveService } from "@/infrastructure/files/google-drive/types";
import type { LineBotService } from "@/externals/line";
import type { LineEvent, LineReplyMessage } from "@/shared/types/line-protocol";
import type { Order, OrderBill, OrderItem, CreatedOrder } from "@/modules/orders/contracts";
import type { MovementState, UserState } from "@/modules/line-workflows/contracts";
import { UserStateFlowName } from "@/modules/line-workflows/contracts";
import { createDraftOrder, createOrderBill, createOrderItem, createOrderWithImages } from "@/services/orders";
import { handleLineEvent } from "@/services/line/events";
import { saveMovementState, readMovementSession } from "@/services/movements/state";
import type { WorkflowLine } from "@/modules/line-workflows/application/ports/workflows";
import type { OrderItemMutationStore } from "@/modules/orders/application/ports/order-mutations";
export const compatibility: {
 draft(input: { googleSheetsService: IGoogleSheetsService; createdBy: string }): Promise<Order>;
 bill(input: { googleSheetsService: IGoogleSheetsService; orderId: string; imageUrl: string; createdBy: string }): Promise<OrderBill>;
 item(input: { googleSheetsService: IGoogleSheetsService; orderId: string; imageUrl: string; createdBy: string; quoteQuantity?: string; deliveredQuantity?: string; productCode?: string }): Promise<OrderItem>;
 images(input: { googleSheetsService: IGoogleSheetsService; googleDriveService: IGoogleDriveService; createdBy: string; images: {imageType: "bill"|"product"; bytes: Buffer; contentType: string}[] }): Promise<CreatedOrder>;
 event(input: {event: LineEvent; lineBotService: LineBotService; getGoogleSheetsService(): IGoogleSheetsService; getGoogleDriveService(): IGoogleDriveService|undefined; resolvedUserStates: Map<LineEvent,UserState>}): Promise<void>;
 save(sheets: IGoogleSheetsService, state: MovementState): Promise<void>;
 read(sheets: IGoogleSheetsService,userId:string,eventId:string):Promise<{state?:MovementState;processed:boolean}>;
} = {draft:createDraftOrder,bill:createOrderBill,item:createOrderItem,images:createOrderWithImages,event:handleLineEvent,save:saveMovementState,read:readMovementSession};
export const flow: UserStateFlowName = UserStateFlowName.OrderCreate;
export function businessOnly(line: WorkflowLine<Uint8Array>, store: OrderItemMutationStore, messages:LineReplyMessage[]) {
 void line.sendReply("reply",messages);
 // @ts-expect-error Worksheet methods are excluded from the application persistence port.
 void store.updateRows;
}
