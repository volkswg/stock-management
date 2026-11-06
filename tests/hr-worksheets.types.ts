type Equal<A,B> = (<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
type Assert<T extends true> = T;
import type { EmployeesSheet as OldEmployees } from "../src/externals/google/sheet/sheets/employees/EmployeesSheet";
import type { EmployeesSheet } from "../src/modules/hr/infrastructure/google-sheets/employees/EmployeesSheet";
import type { EmployeeCompensationsSheet as OldCompensations } from "../src/externals/google/sheet/sheets/employee-compensations/EmployeeCompensationsSheet";
import type { EmployeeCompensationsSheet } from "../src/modules/hr/infrastructure/google-sheets/employee-compensations/EmployeeCompensationsSheet";
import type { EmployeeTimesheetsSheet as OldTimesheets } from "../src/externals/google/sheet/sheets/employee-timesheets/EmployeeTimesheetsSheet";
import type { EmployeeTimesheetsSheet } from "../src/modules/hr/infrastructure/google-sheets/employee-timesheets/EmployeeTimesheetsSheet";
import type { EMPLOYEE_HEADERS as OldHeaders } from "../src/externals/google/sheet/sheets/employees/const";
import type { EMPLOYEE_HEADERS } from "../src/modules/hr/infrastructure/google-sheets/employees/const";
import type { EMPLOYEE_COMPENSATION_HEADERS as OldCompensationHeaders } from "../src/externals/google/sheet/sheets/employee-compensations/const";
import type { EMPLOYEE_COMPENSATION_HEADERS } from "../src/modules/hr/infrastructure/google-sheets/employee-compensations/const";
import type { EMPLOYEE_TIMESHEET_HEADERS as OldTimesheetHeaders } from "../src/externals/google/sheet/sheets/employee-timesheets/const";
import type { EMPLOYEE_TIMESHEET_HEADERS } from "../src/modules/hr/infrastructure/google-sheets/employee-timesheets/const";
export type HrWorksheetCompatibility = [
 Assert<Equal<typeof OldEmployees,typeof EmployeesSheet>>, Assert<Equal<OldEmployees,EmployeesSheet>>,
 Assert<Equal<typeof OldCompensations,typeof EmployeeCompensationsSheet>>, Assert<Equal<OldCompensations,EmployeeCompensationsSheet>>,
 Assert<Equal<typeof OldTimesheets,typeof EmployeeTimesheetsSheet>>, Assert<Equal<OldTimesheets,EmployeeTimesheetsSheet>>,
 Assert<Equal<typeof OldHeaders,typeof EMPLOYEE_HEADERS>>,
 Assert<Equal<typeof OldCompensationHeaders,typeof EMPLOYEE_COMPENSATION_HEADERS>>,
 Assert<Equal<typeof OldTimesheetHeaders,typeof EMPLOYEE_TIMESHEET_HEADERS>>
];
