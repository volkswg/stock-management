import type { IGoogleSheetsService } from "@/infrastructure/persistence/google-sheets/service-contracts";
import type { Employee, EmployeeCompensation, EmployeeInput, EmployeeTimesheet, EmployeeTimesheetStatus, EmployeeWorkdayType } from '../src/modules/hr/contracts';
import * as employees from '../src/services/employees/manageEmployees';
import * as attendance from '../src/services/employees/manageEmployeeTimesheets';
import type { EmployeeStore, AttendanceStore, WorkforceRuntime } from '../src/modules/hr/application/ports/workforce';
import { listEmployees } from '../src/modules/hr/application/employees';
import { listEmployeeTimesheetsForMonth } from '../src/modules/hr/application/attendance';
type Equal<A,B>=(<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
export const signatures: [
 Equal<typeof employees.listEmployees,(input:{googleSheetsService:IGoogleSheetsService})=>Promise<Employee[]>>,
 Equal<typeof employees.listEmployeeCompensations,(input:{googleSheetsService:IGoogleSheetsService})=>Promise<EmployeeCompensation[]>>,
 Equal<typeof employees.createEmployee,(input:{createdBy:string;googleSheetsService:IGoogleSheetsService;input:EmployeeInput})=>Promise<Employee>>,
 Equal<typeof employees.updateEmployee,(input:{employeeId:string;googleSheetsService:IGoogleSheetsService;input:Partial<EmployeeInput>})=>Promise<Employee|null>>,
 Equal<typeof attendance.listEmployeeTimesheets,(input:{date:string;googleSheetsService:IGoogleSheetsService;shopId?:string})=>Promise<EmployeeTimesheet[]>>,
 Equal<typeof attendance.listEmployeeTimesheetsForMonth,(input:{googleSheetsService:IGoogleSheetsService;month:string;shopId?:string})=>Promise<EmployeeTimesheet[]>>,
 Equal<typeof attendance.clockInEmployee,(input:{date:string;employeeId:string;googleSheetsService:IGoogleSheetsService;shopId:string;workdayType:EmployeeWorkdayType})=>Promise<EmployeeTimesheet>>,
 Equal<typeof attendance.addEmployeeLeave,(input:{date:string;employeeId:string;googleSheetsService:IGoogleSheetsService;shopId:string})=>Promise<EmployeeTimesheet>>,
 Equal<typeof attendance.clockOutEmployee,(input:{googleSheetsService:IGoogleSheetsService;timesheetId:string})=>Promise<EmployeeTimesheet|null>>,
 Equal<typeof attendance.updateEmployeeTimesheet,(input:{timesheetId:string;date:string;employeeId:string;shopId:string;status:EmployeeTimesheetStatus;workdayType:EmployeeWorkdayType|null;googleSheetsService:IGoogleSheetsService})=>Promise<EmployeeTimesheet|null>>,
 Equal<attendance.EmployeeTimesheetStatus.Work,EmployeeTimesheetStatus.Work>
] = [true,true,true,true,true,true,true,true,true,true,true];
export function workforcePorts(employees:EmployeeStore,attendance:AttendanceStore,runtime:WorkforceRuntime){return [listEmployees({store:employees},runtime),listEmployeeTimesheetsForMonth({store:attendance,month:'2026-11'})];}
