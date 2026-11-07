import type { SalaryAdvance, AdvanceDeduction, PayrollSettlement } from "../contracts";

export class SalaryAdvanceError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export const validPayrollMonth = (value: unknown): value is string => typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && value >= "2000-01" && value <= "2199-12";
export const validAdvanceDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
export const validMoney = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1e9 && Math.abs(value * 100 - Math.round(value * 100)) < 0.0001;
export const money = (n: number) => Math.round(n * 100) / 100;
export const str = (value: unknown) => String(value ?? "");
export function record(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SalaryAdvanceError("Enter valid advance details.");
}
export function field(value: unknown, max: number) {
  if (typeof value !== "string" || value.trim().length > max) throw new SalaryAdvanceError("Enter a valid note or reference.");
  return value.trim();
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
export function assertOpenMonth(settlements: PayrollSettlement[], employeeId: string, month: string) {
  if (settlements.some(s => s.employeeId === employeeId && s.month >= month)) throw new SalaryAdvanceError("This or a later payroll month is settled. Choose an open month after the latest settlement.", 409);
}
