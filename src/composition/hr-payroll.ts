import "server-only";
import type { IGoogleSheetsService } from "@/infrastructure/persistence/google-sheets/service-contracts";
import type { SalaryAdvanceShops } from "@/modules/hr/application/ports/salary-advance-shops";
import type { PayrollReaders } from "@/modules/hr/application/ports/payroll";
import { calculateEmployeePayroll as executePayroll, createSalaryAdvance as executeAdvance, settleEmployeePayroll as executeSettlement } from "@/modules/hr/payroll-server";
import { createHRPayrollReaders } from "@/modules/hr/server";
import { createSalesDashboardReader } from "@/modules/sales/server";
import { createSalaryAdvanceShops } from "./salary-advance-shops";

// Only Sales transport composition remains outside HR; HR owns its workforce readers.
export function createPayrollReaders(service: IGoogleSheetsService): PayrollReaders {
  return createHRPayrollReaders(service, createSalesDashboardReader(service));
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
