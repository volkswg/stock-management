import "server-only";
import type { StockAdjustment } from "../../contracts";
import { text } from "../../domain/adjustment-rules";
import type { AdjustmentStore } from "../../application/ports/adjustments";
import type { Storage } from "./storage";
export function createAdjustmentStore(storage: Pick<Storage, "stockAdjustments">): AdjustmentStore {
  return { async read() {
    const records = await storage.stockAdjustments.all();
    return { *records() { for (const r of records.filter(r => r.id)) { const a: StockAdjustment = { id: text(r.id), accountId: text(r.accountId), shopName: text(r.shopName), date: text(r.date), direction: text(r.direction) as StockAdjustment["direction"], reason: text(r.reason) as StockAdjustment["reason"], employeeId: text(r.employeeId), employeeName: text(r.employeeName), quantity: Number(r.quantity), itemDescription: text(r.itemDescription), photoUrl: text(r.photoUrl), note: text(r.note), reversesId: text(r.reversesId), replacesId: text(r.replacesId), createdAt: text(r.createdAt), createdBy: text(r.createdBy), notInLoyverse: r.notInLoyverse === true || text(r.notInLoyverse).toLowerCase() === "true" }; yield a; } } };
  }, append: value => storage.stockAdjustments.insert({ id: value.id, accountId: value.accountId, shopName: value.shopName, date: value.date, direction: value.direction, reason: value.reason, employeeId: value.employeeId, employeeName: value.employeeName, quantity: value.quantity, itemDescription: value.itemDescription, photoUrl: value.photoUrl, note: value.note, reversesId: value.reversesId, replacesId: value.replacesId, createdAt: value.createdAt, createdBy: value.createdBy, notInLoyverse: value.notInLoyverse }) };
}
