import "server-only";
import type { IGoogleSheetsService } from "@/externals/google/sheet/types";
import type { SalaryAdvanceShops } from "@/modules/hr/application/ports/salary-advance-shops";
import type { PayrollReaders } from "@/modules/hr/application/ports/payroll";
import { calculateEmployeePayroll as executePayroll, createSalaryAdvance as executeAdvance, settleEmployeePayroll as executeSettlement } from "@/modules/hr/payroll-server";
import { listEmployees, listEmployeeCompensations } from "./manageEmployees";
import { listEmployeeTimesheetsForMonth } from "./manageEmployeeTimesheets";
import { getGoogleSheetsSalesDashboard } from "@/services/sales/getGoogleSheetsDailySales";
import { createSalaryAdvanceShops } from "./salary-advance-shops";

// Existing read implementations remain outside migrated HR application/domain.
// Construction is lazy: preserve their original initialization and read sequence.
export function createPayrollReaders(service: IGoogleSheetsService): PayrollReaders {
  return {
    employees: { listEmployees: () => listEmployees({googleSheetsService: service}) },
    compensations: { listCompensations: () => listEmployeeCompensations({googleSheetsService: service}) },
    attendance: { listAttendance: month => listEmployeeTimesheetsForMonth({googleSheetsService: service, month}) },
    sales: { readSales: input => getGoogleSheetsSalesDashboard({...input, googleSheetsService: service}) },
  };
}
export async function calculateEmployeePayroll({googleSheetsService,month}: {googleSheetsService: IGoogleSheetsService; month: string}) {
  return executePayroll({googleSheetsService,month,readers:createPayrollReaders(googleSheetsService)});
}
export async function createSalaryAdvance(service: IGoogleSheetsService, input: unknown, shopsReader: SalaryAdvanceShops = createSalaryAdvanceShops(service)) {
  return executeAdvance(service,input,createPayrollReaders(service).employees,shopsReader);
}
export async function settleEmployeePayroll(service: IGoogleSheetsService, input: unknown) {
  return executeSettlement(service,input,createPayrollReaders(service));
}
