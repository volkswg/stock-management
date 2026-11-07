import type { EmployeePayroll } from "../contracts";
import { calculatePayrollRecords, getMonthEnd } from "../domain/payroll-calculation";
import { readSalaryLedger } from "./salary-advances";
import type { SalaryReader, PayrollReaders } from "./ports/payroll";

export async function calculateEmployeePayroll({ store, readers, month }: { store: SalaryReader; readers: PayrollReaders; month: string }): Promise<EmployeePayroll[]> {
  const employees = await readers.employees.listEmployees();
  const [compensations, timesheets, { advances, settlements }] = await Promise.all([
    readers.compensations.listCompensations(),
    readers.attendance.listAttendance(month),
    readSalaryLedger(store),
  ]);
  const monthStart = `${month}-01`;
  const monthEnd = getMonthEnd(month);
  const shopIds = Array.from(
    new Set(timesheets.map((timesheet) => timesheet.shopId)),
  );
  const salesDashboard = await readers.sales.readSales({
    accountIds: shopIds,
    fromDate: monthStart,
    toDate: monthEnd,
  });
  return calculatePayrollRecords({employees,compensations,timesheets,advances,settlements,salesDashboard,month,monthStart,monthEnd});
}
