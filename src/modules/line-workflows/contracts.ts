import type { OrderStatus } from "@/modules/orders/contracts";
import type { LineEvent } from "@/shared/types/line-protocol";
export enum UserStateFlowName {
    OrderCreate = "OrderCreate"
}
export type UserState = {
    id: string;
    userId: string;
    flowname: UserStateFlowName;
    referenceId: string;
    state: OrderStatus;
    createdAt: string;
    updatedAt: string;
};
export const MOVEMENT_FLOW = "MovementCreate";
export type MovementStep = "shop" | "quantity" | "product_image" | "close_bag" | "bag_closed" | "complete";
export type MovementState = {
    masterId: string;
    itemId: string;
    userId: string;
    step: MovementStep;
    startedAt: string;
    shop: string;
    quantity: string;
    remark: string;
    imageUrl: string;
    lastEventId: string;
};
export enum LineTextCommand {
    CreateOrder = "create-order",
    CompleteBill = "complete-bill",
    CompleteProducts = "complete-products",
    Unknown = "unknown"
}
export enum MovementStartCommandEnum {
    CreateMovement = "create:movement",
    CreateNewMovement = "create:new-movement",
    ResumeMovement = "resume:movement"
}
export enum EventKindEnum {
    Movement = "movement",
    Order = "order"
}
export type MovementImageUploadProgress = {
    messageId: string;
    uploaded: boolean;
    saved: boolean;
    alreadySaved: boolean;
    completed: boolean;
    failed: boolean;
    ignored: boolean;
    saveUncertain: boolean;
    shop?: string;
    shopPhotosSaved?: number;
    movementPhotosSaved?: number;
};
export type MovementCreateMode = 'quantity_photo' | 'photo_only';
export type WorkflowMovementEvent = LineEvent & {
    message: NonNullable<LineEvent['message']>;
    source: NonNullable<LineEvent['source']> & {
        userId: string;
    };
};
import type { MovementJourneyItem } from "@/modules/inventory/contracts";
export type MovementEventClassification = {
    kind: EventKindEnum.Movement;
    event: WorkflowMovementEvent;
    session: {
        state?: MovementState;
        processed: boolean;
        photoItems?: MovementJourneyItem[];
    };
};
export type LineEventClassification = MovementEventClassification | {
    kind: EventKindEnum.Order;
};
