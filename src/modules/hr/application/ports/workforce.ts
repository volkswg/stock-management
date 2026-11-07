import type { Employee, EmployeeCompensation, EmployeeTimesheet } from "../../contracts";
export interface EmployeeReference { read(): Employee | null; }
export interface EmployeeSnapshot { list(): Employee[]; find(id: string): EmployeeReference | undefined; }
export interface CompensationSnapshot { list(): EmployeeCompensation[]; entries(): Iterable<EmployeeCompensation | null>; }
export interface EmployeeStore {
  prepareEmployees(): Promise<void>;
  prepareCompensations(): Promise<void>;
  readEmployees(): Promise<EmployeeSnapshot>;
  readCompensations(): Promise<CompensationSnapshot>;
  appendEmployee(employee: Employee): Promise<void>;
  updateEmployee(reference: EmployeeReference, employee: Employee): Promise<void>;
  appendCompensation(compensation: EmployeeCompensation): Promise<void>;
}
export interface TimesheetReference { read(): EmployeeTimesheet | null; }
export interface TimesheetSnapshot {
  list(): EmployeeTimesheet[];
  find(id: string): TimesheetReference | undefined;
  some(predicate: (entry: EmployeeTimesheet | null) => boolean, except?: TimesheetReference): boolean;
}
export interface AttendanceStore {
  prepareTimesheets(): Promise<void>;
  readTimesheets(): Promise<TimesheetSnapshot>;
  appendTimesheet(timesheet: EmployeeTimesheet): Promise<void>;
  updateTimesheet(reference: TimesheetReference, timesheet: EmployeeTimesheet): Promise<void>;
}
export type WorkforceRuntime = { now(): string; today(): string; createId(): string; timestamp(date: string): string; nextTimestamp(createdAt: string): string };
