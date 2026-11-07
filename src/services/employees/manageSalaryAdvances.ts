import { ADVANCE_HEADERS, SETTLEMENT_HEADERS } from "@/modules/hr/infrastructure/google-sheets/employee-advances/const";
export { ADVANCE_HEADERS, SETTLEMENT_HEADERS } from "@/modules/hr/infrastructure/google-sheets/employee-advances/const";
import type { GoogleSheetRow, IGoogleRowsSheet, IGoogleSheetsService } from "@/externals/google/sheet";
import { listEmployees } from "./manageEmployees";
import { createSalaryAdvanceShops } from "./salary-advance-shops";
import type { SalaryAdvanceShops } from "@/modules/hr/application/ports/salary-advance-shops";
import type { EmployeePayroll } from "./calculateEmployeePayroll";

// Keep the worksheet layout compatible with existing records. New entries are paid
// immediately; requestedDate/requestedAmount are storage-only compatibility fields.
export type SalaryAdvance = {
  id: string; employeeId: string; shopId: string; requestedDate: string; payrollMonth: string;
  requestedAmount: number; paidAmount: number; status: "requested" | "approved" | "paid" | "cancelled";
  paidDate: string; reference: string; note: string; createdAt: string; updatedAt: string;
};
export type AdvanceDeduction = { id: string; paidDate: string; reference: string; amount: number; deduction: number; balance: number };
export type PayrollSettlement = { id: string; employeeId: string; month: string; paidDate: string; reference: string; createdAt: string; snapshot: EmployeePayroll };
export class SalaryAdvanceError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export const bangkokToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export const validPayrollMonth = (value: unknown): value is string => typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && value >= "2000-01" && value <= "2199-12";
export const validAdvanceDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
export const validMoney = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1e9 && Math.abs(value * 100 - Math.round(value * 100)) < 0.0001;
export const money = (n: number) => Math.round(n * 100) / 100;
const str = (value: unknown) => String(value ?? "");
function record(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SalaryAdvanceError("Enter valid advance details.");
}
function field(value: unknown, max: number) {
  if (typeof value !== "string" || value.trim().length > max) throw new SalaryAdvanceError("Enter a valid note or reference.");
  return value.trim();
}
export async function readSalaryTable(sheet: IGoogleRowsSheet, headers: string[]): Promise<GoogleSheetRow[]> {
  let rows: GoogleSheetRow[];
  try { rows = await sheet.readRows(); } catch (error) {
    // A missing, new worksheet is empty. Auth, quota and other errors must fail closed.
    if (error instanceof Error && /Google Sheets API request failed: 400/.test(error.message) && /Unable to parse range/.test(error.message)) return [];
    throw error;
  }
  if (!rows.length) return [];
  if (rows[0]?.slice(0, headers.length).join("|") !== headers.join("|")) throw new SalaryAdvanceError("Salary storage has unexpected headers. No records were changed.", 503);
  return rows;
}
export async function prepareSalaryTable(sheet: IGoogleRowsSheet, headers: string[], lastColumn: string) {
  await sheet.ensureExists?.();
  const rows = await readSalaryTable(sheet, headers);
  if (!rows.length) await sheet.updateRows(`A1:${lastColumn}1`, [headers]);
}
export async function listSalaryAdvances(service: IGoogleSheetsService): Promise<SalaryAdvance[]> {
  const rows = await readSalaryTable(service.employeeAdvances, ADVANCE_HEADERS);
  const advances = rows.slice(1).filter(row => row[0]).map(row => ({
    id: str(row[0]), employeeId: str(row[1]), shopId: str(row[2]), requestedDate: str(row[3]), payrollMonth: str(row[4]),
    requestedAmount: Number(row[5]), paidAmount: Number(row[6]), status: str(row[7]) as SalaryAdvance["status"],
    paidDate: str(row[8]), reference: str(row[9]), note: str(row[10]), createdAt: str(row[11]), updatedAt: str(row[12]),
  }));
  for (const a of advances) {
    if (!validMoney(a.requestedAmount) || a.requestedAmount <= 0 || !validMoney(a.paidAmount) || a.paidAmount > a.requestedAmount || !validPayrollMonth(a.payrollMonth) || !["requested", "approved", "paid", "cancelled"].includes(a.status) || (a.status === "paid" && (!validAdvanceDate(a.paidDate) || a.paidAmount <= 0))) throw new SalaryAdvanceError("Invalid advance data in storage. Check the salary advance sheet.", 503);
  }
  const unique = new Map<string, SalaryAdvance>();
  for (const a of advances) {
    const old = unique.get(a.id);
    if (old && JSON.stringify(old) !== JSON.stringify(a)) throw new SalaryAdvanceError("Conflicting advance records. Check storage before continuing.", 503);
    unique.set(a.id, a);
  }
  return [...unique.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function listPayrollSettlements(service: IGoogleSheetsService): Promise<PayrollSettlement[]> {
  const rows = await readSalaryTable(service.payrollSettlements, SETTLEMENT_HEADERS);
  const unique = new Map<string, PayrollSettlement>();
  for (const row of rows.slice(1).filter(row => row[0])) {
    let snapshot: EmployeePayroll;
    try { snapshot = JSON.parse(str(row[6])); } catch { throw new SalaryAdvanceError("Invalid payroll snapshot in storage.", 503); }
    if (!snapshot || snapshot.employeeId !== str(row[1]) || !validMoney(snapshot.totalPay) || !Array.isArray(snapshot.advances) || !validMoney(snapshot.advanceDeduction) || snapshot.advances.some(a => !a.id || !validMoney(a.deduction))) throw new SalaryAdvanceError("Invalid payroll settlement in storage.", 503);
    const settlement = { id: str(row[0]), employeeId: str(row[1]), month: str(row[2]), paidDate: str(row[3]), reference: str(row[4]), createdAt: str(row[5]), snapshot };
    const key = `${settlement.employeeId}:${settlement.month}`;
    const old = unique.get(key);
    if (old && JSON.stringify(old.snapshot) !== JSON.stringify(snapshot)) throw new SalaryAdvanceError("Conflicting payroll settlements. Check storage before continuing.", 503);
    if (!old) unique.set(key, settlement);
  }
  return [...unique.values()];
}
export async function readSalaryLedger(service: IGoogleSheetsService) {
  const [advances, settlements] = await Promise.all([listSalaryAdvances(service), listPayrollSettlements(service)]);
  for (const settlement of settlements) {
    const snapshot = settlement.snapshot;
    const ids = new Set<string>();
    for (const deduction of snapshot.advances) {
      const advance = advances.find(a => a.id === deduction.id);
      if (ids.has(deduction.id) || !advance || advance.status !== "paid" || advance.employeeId !== settlement.employeeId || !validMoney(deduction.amount) || !validMoney(deduction.balance) || money(deduction.deduction + deduction.balance) !== deduction.amount) throw new SalaryAdvanceError("Payroll recovery records are inconsistent. Check salary storage before continuing.", 503);
      ids.add(deduction.id);
    }
    if (!validPayrollMonth(settlement.month) || !validMoney(snapshot.grossPay) || !validMoney(snapshot.basePay) || !validMoney(snapshot.commission) || money(snapshot.basePay + snapshot.commission) !== snapshot.grossPay || money(snapshot.totalPay + snapshot.advanceDeduction) !== snapshot.grossPay || money(snapshot.advances.reduce((sum, a) => sum + a.deduction, 0)) !== snapshot.advanceDeduction) throw new SalaryAdvanceError("Payroll settlement totals are inconsistent. Check salary storage before continuing.", 503);
  }
  for (const advance of advances) {
    if (recoveredAmount(advance.id, settlements) > advance.paidAmount) throw new SalaryAdvanceError("Advance recovery exceeds the payment. Check salary storage before continuing.", 503);
  }
  return { advances, settlements };
}
export function recoveredAmount(id: string, settlements: PayrollSettlement[]) {
  return money(settlements.reduce((sum, s) => sum + s.snapshot.advances.filter(a => a.id === id).reduce((n, a) => n + a.deduction, 0), 0));
}
export function calculateAdvanceDeductions(advances: SalaryAdvance[], settlements: PayrollSettlement[], employeeId: string, month: string, grossPay: number) {
  let available = Math.max(0, Math.round(grossPay * 100));
  const deductions: AdvanceDeduction[] = advances.filter(a => a.employeeId === employeeId && a.status === "paid" && a.payrollMonth <= month && a.paidDate.slice(0, 7) <= month)
    .sort((a, b) => a.payrollMonth.localeCompare(b.payrollMonth) || a.paidDate.localeCompare(b.paidDate) || a.id.localeCompare(b.id))
    .flatMap(a => {
      const balanceCents = Math.max(0, Math.round((a.paidAmount - recoveredAmount(a.id, settlements.filter(s => s.month < month))) * 100));
      if (!balanceCents) return [];
      const deductionCents = Math.min(available, balanceCents); available -= deductionCents;
      return [{ id: a.id, paidDate: a.paidDate, reference: a.reference, amount: balanceCents / 100, deduction: deductionCents / 100, balance: (balanceCents - deductionCents) / 100 }];
    });
  return { advances: deductions, advanceDeduction: money(deductions.reduce((sum, a) => sum + a.deduction, 0)), advanceBalance: money(deductions.reduce((sum, a) => sum + a.balance, 0)), totalPay: available / 100 };
}
function assertOpenMonth(settlements: PayrollSettlement[], employeeId: string, month: string) {
  if (settlements.some(s => s.employeeId === employeeId && s.month >= month)) throw new SalaryAdvanceError("This or a later payroll month is settled. Choose an open month after the latest settlement.", 409);
}
export async function createSalaryAdvance(service: IGoogleSheetsService, input: unknown, shopsReader: SalaryAdvanceShops = createSalaryAdvanceShops(service)): Promise<SalaryAdvance> {
  record(input);
  if (typeof input.requestId !== "string" || !/^[a-f0-9-]{36}$/i.test(input.requestId) || typeof input.employeeId !== "string" || typeof input.shopId !== "string" || !validAdvanceDate(input.paidDate) || input.paidDate > bangkokToday() || !validPayrollMonth(input.payrollMonth) || input.payrollMonth < input.paidDate.slice(0, 7) || !validMoney(input.paidAmount) || input.paidAmount <= 0) throw new SalaryAdvanceError("Select an employee, shop, payment date, deduction month and positive paid amount (up to two decimals).");
  const note = field(input.note ?? "", 500);
  const reference = field(input.reference ?? "", 200);
  const [{ advances, settlements }, employees, shops] = await Promise.all([readSalaryLedger(service), listEmployees({ googleSheetsService: service }), shopsReader.listShops()]);
  const id = `ADV-${input.requestId}`;
  const existing = advances.find(a => a.id === id);
  if (existing) {
    if (existing.status !== "paid" || existing.employeeId !== input.employeeId || existing.shopId !== input.shopId || existing.paidAmount !== input.paidAmount || existing.paidDate !== input.paidDate || existing.payrollMonth !== input.payrollMonth || existing.note !== note || existing.reference !== reference) throw new SalaryAdvanceError("Payment identifier was already used for different details.", 409);
    return existing;
  }
  const employee = employees.find(e => e.id === input.employeeId);
  if (!employee || employee.status !== "active" || employee.hiredDate > input.paidDate || (employee.terminatedDate && employee.terminatedDate < input.paidDate)) throw new SalaryAdvanceError("Select an active employee employed on the payment date.");
  if (!shops.some(s => s.id === input.shopId && s.active)) throw new SalaryAdvanceError("Select an active shop.");
  assertOpenMonth(settlements, input.employeeId, input.payrollMonth);
  const now = new Date().toISOString();
  const advance: SalaryAdvance = { id, employeeId: input.employeeId, shopId: input.shopId, requestedDate: input.paidDate, payrollMonth: input.payrollMonth, requestedAmount: input.paidAmount, paidAmount: input.paidAmount, status: "paid", paidDate: input.paidDate, reference, note, createdAt: now, updatedAt: now };
  await prepareSalaryTable(service.employeeAdvances, ADVANCE_HEADERS, "M");
  await service.employeeAdvances.appendRows("A:M", [advanceRow(advance)]);
  return advance;
}
export async function transitionSalaryAdvance(service: IGoogleSheetsService, input: unknown): Promise<SalaryAdvance> {
  record(input);
  // Compatibility only: old unpaid entries can be paid directly or dismissed.
  // There is no approval action and new entries never start unpaid.
  if (!["pay", "cancel"].includes(str(input.action))) throw new SalaryAdvanceError("Choose a valid payment action.");
  const { advances, settlements } = await readSalaryLedger(service);
  const current = advances.find(a => a.id === input.id);
  if (!current) throw new SalaryAdvanceError("Advance not found.", 404);
  // A retry of the exact payment is safe, including after a lost response.
  if (input.action === "pay" && current.status === "paid" && current.paidAmount === input.paidAmount && current.paidDate === input.paidDate && current.reference === (typeof input.reference === "string" ? input.reference.trim() : null)) return current;
  if (input.action === "cancel" && current.status === "cancelled") return current;
  if (input.updatedAt !== current.updatedAt) throw new SalaryAdvanceError("This advance changed. Refresh before continuing.", 409);
  if (input.action !== "cancel") assertOpenMonth(settlements, current.employeeId, current.payrollMonth);
  const next = { ...current, updatedAt: new Date(Math.max(Date.now(), Date.parse(current.updatedAt) + 1)).toISOString() };
  if (input.action === "cancel" && ["requested", "approved"].includes(current.status)) next.status = "cancelled";
  else if (input.action === "pay" && ["requested", "approved"].includes(current.status)) {
    if (!validMoney(input.paidAmount) || input.paidAmount <= 0 || input.paidAmount > current.requestedAmount || !validAdvanceDate(input.paidDate) || input.paidDate > bangkokToday() || input.paidDate < current.requestedDate || input.paidDate.slice(0, 7) > current.payrollMonth) throw new SalaryAdvanceError("Enter a positive paid amount within the unpaid balance and a payment date within the entry’s deduction period (not in the future).");
    next.status = "paid"; next.paidAmount = input.paidAmount; next.paidDate = input.paidDate; next.reference = field(input.reference, 200);
  } else throw new SalaryAdvanceError("This action is not allowed for the current status. Paid advances cannot be edited or cancelled.", 409);
  const rows = await readSalaryTable(service.employeeAdvances, ADVANCE_HEADERS);
  const indexes = rows.flatMap((row, index) => str(row[0]) === current.id ? [index] : []);
  for (const index of indexes) await service.employeeAdvances.updateRows(`A${index + 1}:M${index + 1}`, [advanceRow(next)]);
  return next;
}
function advanceRow(a: SalaryAdvance): GoogleSheetRow { return [a.id, a.employeeId, a.shopId, a.requestedDate, a.payrollMonth, a.requestedAmount, a.paidAmount, a.status, a.paidDate, a.reference, a.note, a.createdAt, a.updatedAt]; }
