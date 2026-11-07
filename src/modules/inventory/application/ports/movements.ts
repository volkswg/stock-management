import type { ProductMovementRecord, ProductMovementMasterRecord } from "../../contracts";
export interface MovementItemEdit {
    quantity(value: string): void;
    remark(value: string): void;
    stockCounted(value: boolean): void;
    isNewArrival(value: boolean): void;
    image(value: string): void;
    updatedAt(value: string): void;
    save(): Promise<void>;
}
export interface MovementItemReference {
    remark(): string;
    edit(): MovementItemEdit;
    delete(): Promise<void>;
}
export interface MovementDetails {
    records(): ProductMovementRecord[];
    find(itemId: string, masterId: string): MovementItemReference | undefined;
    matching(masterId: string): {
        hasItems: boolean;
        someQuantity(predicate: (quantity: string) => boolean): boolean;
        deliver(now: string): Promise<void>;
    };
}
export interface MovementMasterProjection {
    project(details: ProductMovementRecord[]): ProductMovementMasterRecord;
}
export interface MovementMasterEdit extends MovementMasterProjection {
    quantity(value: string): void;
    delivered(now: string): void;
    updatedAt(value: string): void;
    save(): Promise<void>;
}
export interface MovementMasters {
    entries(): Array<MovementMasterProjection & {
        id(): string;
    }>;
    find(masterId: string): {
        edit(): MovementMasterEdit;
    } | undefined;
}
export interface MovementStore {
    prepareMasters(): Promise<void>;
    prepareDetails(): Promise<void>;
    readMasters(mode: 'list' | 'edit'): Promise<MovementMasters>;
    readDetails(mode: 'list' | 'edit'): Promise<MovementDetails>;
    exists(masterId: string): Promise<boolean>;
}
export type MovementRuntime = {
    now(): string;
};
