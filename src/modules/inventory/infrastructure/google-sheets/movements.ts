import "server-only";
import type { GoogleSheetRow, IGoogleRowsSheet } from "@/infrastructure/persistence/google-sheets/types";
import type { ProductMovementRecord, ProductMovementMasterRecord } from "../../contracts";
import type { MovementStore, MovementItemReference, MovementMasterEdit } from "../../application/ports/movements";
import { sumQuantity, toNumber } from "../../domain/movement-rules";
import { MASTER_HEADERS, DETAIL_HEADERS, ensureHeader } from "./movement-schema";
type MovementSheets = {
    movementMasters: IGoogleRowsSheet;
    movementDetails: IGoogleRowsSheet;
};
export function createMovementStore(service: MovementSheets): MovementStore {
    function itemReference(rows: GoogleSheetRow[], index: number): MovementItemReference {
        return { remark: () => cell(rows[index][4]), async delete() { const sheet = service.movementDetails; if (!sheet.deleteRow)
                throw new Error("Movement row deletion is unavailable."); await sheet.deleteRow(index + 1); }, edit() {
                const nextRow = [...rows[index]];
                while (nextRow.length < DETAIL_HEADERS.length)
                    nextRow.push("");
                return { quantity: v => { nextRow[3] = v; }, remark: v => { nextRow[4] = v; }, stockCounted: v => { nextRow[12] = v; }, isNewArrival: v => { nextRow[13] = v; }, image: v => { nextRow[7] = v; }, updatedAt: v => { nextRow[11] = v; }, save: () => service.movementDetails.updateRows(`A${index + 1}:N${index + 1}`, [nextRow]) };
            } };
    }
    function masterEdit(row: GoogleSheetRow, index: number): MovementMasterEdit {
        const nextRow = [...row];
        while (nextRow.length < MASTER_HEADERS.length)
            nextRow.push("");
        return { project: details => rowToMovementMaster(nextRow, details), quantity: v => { nextRow[5] = v; }, delivered: now => { nextRow[3] = now; nextRow[4] = "delivered"; nextRow[7] = now; }, updatedAt: v => { nextRow[7] = v; }, save: () => service.movementMasters.updateRows(`A${index + 1}:H${index + 1}`, [nextRow]) };
    }
    return {
        prepareMasters: () => ensureHeader(service.movementMasters, MASTER_HEADERS, "H"), prepareDetails: () => ensureHeader(service.movementDetails, DETAIL_HEADERS, "N"),
        async exists(masterId) { const rows = await service.movementMasters.readRows("A2:A"); return rows.some(row => cell(row[0]).toUpperCase() === masterId.toUpperCase()); },
        async readMasters(mode) {
            const rows = await service.movementMasters.readRows(mode === 'list' ? "A2:H" : "A:H");
            return {
                entries: () => rows.map(row => ({ id: () => cell(row[0]), project: (details: ProductMovementRecord[]) => rowToMovementMaster(row, details) })),
                find(masterId) { const index = rows.findIndex((row, index) => index > 0 && cell(row[0]).toUpperCase() === masterId.toUpperCase()); return index < 0 ? undefined : { edit: () => masterEdit(rows[index], index) }; }
            };
        },
        async readDetails(mode) {
            const rows = await service.movementDetails.readRows(mode === 'list' ? "A2:N" : "A:N");
            return {
                records: () => rows.map(rowToMovement),
                find(itemId, masterId) { const index = rows.findIndex((row, index) => index > 0 && cell(row[0]).toUpperCase() === itemId.toUpperCase() && cell(row[1]).toUpperCase() === masterId.toUpperCase()); return index < 0 ? undefined : itemReference(rows, index); },
                matching(masterId) { const indexes = rows.flatMap((row, index) => index > 0 && cell(row[1]).toUpperCase() === masterId.toUpperCase() ? [index] : []); return { hasItems: indexes.length > 0, someQuantity: predicate => indexes.some(index => predicate(cell(rows[index][3]))), async deliver(now) { await Promise.all(indexes.map(index => { const nextRow = [...rows[index]]; while (nextRow.length < DETAIL_HEADERS.length)
                        nextRow.push(""); nextRow[9] = "delivered"; nextRow[11] = now; return service.movementDetails.updateRows(`A${index + 1}:N${index + 1}`, [nextRow]); })); } }; }
            };
        }
    };
}

function rowToMovement(row: GoogleSheetRow): ProductMovementRecord {
  return {
    movementId: cell(row[0]),
    movementMasterId: cell(row[1]),
    shopName: cell(row[2]),
    quantity: cell(row[3]),
    remark: cell(row[4]),
    fromLocation: cell(row[5]),
    toLocation: cell(row[6]),
    productImageUrl: cell(row[7]),
    purchaseDetailId: cell(row[8]),
    status: cell(row[9]).toLowerCase() === "delivered" ? "delivered" : "created",
    createdAt: cell(row[10]),
    updatedAt: cell(row[11]),
    stockCounted: booleanCell(row[12]),
    isNewArrival: booleanCell(row[13]),
  };
}

function rowToMovementMaster(
  row: GoogleSheetRow,
  details: ProductMovementRecord[],
): ProductMovementMasterRecord {
  const status = cell(row[4]).toLowerCase();
  return {
    id: cell(row[0]),
    userId: cell(row[1]),
    packingDate: cell(row[2]),
    deliverDateTime: cell(row[3]) || undefined,
    status:
      status === "delivered"
        ? "delivered"
        : status === "in_progress"
          ? "in_progress"
          : "created",
    totalQuantity: cell(row[5]) || String(sumQuantity(details)),
    createdAt: cell(row[6]),
    updatedAt: cell(row[7]),
    itemCount: details.length,
    shopQuantities: details.reduce<Record<string, number>>((totals, detail) => {
      const shop = detail.shopName || "Unknown";
      totals[shop] = (totals[shop] || 0) + toNumber(detail.quantity);
      return totals;
    }, {}),
  };
}

function cell(value: GoogleSheetRow[number]): string {
  return value === null || value === undefined ? "" : String(value);
}

function booleanCell(value: GoogleSheetRow[number]): boolean {
  return value === true || cell(value).toLowerCase() === "true";
}
