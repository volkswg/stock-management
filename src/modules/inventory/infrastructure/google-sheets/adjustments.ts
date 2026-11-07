import "server-only";
import type { GoogleSheetRow, IGoogleRowsSheet } from "@/infrastructure/persistence/google-sheets/types";
import type { StockAdjustment } from "../../contracts";
import { ADJUSTMENT_HEADERS } from "./stock-adjustments/const";
import { StockAdjustmentError, text } from "../../domain/adjustment-rules";
import type { AdjustmentStore } from "../../application/ports/adjustments";
type AdjustmentSheets = {
    stockAdjustments: IGoogleRowsSheet;
};
export function createAdjustmentStore(service: AdjustmentSheets): AdjustmentStore {
    return { async read() {
            const rows = await readRows(service);
            return { *records() {
                    for (const r of rows.slice(1).filter(r => r[0])) {
                        const a: StockAdjustment = { id: text(r[0]), accountId: text(r[1]), shopName: text(r[2]), date: text(r[3]), direction: text(r[4]) as StockAdjustment["direction"], reason: text(r[5]) as StockAdjustment["reason"], employeeId: text(r[6]), employeeName: text(r[7]), quantity: Number(r[8]), itemDescription: text(r[9]), photoUrl: text(r[10]), note: text(r[11]), reversesId: text(r[12]), replacesId: text(r[13]), createdAt: text(r[14]), createdBy: text(r[15]), notInLoyverse: r[16] === true || text(r[16]).toLowerCase() === "true" };
                        yield a;
                    }
                } };
        }, append: a => append(service, a) };
}

async function readRows(service: AdjustmentSheets): Promise<GoogleSheetRow[]> {
  let rows: GoogleSheetRow[];
  try { rows = await service.stockAdjustments.readRows("A:Q"); } catch (error) {
    if (error instanceof Error && /Google Sheets API request failed: 400/.test(error.message) && /Unable to parse range/.test(error.message)) return [];
    throw error;
  }
  if (rows.length && rows[0]?.slice(0, ADJUSTMENT_HEADERS.length).join("|") !== ADJUSTMENT_HEADERS.join("|")) throw new StockAdjustmentError("Stock adjustment headers do not match. No history was changed.", 503);
  return rows;
}
async function append(service: AdjustmentSheets, a: StockAdjustment) {
  await service.stockAdjustments.ensureExists?.();
  const rows = await readRows(service);
  if (!rows.length) await service.stockAdjustments.updateRows("A1:Q1", [ADJUSTMENT_HEADERS]);
  await service.stockAdjustments.appendRows("A:Q", [[a.id, a.accountId, a.shopName, a.date, a.direction, a.reason, a.employeeId, a.employeeName, a.quantity, a.itemDescription, a.photoUrl, a.note, a.reversesId, a.replacesId, a.createdAt, a.createdBy, a.notInLoyverse]]);
}
