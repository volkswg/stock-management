import type { SalaryAdvance, PayrollSettlement, EmployeePayroll } from "../contracts";
import { SalaryAdvanceError, validMoney, validPayrollMonth, validAdvanceDate, money, recoveredAmount, assertOpenMonth, record, field, str } from "../domain/salary-rules";
import type { SalaryReader, SalaryStore, SalaryRuntime, PayrollEmployeeReader } from "./ports/payroll";
import type { SalaryAdvanceShops } from "./ports/salary-advance-shops";

export async function listSalaryAdvances(store: SalaryReader): Promise<SalaryAdvance[]> {
  const advances = await store.readAdvances();
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
export async function listPayrollSettlements(store: SalaryReader): Promise<PayrollSettlement[]> {
  const rows = await store.readSettlements();
  const unique = new Map<string, PayrollSettlement>();
  for (const row of rows) {
    let snapshot: EmployeePayroll;
    try { snapshot = JSON.parse(row.snapshotText); } catch { throw new SalaryAdvanceError("Invalid payroll snapshot in storage.", 503); }
    if (!snapshot || snapshot.employeeId !== row.employeeId || !validMoney(snapshot.totalPay) || !Array.isArray(snapshot.advances) || !validMoney(snapshot.advanceDeduction) || snapshot.advances.some(a => !a.id || !validMoney(a.deduction))) throw new SalaryAdvanceError("Invalid payroll settlement in storage.", 503);
    const settlement = { id: row.id, employeeId: row.employeeId, month: row.month, paidDate: row.paidDate, reference: row.reference, createdAt: row.createdAt, snapshot };
    const key = `${settlement.employeeId}:${settlement.month}`;
    const old = unique.get(key);
    if (old && JSON.stringify(old.snapshot) !== JSON.stringify(snapshot)) throw new SalaryAdvanceError("Conflicting payroll settlements. Check storage before continuing.", 503);
    if (!old) unique.set(key, settlement);
  }
  return [...unique.values()];
}
export async function readSalaryLedger(store: SalaryReader) {
  const [advances, settlements] = await Promise.all([listSalaryAdvances(store), listPayrollSettlements(store)]);
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
export async function createSalaryAdvance(store: SalaryStore, input: unknown, employeesReader: PayrollEmployeeReader, shopsReader: SalaryAdvanceShops, runtime: SalaryRuntime): Promise<SalaryAdvance> {
  record(input);
  if (typeof input.requestId !== "string" || !/^[a-f0-9-]{36}$/i.test(input.requestId) || typeof input.employeeId !== "string" || typeof input.shopId !== "string" || !validAdvanceDate(input.paidDate) || input.paidDate > runtime.today() || !validPayrollMonth(input.payrollMonth) || input.payrollMonth < input.paidDate.slice(0, 7) || !validMoney(input.paidAmount) || input.paidAmount <= 0) throw new SalaryAdvanceError("Select an employee, shop, payment date, deduction month and positive paid amount (up to two decimals).");
  const note = field(input.note ?? "", 500);
  const reference = field(input.reference ?? "", 200);
  const [{ advances, settlements }, employees, shops] = await Promise.all([readSalaryLedger(store), employeesReader.listEmployees(), shopsReader.listShops()]);
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
  const now = runtime.now();
  const advance: SalaryAdvance = { id, employeeId: input.employeeId, shopId: input.shopId, requestedDate: input.paidDate, payrollMonth: input.payrollMonth, requestedAmount: input.paidAmount, paidAmount: input.paidAmount, status: "paid", paidDate: input.paidDate, reference, note, createdAt: now, updatedAt: now };
  await store.prepareAdvances();
  await store.appendAdvance(advance);
  return advance;
}
export async function transitionSalaryAdvance(store: SalaryStore, input: unknown, runtime: SalaryRuntime): Promise<SalaryAdvance> {
  record(input);
  // Compatibility only: old unpaid entries can be paid directly or dismissed.
  // There is no approval action and new entries never start unpaid.
  if (!["pay", "cancel"].includes(str(input.action))) throw new SalaryAdvanceError("Choose a valid payment action.");
  const { advances, settlements } = await readSalaryLedger(store);
  const current = advances.find(a => a.id === input.id);
  if (!current) throw new SalaryAdvanceError("Advance not found.", 404);
  // A retry of the exact payment is safe, including after a lost response.
  if (input.action === "pay" && current.status === "paid" && current.paidAmount === input.paidAmount && current.paidDate === input.paidDate && current.reference === (typeof input.reference === "string" ? input.reference.trim() : null)) return current;
  if (input.action === "cancel" && current.status === "cancelled") return current;
  if (input.updatedAt !== current.updatedAt) throw new SalaryAdvanceError("This advance changed. Refresh before continuing.", 409);
  if (input.action !== "cancel") assertOpenMonth(settlements, current.employeeId, current.payrollMonth);
  const next = { ...current, updatedAt: runtime.nextUpdatedAt(current.updatedAt) };
  if (input.action === "cancel" && ["requested", "approved"].includes(current.status)) next.status = "cancelled";
  else if (input.action === "pay" && ["requested", "approved"].includes(current.status)) {
    if (!validMoney(input.paidAmount) || input.paidAmount <= 0 || input.paidAmount > current.requestedAmount || !validAdvanceDate(input.paidDate) || input.paidDate > runtime.today() || input.paidDate < current.requestedDate || input.paidDate.slice(0, 7) > current.payrollMonth) throw new SalaryAdvanceError("Enter a positive paid amount within the unpaid balance and a payment date within the entry’s deduction period (not in the future).");
    next.status = "paid"; next.paidAmount = input.paidAmount; next.paidDate = input.paidDate; next.reference = field(input.reference, 200);
  } else throw new SalaryAdvanceError("This action is not allowed for the current status. Paid advances cannot be edited or cancelled.", 409);
  await store.updateAdvanceCopies(current.id, next);
  return next;
}
