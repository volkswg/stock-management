import type { SalaryAdvance, PayrollSettlement, EmployeePayroll, Employee, EmployeeCompensation, EmployeeTimesheet, PayrollSalesDashboard } from "../../contracts";

export type SettlementEntry = { readonly id: string; readonly employeeId: string; readonly month: string; readonly paidDate: string; readonly reference: string; readonly createdAt: string; readonly snapshotText: string };
export interface SalaryReader { readAdvances(): Promise<SalaryAdvance[]>; readSettlements(): Promise<SettlementEntry[]>; }
export interface SalaryStore extends SalaryReader {
  prepareAdvances(): Promise<void>;
  prepareSettlements(): Promise<void>;
  appendAdvance(advance: SalaryAdvance): Promise<void>;
  updateAdvanceCopies(id: string, next: SalaryAdvance): Promise<void>;
  appendSettlement(readSettlement: () => PayrollSettlement, snapshotJson: string): Promise<void>;
}
export type SalaryRuntime = { now(): string; today(): string; nextUpdatedAt(previous: string): string };
export interface PayrollEmployeeReader { listEmployees(): Promise<Employee[]>; }
export interface PayrollCompensationReader { listCompensations(): Promise<EmployeeCompensation[]>; }
export interface PayrollAttendanceReader { listAttendance(month: string): Promise<EmployeeTimesheet[]>; }
export interface PayrollSalesReader { readSales(input: { accountIds: string[]; fromDate: string; toDate: string }): Promise<PayrollSalesDashboard>; }
export type PayrollReaders = { employees: PayrollEmployeeReader; compensations: PayrollCompensationReader; attendance: PayrollAttendanceReader; sales: PayrollSalesReader };
export type SettlementDependencies = { runtime: SalaryRuntime; revision(record: EmployeePayroll): string; calculatePayroll(month: string): Promise<EmployeePayroll[]> };
