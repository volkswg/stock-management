import "server-only";
import type { NativeRecord } from "@/infrastructure/persistence/postgres/native-records";
import type { StockCountRecord } from "../../contracts";
import type { StockCountStore } from "../../application/ports/stock-counts";
import type { Storage } from "./storage";
export function createStockCountStore(storage: Pick<Storage, "stockCounts">): StockCountStore {
  const table = storage.stockCounts;
  const named = (value: StockCountRecord) => ({ id: value.id, month: value.month, accountId: value.accountId, shopName: value.shopName, physicalCount: value.physicalCount, note: value.note, countedAt: value.countedAt, updatedAt: value.updatedAt, updatedBy: value.updatedBy });
  return { prepare: () => table.prepare(), async read() {
    const records = await table.all();
    return { records: () => records.map(mapStockCountRow).filter((r): r is StockCountRecord => Boolean(r)), find(month, accountId) {
      const record = records.find(r => toStringValue(r.month) === month && toStringValue(r.accountId) === accountId);
      if (!record) return undefined;
      return { record: () => mapStockCountRow(record), save: value => table.update(record, named(value)) };
    } };
  }, append: value => table.insert(named(value)) };
}
function mapStockCountRow(row: NativeRecord): StockCountRecord | null {
  if (row.id === "id") return null; // Preserve the existing reserved-identity filter.
  const id = toStringValue(row.id);
  const month = toStringValue(row.month);
  const accountId = toStringValue(row.accountId);
  const physicalCount = Number(row.physicalCount);
  if (!id || !month || !accountId || !Number.isFinite(physicalCount)) {
    return null;
  }
  return {
    id,
    month,
    accountId,
    shopName: toStringValue(row.shopName),
    physicalCount,
    note: toStringValue(row.note),
    countedAt: toStringValue(row.countedAt),
    updatedAt: toStringValue(row.updatedAt),
    updatedBy: toStringValue(row.updatedBy),
  };
}

function toStringValue(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}
