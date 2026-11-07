import type { StockAdjustment, AdjustmentEmployee } from "../../contracts";
export interface AdjustmentStore {
    read(): Promise<{
        records(): Iterable<StockAdjustment>;
    }>;
    append(value: StockAdjustment): Promise<void>;
}
export interface AdjustmentEmployees {
    listEmployees(): Promise<AdjustmentEmployee[]>;
}
export type AdjustmentRuntime = {
    now(): string;
    today(): string;
};
