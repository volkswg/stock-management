import { createHash } from "node:crypto";
import type { IGoogleSheetsService } from "@/externals/google/sheet";
import { calculateEmployeePayroll, type EmployeePayroll } from "./calculateEmployeePayroll";
import { bangkokToday, readSalaryLedger, prepareSalaryTable, SalaryAdvanceError, SETTLEMENT_HEADERS, validAdvanceDate, validPayrollMonth } from "./manageSalaryAdvances";

// Includes attendance, compensation and advance allocation: stale confirmations fail closed.
export function payrollRevision(record: EmployeePayroll): string {
  return createHash("sha256").update(JSON.stringify(record)).digest("hex");
}
export async function settleEmployeePayroll(service: IGoogleSheetsService, input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new SalaryAdvanceError("Enter valid payroll payment details.");
  const body = input as Record<string, unknown>;
  if (typeof body.employeeId !== "string" || !validPayrollMonth(body.month) || !validAdvanceDate(body.paidDate) || body.paidDate > bangkokToday() || body.paidDate.slice(0, 7) < body.month || typeof body.reference !== "string" || body.reference.trim().length > 200 || typeof body.revision !== "string") throw new SalaryAdvanceError("Enter a payment date on or after the payroll month, not in the future, and a valid reference.");
  const { settlements } = await readSalaryLedger(service);
  const existing = settlements.find(s => s.employeeId === body.employeeId && s.month === body.month);
  if (existing) return existing;
  if (settlements.some(s => s.employeeId === body.employeeId && s.month > body.month!)) throw new SalaryAdvanceError("A later payroll is settled. Earlier payroll cannot now be settled.", 409);
  const payroll = await calculateEmployeePayroll({ googleSheetsService: service, month: body.month });
  const snapshot = payroll.find(p => p.employeeId === body.employeeId);
  if (!snapshot || !(snapshot.workedDays || snapshot.leaveDays || snapshot.advances.length)) throw new SalaryAdvanceError("No attendance or advance balance for this employee and month.");
  if (payrollRevision(snapshot) !== body.revision) throw new SalaryAdvanceError("Payroll changed. Refresh and review the amount before settling.", 409);
  const createdAt = new Date().toISOString();
  const id = `PAY-${body.month}-${body.employeeId}`;
  const settlement = { id, employeeId: body.employeeId, month: body.month, paidDate: body.paidDate, reference: body.reference.trim(), createdAt, snapshot };
  const snapshotJson = JSON.stringify(snapshot);
  if (snapshotJson.length > 49000) throw new SalaryAdvanceError("This payroll exceeds the worksheet snapshot size limit. No settlement was saved.");
  // One immutable row is the settlement and all its recovery allocations: no multi-sheet partial commit.
  await prepareSalaryTable(service.payrollSettlements, SETTLEMENT_HEADERS, "G");
  await service.payrollSettlements.appendRows("A:G", [[id, body.employeeId, body.month, body.paidDate, settlement.reference, createdAt, snapshotJson]]);
  return settlement;
}
