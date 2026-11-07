import type { OrderStatus, Order, OrderBill, OrderItem } from "@/modules/orders/contracts";
import type { MovementJourneyItem } from "@/modules/inventory/contracts";
import type { LineReplyMessage } from "@/shared/types/line-protocol";
import type { MovementState, UserState, UserStateFlowName } from "../../contracts";
export type SessionValue = string | number | boolean | null | undefined;
export interface SessionEntry {
    readonly id: SessionValue;
    readonly referenceId: SessionValue;
    readonly step: SessionValue;
    readonly createdAt: SessionValue;
    readonly context: SessionValue;
}
export type MovementSessionWrite = {
    id: SessionValue;
    userId: string;
    flowname: string;
    referenceId: string;
    state: string;
    createdAt: SessionValue;
    updatedAt: string;
    context: string;
};
export interface MovementSessionSnapshot {
    latestForReading(userId: string): SessionEntry | undefined;
    findForWriting(readUserId: () => string): SessionEntry | undefined;
    nextIdentifier(): string;
    eraseMovement(userId: string): Promise<void>;
    writeMovement(target: SessionEntry | undefined, value: MovementSessionWrite): Promise<void>;
}
export interface MovementSessionStore {
    read(): Promise<MovementSessionSnapshot>;
}
export interface OrderSessionReference {
    update(state: OrderStatus, createdAt: string, now: string): Promise<void>;
    clear(): Promise<void>;
}
export interface OrderSessionStore {
    findLatest(userId: string, flowname: UserStateFlowName): Promise<UserState | undefined>;
    nextIdentifier(): Promise<string>;
    append(value: UserState): Promise<void>;
    reference(id: string): OrderSessionReference;
}
export interface OrderTransition {
    status(state: OrderStatus): Promise<void>;
    touch(now: string): Promise<void>;
    price(value: string): Promise<void>;
}
export interface WorkflowOrders {
    draft(createdBy: string): Promise<Order>;
    bill(input: {
        orderId: string;
        imageUrl: string;
        createdBy: string;
    }): Promise<OrderBill>;
    item(input: {
        orderId: string;
        imageUrl: string;
        createdBy: string;
    }): Promise<OrderItem>;
    transition(orderId: string): Promise<OrderTransition>;
    exists(orderId: string): Promise<boolean>;
}
export interface WorkflowInventory {
    items(masterId: string): Promise<MovementJourneyItem[]>;
    sync(state: MovementState, complete?: boolean): Promise<MovementJourneyItem[]>;
    resumable(userId: string): Promise<{
        masterId: string;
        items: MovementJourneyItem[];
        startedAt(): string;
    } | undefined>;
    append(readItem: () => MovementJourneyItem): Promise<void>;
}
export interface WorkflowContext {
    sessions: OrderSessionStore;
    movements: MovementSessionStore;
    orders: WorkflowOrders;
    inventory: WorkflowInventory;
    photoContext(): Promise<{
        sessions: MovementSessionSnapshot;
        items(readMasterId: () => string | undefined): MovementJourneyItem[];
    }>;
}
export interface WorkflowLine<Bytes> {
    sendReply(replyToken: string | undefined, messages: LineReplyMessage[]): Promise<void>;
    downloadMessageContent(messageId: string): Promise<{
        contentType: string;
        bytes: Bytes;
    }>;
}
export interface WorkflowImages<Bytes> {
    uploadImage(input: {
        fileName: string;
        contentType: string;
        bytes: Bytes;
    }): Promise<{
        id: string;
        webViewLink: string;
    }>;
}
export interface WorkflowRuntime {
    now(): string;
    createId(): string;
    eventTime(readTimestamp: () => number | undefined): string;
    error(label: string, readDetails: () => Record<string, unknown>): void;
    received(readDetails: () => {
        eventCount: number;
    }): void;
}
