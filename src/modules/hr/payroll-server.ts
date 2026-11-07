import "server-only";
import type { SalaryAdvanceShops } from "./application/ports/salary-advance-shops";
import type { PayrollReaders, PayrollEmployeeReader } from "./application/ports/payroll";
import { GoogleSheetsSalaryStore, type SalarySheets } from "./infrastructure/google-sheets/salary-store";
import { listSalaryAdvances as executeListAdvances, listPayrollSettlements as executeListSettlements, readSalaryLedger as executeReadLedger, createSalaryAdvance as executeCreateAdvance, transitionSalaryAdvance as executeTransitionAdvance } from "./application/salary-advances";
import { calculateEmployeePayroll as executeCalculatePayroll } from "./application/calculate-payroll";
import { settleEmployeePayroll as executeSettlePayroll } from "./application/settle-payroll";
import { payrollRevision } from "./infrastructure/payroll-revision";
export { SalaryAdvanceError, validPayrollMonth, validAdvanceDate, validMoney, money, recoveredAmount, calculateAdvanceDeductions } from "./domain/salary-rules";
export { payrollRevision };
export const bangkokToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const runtime = { now: () => new Date().toISOString(), today: bangkokToday, nextUpdatedAt: (previous: string) => new Date(Math.max(Date.now(), Date.parse(previous) + 1)).toISOString() };
export async function listSalaryAdvances(sheets: SalarySheets) { return executeListAdvances(new GoogleSheetsSalaryStore(sheets)); }
export async function listPayrollSettlements(sheets: SalarySheets) { return executeListSettlements(new GoogleSheetsSalaryStore(sheets)); }
export async function readSalaryLedger(sheets: SalarySheets) { return executeReadLedger(new GoogleSheetsSalaryStore(sheets)); }
export async function createSalaryAdvance(sheets: SalarySheets, input: unknown, employees: PayrollEmployeeReader, shops: SalaryAdvanceShops) {
  return executeCreateAdvance(new GoogleSheetsSalaryStore(sheets), input, employees, shops, runtime);
}
export async function transitionSalaryAdvance(sheets: SalarySheets, input: unknown) { return executeTransitionAdvance(new GoogleSheetsSalaryStore(sheets), input, runtime); }
export async function calculateEmployeePayroll({ googleSheetsService, month, readers }: { googleSheetsService: SalarySheets; month: string; readers: PayrollReaders }) {
  return executeCalculatePayroll({ store: new GoogleSheetsSalaryStore(googleSheetsService), readers, month });
}
export async function settleEmployeePayroll(sheets: SalarySheets, input: unknown, readers: PayrollReaders) {
  const store = new GoogleSheetsSalaryStore(sheets);
  return executeSettlePayroll(store, input, { runtime, revision: payrollRevision, calculatePayroll: month => executeCalculatePayroll({store, readers, month}) });
}
