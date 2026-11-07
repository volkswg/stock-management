import type { SalesProfitCostOverride } from "../../contracts";
export interface CostOverrideSnapshot {
  records(): SalesProfitCostOverride[];
  find(month: string, accountId: string): { current(): SalesProfitCostOverride | null; replace(value: SalesProfitCostOverride): Promise<void>; clear(): Promise<void> } | undefined;
}
export interface CostOverrideStore {
  prepare(): Promise<void>;
  read(): Promise<CostOverrideSnapshot>;
  append(value: SalesProfitCostOverride): Promise<void>;
}
export type CostOverrideRuntime = { now(): string; uuid(): string };
