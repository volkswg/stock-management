import "server-only";
import type { IGoogleSheetsService } from "@/externals/google/sheet/types";
import type { EmployeeDirectoryEntry } from "./contracts";
import { GoogleSheetsEmployeeDirectoryReader } from "./infrastructure/google-sheets/employee-directory-reader";

export function readEmployeeDirectory({ googleSheetsService, unavailableError }: {
  googleSheetsService: IGoogleSheetsService;
  unavailableError: () => Error;
}): Promise<EmployeeDirectoryEntry[]> {
  return new GoogleSheetsEmployeeDirectoryReader(googleSheetsService, unavailableError).listEmployees();
}

import type { EmployeeInput, EmployeeTimesheetStatus as TimesheetStatus, EmployeeWorkdayType } from "./contracts";
import type { PayrollReaders, PayrollSalesReader } from "./application/ports/payroll";
import { listEmployees as executeListEmployees, listEmployeeCompensations as executeListCompensations, createEmployee as executeCreateEmployee, updateEmployee as executeUpdateEmployee } from "./application/employees";
import { listEmployeeTimesheets as executeListTimesheets, listEmployeeTimesheetsForMonth as executeMonthTimesheets, clockInEmployee as executeClockIn, clockOutEmployee as executeClockOut, addEmployeeLeave as executeLeave, updateEmployeeTimesheet as executeUpdateTimesheet } from "./application/attendance";
import { GoogleSheetsWorkforceStore, type WorkforceSheets } from "./infrastructure/google-sheets/workforce-store";
import { workforceRuntime } from "./infrastructure/workforce-runtime";
import { EmployeeTimesheetDateConflictError, EmployeeTimesheetValidationError } from "./domain/attendance-rules";
import { EmployeeTimesheetStatus } from "./contracts";
export { EmployeeTimesheetDateConflictError, EmployeeTimesheetValidationError, EmployeeTimesheetStatus };

export async function listEmployees({googleSheetsService}: {googleSheetsService: WorkforceSheets}) { return executeListEmployees({store:new GoogleSheetsWorkforceStore(googleSheetsService)},workforceRuntime); }
export async function listEmployeeCompensations({googleSheetsService}: {googleSheetsService: WorkforceSheets}) { return executeListCompensations({store:new GoogleSheetsWorkforceStore(googleSheetsService)}); }
export async function createEmployee({createdBy,googleSheetsService,input}: {googleSheetsService: WorkforceSheets;createdBy:string;input:EmployeeInput}) { return executeCreateEmployee({store:new GoogleSheetsWorkforceStore(googleSheetsService),createdBy,input},workforceRuntime); }
export async function updateEmployee({employeeId,googleSheetsService,input}: {googleSheetsService: WorkforceSheets;employeeId:string;input:Partial<EmployeeInput>}) { return executeUpdateEmployee({store:new GoogleSheetsWorkforceStore(googleSheetsService),employeeId,input},workforceRuntime); }
export async function listEmployeeTimesheets({date,googleSheetsService,shopId}: {googleSheetsService:WorkforceSheets;date:string;shopId?:string}) { return executeListTimesheets({store:new GoogleSheetsWorkforceStore(googleSheetsService),date,shopId}); }
export async function listEmployeeTimesheetsForMonth({googleSheetsService,month,shopId}: {googleSheetsService:WorkforceSheets;month:string;shopId?:string}) { return executeMonthTimesheets({store:new GoogleSheetsWorkforceStore(googleSheetsService),month,shopId}); }
export async function clockInEmployee({date,employeeId,googleSheetsService,shopId,workdayType}: {googleSheetsService:WorkforceSheets;date:string;employeeId:string;shopId:string;workdayType:EmployeeWorkdayType}) { return executeClockIn({store:new GoogleSheetsWorkforceStore(googleSheetsService),date,employeeId,shopId,workdayType},workforceRuntime); }
export async function clockOutEmployee({googleSheetsService,timesheetId}: {googleSheetsService:WorkforceSheets;timesheetId:string}) { return executeClockOut({store:new GoogleSheetsWorkforceStore(googleSheetsService),timesheetId},workforceRuntime); }
export async function addEmployeeLeave({date,employeeId,googleSheetsService,shopId}: {googleSheetsService:WorkforceSheets;date:string;employeeId:string;shopId:string}) { return executeLeave({store:new GoogleSheetsWorkforceStore(googleSheetsService),date,employeeId,shopId},workforceRuntime); }
export async function updateEmployeeTimesheet({timesheetId,date,employeeId,shopId,status,workdayType,googleSheetsService}: {googleSheetsService:WorkforceSheets;timesheetId:string;date:string;employeeId:string;shopId:string;status:TimesheetStatus;workdayType:EmployeeWorkdayType|null}) { return executeUpdateTimesheet({store:new GoogleSheetsWorkforceStore(googleSheetsService),timesheetId,date,employeeId,shopId,status,workdayType},{listEmployees:()=>listEmployees({googleSheetsService})},workforceRuntime); }
export function createHRPayrollReaders(googleSheetsService: WorkforceSheets, sales: PayrollSalesReader): PayrollReaders {
  return { employees:{listEmployees:()=>listEmployees({googleSheetsService})}, compensations:{listCompensations:()=>listEmployeeCompensations({googleSheetsService})}, attendance:{listAttendance:month=>listEmployeeTimesheetsForMonth({googleSheetsService,month})}, sales };
}
