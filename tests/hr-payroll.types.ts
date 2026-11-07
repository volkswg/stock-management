import type { SalaryAdvance, AdvanceDeduction, PayrollSettlement, EmployeePayroll, EmployeePayrollDailyCommission, EmployeeCompensation, EmployeeTimesheet } from '../src/modules/hr/contracts';
import type { SalaryAdvance as LegacyAdvance, AdvanceDeduction as LegacyDeduction, PayrollSettlement as LegacySettlement } from '../src/services/employees/manageSalaryAdvances';
import type { EmployeePayroll as LegacyPayroll, EmployeePayrollDailyCommission as LegacyDaily } from '../src/services/employees/calculateEmployeePayroll';
import type { EmployeeCompensation as LegacyCompensation } from '../src/services/employees/manageEmployees';
import type { EmployeeTimesheet as LegacyTimesheet } from '../src/services/employees/manageEmployeeTimesheets';
import type { SalaryReader, PayrollReaders } from '../src/modules/hr/application/ports/payroll';
import { calculateEmployeePayroll } from '../src/modules/hr/application/calculate-payroll';
type Equal<A,B>=(<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
export const exact: [Equal<SalaryAdvance,LegacyAdvance>,Equal<AdvanceDeduction,LegacyDeduction>,Equal<PayrollSettlement,LegacySettlement>,Equal<EmployeePayroll,LegacyPayroll>,Equal<EmployeePayrollDailyCommission,LegacyDaily>,Equal<EmployeeCompensation,LegacyCompensation>,Equal<EmployeeTimesheet,LegacyTimesheet>]=[true,true,true,true,true,true,true];
export function payrollPorts(store: SalaryReader, readers: PayrollReaders) { return calculateEmployeePayroll({store,readers,month:'2026-11'}); }
