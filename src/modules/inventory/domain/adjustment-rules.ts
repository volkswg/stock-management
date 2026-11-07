import type { StockAdjustment } from "../contracts";
export class StockAdjustmentError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export const validStockMonth = (value: unknown): value is string => typeof value === "string" && /^(20\d{2}|21\d{2})-(0[1-9]|1[0-2])$/.test(value);
export const validDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && validStockMonth(v.slice(0, 7)) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
export const validQuantity = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v > 0 && v <= 1e9;
export const text = (v: unknown) => String(v ?? "");
export function inputObject(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new StockAdjustmentError("Enter valid adjustment details.");
}
export function field(v: unknown, max: number): string {
  if (v === undefined) return "";
  if (typeof v !== "string" || v.trim().length > max) throw new StockAdjustmentError("Enter a valid description, note or photo link.");
  return v.trim();
}
export function photo(v: unknown) {
  const value = field(v, 2000); if (!value) return value;
  try { const u = new URL(value); if (u.protocol !== "https:" || u.username || u.password) throw Error(); } catch { throw new StockAdjustmentError("Use an HTTPS photo or Google Drive link."); }
  return value;
}
export const payload = (a: StockAdjustment) => JSON.stringify([a.accountId, a.date, a.direction, a.reason, a.employeeId, a.quantity, a.itemDescription, a.photoUrl, a.note, a.reversesId, a.replacesId, a.notInLoyverse]);
