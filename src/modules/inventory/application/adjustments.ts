import type { StockAdjustment, StockCountAccount } from "../contracts";
import { ADJUSTMENT_REASONS } from "../contracts";
import { StockAdjustmentError, validDate, validQuantity, text, inputObject, field, photo, payload } from "../domain/adjustment-rules";
import type { AdjustmentStore, AdjustmentEmployees, AdjustmentRuntime } from "./ports/adjustments";
export async function listStockAdjustments(store: AdjustmentStore): Promise<StockAdjustment[]> {
  const snapshot = await store.read(), unique = new Map<string, StockAdjustment>();
  for (const a of snapshot.records()) {
    if (!a.accountId || !validDate(a.date) || !validQuantity(a.quantity) || !["in", "out"].includes(a.direction) || (!Object.hasOwn(ADJUSTMENT_REASONS, a.reason) && a.reason !== "reversal") || !a.notInLoyverse) throw new StockAdjustmentError("Invalid stock adjustment history. Check storage before continuing.", 503);
    if (["employee_gift", "damage", "sample", "personal_use"].includes(a.reason) && a.direction !== "out" || a.reason === "employee_return" && a.direction !== "in" || ["employee_gift", "employee_return"].includes(a.reason) && !a.employeeId || !Number.isFinite(Date.parse(a.createdAt)) || !a.createdBy) throw new StockAdjustmentError("Invalid adjustment reason, employee or audit metadata.", 503);
    try { photo(a.photoUrl); } catch { throw new StockAdjustmentError("Invalid photo link in stock history.", 503); }
    const old = unique.get(a.id);
    if (old && payload(old) !== payload(a)) throw new StockAdjustmentError("Conflicting adjustment IDs in storage.", 503);
    if (!old) unique.set(a.id, a);
  }
  const records = [...unique.values()], replacements = new Set<string>();
  for (const a of records) {
    if (a.reason === "reversal") {
      const original = unique.get(a.reversesId);
      if (!original || original.reason === "reversal" || a.id !== `REV-${original.id}` || a.accountId !== original.accountId || a.date !== original.date || a.quantity !== original.quantity || a.direction === original.direction || a.replacesId) throw new StockAdjustmentError("Invalid adjustment reversal history.", 503);
    } else if (a.reversesId) throw new StockAdjustmentError("Invalid reversal reference.", 503);
    if (a.replacesId) {
      if (!unique.has(a.replacesId) || a.replacesId === a.id || !unique.has(`REV-${a.replacesId}`) || replacements.has(a.replacesId)) throw new StockAdjustmentError("Conflicting replacement adjustment history.", 503);
      replacements.add(a.replacesId);
    }
  }
  return records.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}
export async function createStockAdjustment(store: AdjustmentStore, accounts: StockCountAccount[], value: unknown, employees: AdjustmentEmployees, runtime: AdjustmentRuntime) {
  inputObject(value);
  if (typeof value.requestId !== "string" || !/^[a-f0-9-]{36}$/i.test(value.requestId) || typeof value.accountId !== "string" || !validDate(value.date) || value.date > runtime.today() || !validQuantity(value.quantity) || !["in", "out"].includes(text(value.direction)) || typeof value.reason !== "string" || !Object.hasOwn(ADJUSTMENT_REASONS, value.reason)) throw new StockAdjustmentError("Select a shop, real non-future date, reason, direction and positive whole-unit quantity.");
  if (value.notInLoyverse !== true) throw new StockAdjustmentError("Do not duplicate a Loyverse entry. Confirm this change is not already recorded there.");
  if (["employee_gift", "damage", "sample", "personal_use"].includes(value.reason) && value.direction !== "out" || value.reason === "employee_return" && value.direction !== "in") throw new StockAdjustmentError("Use stock out for gifts, damage, samples or personal use, and stock in for employee returns.");
  const employeeId = field(value.employeeId, 150), replacesId = field(value.replacesId, 150);
  if (["employee_gift", "employee_return"].includes(value.reason) && !employeeId) throw new StockAdjustmentError("Select the employee receiving or returning the items.");
  const candidate: StockAdjustment = { id: `SAJ-${value.requestId}`, accountId: value.accountId, shopName: "", date: value.date, direction: value.direction as StockAdjustment["direction"], reason: value.reason as StockAdjustment["reason"], employeeId, employeeName: "", quantity: value.quantity, itemDescription: field(value.itemDescription, 250), photoUrl: photo(value.photoUrl), note: field(value.note, 500), reversesId: "", replacesId, createdAt: runtime.now(), createdBy: "web-owner", notInLoyverse: true };
  const records = await listStockAdjustments(store), existing = records.find(a => a.id === candidate.id);
  if (existing) { if (payload(existing) !== payload(candidate)) throw new StockAdjustmentError("Save identifier already used for different adjustment details.", 409); return existing; }
  const account = accounts.find(a => a.id === candidate.accountId);
  if (!account) throw new StockAdjustmentError("Select a configured stock-count shop.");
  candidate.shopName = account.shopName;
  if (employeeId) {
    const employee = (await employees.listEmployees()).find(e => e.id === employeeId);
    if (!employee || employee.hiredDate > candidate.date || (employee.terminatedDate && employee.terminatedDate < candidate.date)) throw new StockAdjustmentError("Select an employee employed on the adjustment date.");
    candidate.employeeName = employee.name;
  }
  if (replacesId) {
    const original = records.find(a => a.id === replacesId);
    if (!original || original.reason === "reversal" || !records.some(a => a.reversesId === replacesId)) throw new StockAdjustmentError("Reverse the original adjustment before recording its replacement.");
    if (records.some(a => a.replacesId === replacesId)) throw new StockAdjustmentError("A replacement already exists for this adjustment.", 409);
  }
  await store.append(candidate); return candidate;
}
export async function reverseStockAdjustment(store: AdjustmentStore, value: unknown, runtime: AdjustmentRuntime) {
  inputObject(value); const id = field(value.id, 150), note = field(value.note, 500);
  if (!id || !note) throw new StockAdjustmentError("Select an adjustment and enter a reversal reason.");
  const records = await listStockAdjustments(store), original = records.find(a => a.id === id);
  if (!original) throw new StockAdjustmentError("Adjustment not found.", 404);
  if (original.reason === "reversal") throw new StockAdjustmentError("A reversal cannot itself be reversed. Record a new adjustment instead.");
  const existing = records.find(a => a.reversesId === id); if (existing) return existing;
  const reversal: StockAdjustment = { ...original, id: `REV-${id}`, direction: original.direction === "out" ? "in" : "out", reason: "reversal", reversesId: id, replacesId: "", note, createdAt: runtime.now(), createdBy: "web-owner" };
  await store.append(reversal); return reversal;
}
export function stockAdjustmentTotals(records: StockAdjustment[], accountId: string, month: string) {
  const matching = records.filter(a => a.accountId === accountId && a.date.slice(0, 7) === month);
  // Reversed entries and their counter-entries cancel in the original month. Keep
  // both in history, but don't inflate the non-sale in/out totals with corrections.
  const reversed = new Set(matching.filter(a => a.reversesId).map(a => a.reversesId));
  const effective = matching.filter(a => !a.reversesId && !reversed.has(a.id));
  return { adjustmentsOut: effective.filter(a => a.direction === "out").reduce((sum, a) => sum + a.quantity, 0), adjustmentsIn: effective.filter(a => a.direction === "in").reduce((sum, a) => sum + a.quantity, 0), adjustmentCount: effective.length };
}
