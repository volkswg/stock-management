import "server-only";
import type { GoogleSheetRow, IGoogleRowsSheet } from "@/infrastructure/persistence/google-sheets/types";
import { STOCK_COUNT_HEADERS } from "./stock-counts/const";
import type { StockCountRecord } from "../../contracts";
import type { StockCountStore } from "../../application/ports/stock-counts";
type IGoogleSheetsService = {
    stockCounts: IGoogleRowsSheet;
};
export function createStockCountStore(googleSheetsService: IGoogleSheetsService): StockCountStore {
    return { prepare: () => ensureStockCountHeaders(googleSheetsService), async read() {
            const rows = await googleSheetsService.stockCounts.readRows();
            return {
                records: () => rows.map(mapStockCountRow).filter((record): record is StockCountRecord => Boolean(record)),
                find(month, accountId) { const rowIndex = rows.findIndex((row, index) => index > 0 && toStringValue(row[1]) === month && toStringValue(row[2]) === accountId); if (rowIndex < 0)
                    return undefined; return { record: () => mapStockCountRow(rows[rowIndex]), save: record => googleSheetsService.stockCounts.updateRows(`A${rowIndex + 1}:I${rowIndex + 1}`, [stockCountToRow(record)]) }; }
            };
        }, append: record => googleSheetsService.stockCounts.appendRows("A:I", [stockCountToRow(record)]) };
}

async function ensureStockCountHeaders(
  googleSheetsService: IGoogleSheetsService,
): Promise<void> {
  await googleSheetsService.stockCounts.ensureExists?.();
  const rows = await googleSheetsService.stockCounts.readRows("A1:I1");
  if (rows[0]?.join("|") !== STOCK_COUNT_HEADERS.join("|")) {
    await googleSheetsService.stockCounts.updateRows("A1:I1", [
      STOCK_COUNT_HEADERS,
    ]);
  }
}

function mapStockCountRow(row: GoogleSheetRow): StockCountRecord | null {
  if (!row.length || row[0] === "id") return null;
  const id = toStringValue(row[0]);
  const month = toStringValue(row[1]);
  const accountId = toStringValue(row[2]);
  const physicalCount = Number(row[4]);
  if (!id || !month || !accountId || !Number.isFinite(physicalCount)) {
    return null;
  }
  return {
    id,
    month,
    accountId,
    shopName: toStringValue(row[3]),
    physicalCount,
    note: toStringValue(row[5]),
    countedAt: toStringValue(row[6]),
    updatedAt: toStringValue(row[7]),
    updatedBy: toStringValue(row[8]),
  };
}

function stockCountToRow(record: StockCountRecord): GoogleSheetRow {
  return [
    record.id,
    record.month,
    record.accountId,
    record.shopName,
    record.physicalCount,
    record.note,
    record.countedAt,
    record.updatedAt,
    record.updatedBy,
  ];
}

function toStringValue(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}
