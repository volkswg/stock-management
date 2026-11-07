import { SalaryAdvanceError, validPayrollMonth, validAdvanceDate } from "../domain/salary-rules";
import { readSalaryLedger } from "./salary-advances";
import type { SalaryStore, SettlementDependencies } from "./ports/payroll";

export async function settleEmployeePayroll(store: SalaryStore, input: unknown, dependencies: SettlementDependencies) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new SalaryAdvanceError("Enter valid payroll payment details.");
  const body = input as Record<string, unknown>;
  if (typeof body.employeeId !== "string" || !validPayrollMonth(body.month) || !validAdvanceDate(body.paidDate) || body.paidDate > dependencies.runtime.today() || body.paidDate.slice(0, 7) < body.month || typeof body.reference !== "string" || body.reference.trim().length > 200 || typeof body.revision !== "string") throw new SalaryAdvanceError("Enter a payment date on or after the payroll month, not in the future, and a valid reference.");
  const { settlements } = await readSalaryLedger(store);
  const existing = settlements.find(s => s.employeeId === body.employeeId && s.month === body.month);
  if (existing) return existing;
  if (settlements.some(s => s.employeeId === body.employeeId && s.month > body.month!)) throw new SalaryAdvanceError("A later payroll is settled. Earlier payroll cannot now be settled.", 409);
  const payroll = await dependencies.calculatePayroll(body.month);
  const snapshot = payroll.find(p => p.employeeId === body.employeeId);
  if (!snapshot || !(snapshot.workedDays || snapshot.leaveDays || snapshot.advances.length)) throw new SalaryAdvanceError("No attendance or advance balance for this employee and month.");
  if (dependencies.revision(snapshot) !== body.revision) throw new SalaryAdvanceError("Payroll changed. Refresh and review the amount before settling.", 409);
  const createdAt = dependencies.runtime.now();
  const id = `PAY-${body.month}-${body.employeeId}`;
  const settlement = { id, employeeId: body.employeeId, month: body.month, paidDate: body.paidDate, reference: body.reference.trim(), createdAt, snapshot };
  const snapshotJson = JSON.stringify(snapshot);
  if (snapshotJson.length > 49000) throw new SalaryAdvanceError("This payroll exceeds the worksheet snapshot size limit. No settlement was saved.");
  // One immutable row is the settlement and all its recovery allocations: no multi-sheet partial commit.
  await store.prepareSettlements();
  await store.appendSettlement(() => ({ id, employeeId: body.employeeId as string, month: body.month as string, paidDate: body.paidDate as string, reference: settlement.reference, createdAt, snapshot }), snapshotJson);
  return settlement;
}
