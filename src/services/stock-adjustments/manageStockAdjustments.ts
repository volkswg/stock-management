import type { GoogleSheetRow, IGoogleSheetsService } from "@/externals/google/sheet/types";
import { listAdjustmentEmployees as executeListAdjustmentEmployees } from "@/modules/inventory/application/list-adjustment-employees";
import { createEmployeeDirectory } from "./employee-directory";
import type { StockCountAccount } from "@/modules/inventory/contracts";
import { ADJUSTMENT_HEADERS, ADJUSTMENT_REASONS, type AdjustmentEmployee, type StockAdjustment } from "./types";
export class StockAdjustmentError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export const stockToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export const validStockMonth = (value: unknown): value is string => typeof value === "string" && /^(20\d{2}|21\d{2})-(0[1-9]|1[0-2])$/.test(value);
const validDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && validStockMonth(v.slice(0, 7)) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
const validQuantity = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v > 0 && v <= 1e9;
const text = (v: unknown) => String(v ?? "");
function inputObject(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new StockAdjustmentError("Enter valid adjustment details.");
}
function field(v: unknown, max: number): string {
  if (v === undefined) return "";
  if (typeof v !== "string" || v.trim().length > max) throw new StockAdjustmentError("Enter a valid description, note or photo link.");
  return v.trim();
}
function photo(v: unknown) {
  const value = field(v, 2000); if (!value) return value;
  try { const u = new URL(value); if (u.protocol !== "https:" || u.username || u.password) throw Error(); } catch { throw new StockAdjustmentError("Use an HTTPS photo or Google Drive link."); }
  return value;
}
const payload = (a: StockAdjustment) => JSON.stringify([a.accountId, a.date, a.direction, a.reason, a.employeeId, a.quantity, a.itemDescription, a.photoUrl, a.note, a.reversesId, a.replacesId, a.notInLoyverse]);
async function readRows(service: IGoogleSheetsService): Promise<GoogleSheetRow[]> {
  let rows: GoogleSheetRow[];
  try { rows = await service.stockAdjustments.readRows("A:Q"); } catch (error) {
    if (error instanceof Error && /Google Sheets API request failed: 400/.test(error.message) && /Unable to parse range/.test(error.message)) return [];
    throw error;
  }
  if (rows.length && rows[0]?.slice(0, ADJUSTMENT_HEADERS.length).join("|") !== ADJUSTMENT_HEADERS.join("|")) throw new StockAdjustmentError("Stock adjustment headers do not match. No history was changed.", 503);
  return rows;
}
export function listAdjustmentEmployees(service: IGoogleSheetsService): Promise<AdjustmentEmployee[]> {
  return executeListAdjustmentEmployees(createEmployeeDirectory(service, () => new StockAdjustmentError("Employee storage headers do not match.", 503)));
}
export async function listStockAdjustments(service: IGoogleSheetsService): Promise<StockAdjustment[]> {
  const rows = await readRows(service), unique = new Map<string, StockAdjustment>();
  for (const r of rows.slice(1).filter(r => r[0])) {
    const a: StockAdjustment = { id: text(r[0]), accountId: text(r[1]), shopName: text(r[2]), date: text(r[3]), direction: text(r[4]) as StockAdjustment["direction"], reason: text(r[5]) as StockAdjustment["reason"], employeeId: text(r[6]), employeeName: text(r[7]), quantity: Number(r[8]), itemDescription: text(r[9]), photoUrl: text(r[10]), note: text(r[11]), reversesId: text(r[12]), replacesId: text(r[13]), createdAt: text(r[14]), createdBy: text(r[15]), notInLoyverse: r[16] === true || text(r[16]).toLowerCase() === "true" };
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
async function append(service: IGoogleSheetsService, a: StockAdjustment) {
  await service.stockAdjustments.ensureExists?.();
  const rows = await readRows(service);
  if (!rows.length) await service.stockAdjustments.updateRows("A1:Q1", [ADJUSTMENT_HEADERS]);
  await service.stockAdjustments.appendRows("A:Q", [[a.id, a.accountId, a.shopName, a.date, a.direction, a.reason, a.employeeId, a.employeeName, a.quantity, a.itemDescription, a.photoUrl, a.note, a.reversesId, a.replacesId, a.createdAt, a.createdBy, a.notInLoyverse]]);
}
export async function createStockAdjustment(service: IGoogleSheetsService, accounts: StockCountAccount[], value: unknown) {
  inputObject(value);
  if (typeof value.requestId !== "string" || !/^[a-f0-9-]{36}$/i.test(value.requestId) || typeof value.accountId !== "string" || !validDate(value.date) || value.date > stockToday() || !validQuantity(value.quantity) || !["in", "out"].includes(text(value.direction)) || typeof value.reason !== "string" || !Object.hasOwn(ADJUSTMENT_REASONS, value.reason)) throw new StockAdjustmentError("Select a shop, real non-future date, reason, direction and positive whole-unit quantity.");
  if (value.notInLoyverse !== true) throw new StockAdjustmentError("Do not duplicate a Loyverse entry. Confirm this change is not already recorded there.");
  if (["employee_gift", "damage", "sample", "personal_use"].includes(value.reason) && value.direction !== "out" || value.reason === "employee_return" && value.direction !== "in") throw new StockAdjustmentError("Use stock out for gifts, damage, samples or personal use, and stock in for employee returns.");
  const employeeId = field(value.employeeId, 150), replacesId = field(value.replacesId, 150);
  if (["employee_gift", "employee_return"].includes(value.reason) && !employeeId) throw new StockAdjustmentError("Select the employee receiving or returning the items.");
  const candidate: StockAdjustment = { id: `SAJ-${value.requestId}`, accountId: value.accountId, shopName: "", date: value.date, direction: value.direction as StockAdjustment["direction"], reason: value.reason as StockAdjustment["reason"], employeeId, employeeName: "", quantity: value.quantity, itemDescription: field(value.itemDescription, 250), photoUrl: photo(value.photoUrl), note: field(value.note, 500), reversesId: "", replacesId, createdAt: new Date().toISOString(), createdBy: "web-owner", notInLoyverse: true };
  const records = await listStockAdjustments(service), existing = records.find(a => a.id === candidate.id);
  if (existing) { if (payload(existing) !== payload(candidate)) throw new StockAdjustmentError("Save identifier already used for different adjustment details.", 409); return existing; }
  const account = accounts.find(a => a.id === candidate.accountId);
  if (!account) throw new StockAdjustmentError("Select a configured stock-count shop.");
  candidate.shopName = account.shopName;
  if (employeeId) {
    const employee = (await listAdjustmentEmployees(service)).find(e => e.id === employeeId);
    if (!employee || employee.hiredDate > candidate.date || (employee.terminatedDate && employee.terminatedDate < candidate.date)) throw new StockAdjustmentError("Select an employee employed on the adjustment date.");
    candidate.employeeName = employee.name;
  }
  if (replacesId) {
    const original = records.find(a => a.id === replacesId);
    if (!original || original.reason === "reversal" || !records.some(a => a.reversesId === replacesId)) throw new StockAdjustmentError("Reverse the original adjustment before recording its replacement.");
    if (records.some(a => a.replacesId === replacesId)) throw new StockAdjustmentError("A replacement already exists for this adjustment.", 409);
  }
  await append(service, candidate); return candidate;
}
export async function reverseStockAdjustment(service: IGoogleSheetsService, value: unknown) {
  inputObject(value); const id = field(value.id, 150), note = field(value.note, 500);
  if (!id || !note) throw new StockAdjustmentError("Select an adjustment and enter a reversal reason.");
  const records = await listStockAdjustments(service), original = records.find(a => a.id === id);
  if (!original) throw new StockAdjustmentError("Adjustment not found.", 404);
  if (original.reason === "reversal") throw new StockAdjustmentError("A reversal cannot itself be reversed. Record a new adjustment instead.");
  const existing = records.find(a => a.reversesId === id); if (existing) return existing;
  const reversal: StockAdjustment = { ...original, id: `REV-${id}`, direction: original.direction === "out" ? "in" : "out", reason: "reversal", reversesId: id, replacesId: "", note, createdAt: new Date().toISOString(), createdBy: "web-owner" };
  await append(service, reversal); return reversal;
}
export function stockAdjustmentTotals(records: StockAdjustment[], accountId: string, month: string) {
  const matching = records.filter(a => a.accountId === accountId && a.date.slice(0, 7) === month);
  // Reversed entries and their counter-entries cancel in the original month. Keep
  // both in history, but don't inflate the non-sale in/out totals with corrections.
  const reversed = new Set(matching.filter(a => a.reversesId).map(a => a.reversesId));
  const effective = matching.filter(a => !a.reversesId && !reversed.has(a.id));
  return { adjustmentsOut: effective.filter(a => a.direction === "out").reduce((sum, a) => sum + a.quantity, 0), adjustmentsIn: effective.filter(a => a.direction === "in").reduce((sum, a) => sum + a.quantity, 0), adjustmentCount: effective.length };
}
