import "server-only";
import type { SalaryAdvanceShops } from "./application/ports/salary-advance-shops";
import type { PayrollReaders, PayrollEmployeeReader } from "./application/ports/payroll";
import { PostgresSalaryStore, type SalaryStorage } from "./infrastructure/postgres/salary-store";
import { listSalaryAdvances as executeListAdvances, listPayrollSettlements as executeListSettlements, readSalaryLedger as executeReadLedger, createSalaryAdvance as executeCreateAdvance, transitionSalaryAdvance as executeTransitionAdvance } from "./application/salary-advances";
import { calculateEmployeePayroll as executeCalculatePayroll } from "./application/calculate-payroll";
import { settleEmployeePayroll as executeSettlePayroll } from "./application/settle-payroll";
import { payrollRevision } from "./infrastructure/payroll-revision";
export { SalaryAdvanceError, validPayrollMonth, validAdvanceDate, validMoney, money, recoveredAmount, calculateAdvanceDeductions } from "./domain/salary-rules";
export { payrollRevision };
export const bangkokToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const runtime = { now: () => new Date().toISOString(), today: bangkokToday, nextUpdatedAt: (previous: string) => new Date(Math.max(Date.now(), Date.parse(previous) + 1)).toISOString() };
export async function listSalaryAdvances(storage: SalaryStorage) { return executeListAdvances(new PostgresSalaryStore(storage)); }
export async function listPayrollSettlements(storage: SalaryStorage) { return executeListSettlements(new PostgresSalaryStore(storage)); }
export async function readSalaryLedger(storage: SalaryStorage) { return executeReadLedger(new PostgresSalaryStore(storage)); }
export async function createSalaryAdvance(storage: SalaryStorage, input: unknown, employees: PayrollEmployeeReader, shops: SalaryAdvanceShops) {
  return executeCreateAdvance(new PostgresSalaryStore(storage), input, employees, shops, runtime);
}
export async function transitionSalaryAdvance(storage: SalaryStorage, input: unknown) { return executeTransitionAdvance(new PostgresSalaryStore(storage), input, runtime); }
export async function calculateEmployeePayroll({ storage, month, readers }: { storage: SalaryStorage; month: string; readers: PayrollReaders }) {
  return executeCalculatePayroll({ store: new PostgresSalaryStore(storage), readers, month });
}
export async function settleEmployeePayroll(storage: SalaryStorage, input: unknown, readers: PayrollReaders) {
  const store = new PostgresSalaryStore(storage);
  return executeSettlePayroll(store, input, { runtime, revision: payrollRevision, calculatePayroll: month => executeCalculatePayroll({store, readers, month}) });
}
