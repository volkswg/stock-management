import "server-only";
import type { NativeRecord } from "@/infrastructure/persistence/postgres/native-records";
import type { SalesProfitCostOverride } from "../../contracts";
import type { CostOverrideStore } from "../../application/ports/cost-overrides";
import type { Storage } from "./storage";
export function createCostOverrideStore(storage: Pick<Storage, "salesProfitCostOverrides">): CostOverrideStore {
  const table = storage.salesProfitCostOverrides;
  const named = (value: SalesProfitCostOverride) => ({ id: value.id, month: value.month, accountId: value.accountId, averageItemCost: value.averageItemCost, note: value.note, createdAt: value.createdAt, updatedAt: value.updatedAt, createdBy: value.createdBy });
  return { prepare: () => table.prepare(), async read() {
    const records = await table.all();
    return { records: () => records.map(mapCostOverrideRow).filter((r): r is SalesProfitCostOverride => Boolean(r)), find(month, accountId) {
      const record = records.find(r => toStringValue(r.month) === month && toStringValue(r.accountId) === accountId);
      if (!record) return undefined;
      return { current: () => mapCostOverrideRow(record), replace: value => table.update(record, named(value)), clear: () => table.softDelete(record) };
    } };
  }, append: value => table.insert(named(value)) };
}
function mapCostOverrideRow(
  row: NativeRecord,
): SalesProfitCostOverride | null {
  if (row.id === "id") return null; // Preserve the existing reserved-identity filter.
  const id = toStringValue(row.id);
  const month = toStringValue(row.month);
  const accountId = toStringValue(row.accountId);
  if (!id || !month || !accountId) return null;
  return {
    id,
    month,
    accountId,
    averageItemCost: toNumberValue(row.averageItemCost),
    note: toStringValue(row.note),
    createdAt: toStringValue(row.createdAt),
    updatedAt: toStringValue(row.updatedAt),
    createdBy: toStringValue(row.createdBy),
  };
}

function toStringValue(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function toNumberValue(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}
