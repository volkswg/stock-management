import "server-only";
import type { RecordValue, NativeRecord } from "@/infrastructure/persistence/postgres/native-records";
import type { ProductMovementRecord, ProductMovementMasterRecord } from "../../contracts";
import type { MovementStore, MovementItemReference, MovementMasterEdit } from "../../application/ports/movements";
import { sumQuantity, toNumber } from "../../domain/movement-rules";
import type { Storage } from "./storage";
export function createMovementStore(storage: Pick<Storage, "movementMasters" | "movementDetails">): MovementStore {
  type Detail = Parameters<Storage["movementDetails"]["update"]>[0];
  type Master = Parameters<Storage["movementMasters"]["update"]>[0];
  function itemReference(record: Detail): MovementItemReference {
    return { remark: () => cell(record.remark), delete: () => storage.movementDetails.softDelete(record), edit() {
      const next = { ...record };
      return { quantity: v => { next.quantity = v; }, remark: v => { next.remark = v; }, stockCounted: v => { next.stockCounted = v; }, isNewArrival: v => { next.isNewArrival = v; }, image: v => { next.productImageUrl = v; }, updatedAt: v => { next.updatedAt = v; }, save: () => storage.movementDetails.update(record, next) };
    } };
  }
  function masterEdit(record: Master): MovementMasterEdit {
    const next = { ...record };
    return { project: details => rowToMovementMaster(next, details), quantity: v => { next.totalQuantity = v; }, delivered: now => { next.deliverDateTime = now; next.status = "delivered"; next.updatedAt = now; }, updatedAt: v => { next.updatedAt = v; }, save: () => storage.movementMasters.update(record, next) };
  }
  return {
    prepareMasters: () => storage.movementMasters.prepare(), prepareDetails: () => storage.movementDetails.prepare(),
    async exists(masterId) { return (await storage.movementMasters.all()).some(r => cell(r.id).toUpperCase() === masterId.toUpperCase()); },
    async readMasters() {
      const records = await storage.movementMasters.all();
      return { entries: () => records.map(record => ({ id: () => cell(record.id), project: (details: ProductMovementRecord[]) => rowToMovementMaster(record, details) })), find(id) { const record = records.find(r => cell(r.id).toUpperCase() === id.toUpperCase()); return record ? { edit: () => masterEdit(record) } : undefined; } };
    },
    async readDetails() {
      const records = await storage.movementDetails.all();
      return { records: () => records.map(rowToMovement), find(itemId, masterId) { const record = records.find(r => cell(r.id).toUpperCase() === itemId.toUpperCase() && cell(r.movementMasterId).toUpperCase() === masterId.toUpperCase()); return record ? itemReference(record) : undefined; }, matching(masterId) {
        const matches = records.filter(r => cell(r.movementMasterId).toUpperCase() === masterId.toUpperCase());
        return { hasItems: matches.length > 0, someQuantity: predicate => matches.some(r => predicate(cell(r.quantity))), async deliver(now) { for (const record of matches) await storage.movementDetails.update(record, { status: "delivered", updatedAt: now }); } };
      } };
    },
  };
}
function rowToMovement(row: NativeRecord): ProductMovementRecord {
  return {
    movementId: cell(row.id),
    movementMasterId: cell(row.movementMasterId),
    shopName: cell(row.shopName),
    quantity: cell(row.quantity),
    remark: cell(row.remark),
    fromLocation: cell(row.fromLocation),
    toLocation: cell(row.toLocation),
    productImageUrl: cell(row.productImageUrl),
    // Retired storage relationship; preserve the existing public response field.
    purchaseDetailId: "",
    status: cell(row.status).toLowerCase() === "delivered" ? "delivered" : "created",
    createdAt: cell(row.createdAt),
    updatedAt: cell(row.updatedAt),
    stockCounted: booleanCell(row.stockCounted),
    isNewArrival: booleanCell(row.isNewArrival),
  };
}

function rowToMovementMaster(
  row: NativeRecord,
  details: ProductMovementRecord[],
): ProductMovementMasterRecord {
  const status = cell(row.status).toLowerCase();
  return {
    id: cell(row.id),
    userId: cell(row.userId),
    packingDate: cell(row.packingDate),
    deliverDateTime: cell(row.deliverDateTime) || undefined,
    status:
      status === "delivered"
        ? "delivered"
        : status === "in_progress"
          ? "in_progress"
          : "created",
    totalQuantity: cell(row.totalQuantity) || String(sumQuantity(details)),
    createdAt: cell(row.createdAt),
    updatedAt: cell(row.updatedAt),
    itemCount: details.length,
    shopQuantities: details.reduce<Record<string, number>>((totals, detail) => {
      const shop = detail.shopName || "Unknown";
      totals[shop] = (totals[shop] || 0) + toNumber(detail.quantity);
      return totals;
    }, {}),
  };
}

function cell(value: RecordValue): string {
  return value === null || value === undefined ? "" : String(value);
}

function booleanCell(value: RecordValue): boolean {
  return value === true || cell(value).toLowerCase() === "true";
}
