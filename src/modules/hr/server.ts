import "server-only";
import type { Storage } from "./infrastructure/postgres/storage";
import type { EmployeeDirectoryEntry } from "./contracts";
import { PostgresEmployeeDirectoryReader } from "./infrastructure/postgres/employee-directory-reader";

export function readEmployeeDirectory({ storage, unavailableError }: {
  storage: Pick<Storage, "employees">;
  unavailableError: () => Error;
}): Promise<EmployeeDirectoryEntry[]> {
  return new PostgresEmployeeDirectoryReader(storage, unavailableError).listEmployees();
}

import type { EmployeeInput, EmployeeTimesheetStatus as TimesheetStatus, EmployeeWorkdayType } from "./contracts";
import type { PayrollReaders, PayrollSalesReader } from "./application/ports/payroll";
import { listEmployees as executeListEmployees, listEmployeeCompensations as executeListCompensations, createEmployee as executeCreateEmployee, updateEmployee as executeUpdateEmployee } from "./application/employees";
import { listEmployeeTimesheets as executeListTimesheets, listEmployeeTimesheetsForMonth as executeMonthTimesheets, clockInEmployee as executeClockIn, clockOutEmployee as executeClockOut, addEmployeeLeave as executeLeave, updateEmployeeTimesheet as executeUpdateTimesheet } from "./application/attendance";
import { PostgresWorkforceStore, type WorkforceStorage } from "./infrastructure/postgres/workforce-store";
import { workforceRuntime } from "./infrastructure/workforce-runtime";
import { EmployeeTimesheetDateConflictError, EmployeeTimesheetValidationError } from "./domain/attendance-rules";
import { EmployeeTimesheetStatus } from "./contracts";
export { EmployeeTimesheetDateConflictError, EmployeeTimesheetValidationError, EmployeeTimesheetStatus };

export async function listEmployees({storage}: {storage: WorkforceStorage}) { return executeListEmployees({store:new PostgresWorkforceStore(storage)},workforceRuntime); }
export async function listEmployeeCompensations({storage}: {storage: WorkforceStorage}) { return executeListCompensations({store:new PostgresWorkforceStore(storage)}); }
export async function createEmployee({createdBy,storage,input}: {storage: WorkforceStorage;createdBy:string;input:EmployeeInput}) { return executeCreateEmployee({store:new PostgresWorkforceStore(storage),createdBy,input},workforceRuntime); }
export async function updateEmployee({employeeId,storage,input}: {storage: WorkforceStorage;employeeId:string;input:Partial<EmployeeInput>}) { return executeUpdateEmployee({store:new PostgresWorkforceStore(storage),employeeId,input},workforceRuntime); }
export async function listEmployeeTimesheets({date,storage,shopId}: {storage:WorkforceStorage;date:string;shopId?:string}) { return executeListTimesheets({store:new PostgresWorkforceStore(storage),date,shopId}); }
export async function listEmployeeTimesheetsForMonth({storage,month,shopId}: {storage:WorkforceStorage;month:string;shopId?:string}) { return executeMonthTimesheets({store:new PostgresWorkforceStore(storage),month,shopId}); }
export async function clockInEmployee({date,employeeId,storage,shopId,workdayType}: {storage:WorkforceStorage;date:string;employeeId:string;shopId:string;workdayType:EmployeeWorkdayType}) { return executeClockIn({store:new PostgresWorkforceStore(storage),date,employeeId,shopId,workdayType},workforceRuntime); }
export async function clockOutEmployee({storage,timesheetId}: {storage:WorkforceStorage;timesheetId:string}) { return executeClockOut({store:new PostgresWorkforceStore(storage),timesheetId},workforceRuntime); }
export async function addEmployeeLeave({date,employeeId,storage,shopId}: {storage:WorkforceStorage;date:string;employeeId:string;shopId:string}) { return executeLeave({store:new PostgresWorkforceStore(storage),date,employeeId,shopId},workforceRuntime); }
export async function updateEmployeeTimesheet({timesheetId,date,employeeId,shopId,status,workdayType,storage}: {storage:WorkforceStorage;timesheetId:string;date:string;employeeId:string;shopId:string;status:TimesheetStatus;workdayType:EmployeeWorkdayType|null}) { return executeUpdateTimesheet({store:new PostgresWorkforceStore(storage),timesheetId,date,employeeId,shopId,status,workdayType},{listEmployees:()=>listEmployees({storage})},workforceRuntime); }
export function createHRPayrollReaders(storage: WorkforceStorage, sales: PayrollSalesReader): PayrollReaders {
  return { employees:{listEmployees:()=>listEmployees({storage})}, compensations:{listCompensations:()=>listEmployeeCompensations({storage})}, attendance:{listAttendance:month=>listEmployeeTimesheetsForMonth({storage,month})}, sales };
}
