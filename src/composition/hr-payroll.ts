import "server-only";
import type { BusinessDatabase as Storage } from "@/composition/postgres/service";
import type { SalaryAdvanceShops } from "@/modules/hr/application/ports/salary-advance-shops";
import type { PayrollReaders } from "@/modules/hr/application/ports/payroll";
import { calculateEmployeePayroll as executePayroll, createSalaryAdvance as executeAdvance, settleEmployeePayroll as executeSettlement } from "@/modules/hr/payroll-server";
import { createHRPayrollReaders } from "@/modules/hr/server";
import { createSalesDashboardReader } from "@/modules/sales/server";
import { createSalaryAdvanceShops } from "./salary-advance-shops";

// Only Sales transport composition remains outside HR; HR owns its workforce readers.
export function createPayrollReaders(service: Storage): PayrollReaders {
  return createHRPayrollReaders(service, createSalesDashboardReader(service));
}
export async function calculateEmployeePayroll({storage,month}: {storage: Storage; month: string}) {
  return executePayroll({storage,month,readers:createPayrollReaders(storage)});
}
export async function createSalaryAdvance(service: Storage, input: unknown, shopsReader: SalaryAdvanceShops = createSalaryAdvanceShops(service)) {
  return executeAdvance(service,input,createPayrollReaders(service).employees,shopsReader);
}
export async function settleEmployeePayroll(service: Storage, input: unknown) {
  return executeSettlement(service,input,createPayrollReaders(service));
}
