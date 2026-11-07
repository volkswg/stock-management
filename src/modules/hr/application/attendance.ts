import { EmployeeTimesheetStatus, type EmployeeTimesheet, type EmployeeWorkdayType } from "../contracts";
import { EmployeeTimesheetDateConflictError, EmployeeTimesheetValidationError, getBangkokDate } from "../domain/attendance-rules";
import type { AttendanceStore, WorkforceRuntime } from "./ports/workforce";
import type { PayrollEmployeeReader } from "./ports/payroll";

export async function updateEmployeeTimesheet({
  timesheetId,
  date,
  employeeId,
  shopId,
  status,
  workdayType,
  store,
}: {
  timesheetId: string;
  date: string;
  employeeId: string;
  shopId: string;
  status: EmployeeTimesheetStatus;
  workdayType: EmployeeWorkdayType | null;
  store: AttendanceStore;
}, employeesReader: PayrollEmployeeReader, runtime: WorkforceRuntime): Promise<EmployeeTimesheet | null> {
  const rows = await store.readTimesheets();
  const reference = rows.find(timesheetId);
  if (!reference) return null;
  const current = reference.read();
  if (!current) return null;

  const employees = await employeesReader.listEmployees();
  const employee = employees.find((candidate) => candidate.id === employeeId);
  if (!employee || (employee.status !== "active" && employeeId !== current.employeeId)) {
    throw new EmployeeTimesheetValidationError("Select an active employee.");
  }
  const conflict = rows.some((other) => {
    return other?.employeeId === employeeId &&
      getBangkokDate(other.createdAt) === date &&
      (status === EmployeeTimesheetStatus.Leave || other.status === EmployeeTimesheetStatus.Leave);
  }, reference);
  if (conflict) {
    throw new EmployeeTimesheetDateConflictError(
      "Employee cannot have leave and another timesheet on the same date.",
    );
  }

  const createdAt = getBangkokDate(current.createdAt) === date
    ? current.createdAt
    : runtime.timestamp(date);
  const isOpen = status === EmployeeTimesheetStatus.Work && current.isOpen;
  // Existing work rows encode an open shift with equal timestamps.
  const updatedAt = isOpen ? createdAt : runtime.nextTimestamp(createdAt);
  const timesheet: EmployeeTimesheet = {
    id: current.id,
    employeeId,
    shopId,
    status,
    isOpen,
    createdAt,
    updatedAt,
    workdayType: status === EmployeeTimesheetStatus.Work ? workdayType : null,
  };
  await store.updateTimesheet(reference, timesheet);
  return timesheet;
}

export async function listEmployeeTimesheets({
  date,
  store,
  shopId,
}: {
  date: string;
  store: AttendanceStore;
  shopId?: string;
}): Promise<EmployeeTimesheet[]> {
  const rows = await store.readTimesheets();
  return rows.list()
    .filter(
      (timesheet) =>
        getBangkokDate(timesheet.createdAt) === date &&
        (!shopId || timesheet.shopId === shopId),
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function listEmployeeTimesheetsForMonth({
  store,
  month,
  shopId,
}: {
  store: AttendanceStore;
  month: string;
  shopId?: string;
}): Promise<EmployeeTimesheet[]> {
  const rows = await store.readTimesheets();
  return rows.list()
    .filter(
      (timesheet) =>
        getBangkokDate(timesheet.createdAt).startsWith(`${month}-`) &&
        (!shopId || timesheet.shopId === shopId),
    )
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function clockInEmployee({
  date,
  employeeId,
  store,
  shopId,
  workdayType,
}: {
  date: string;
  employeeId: string;
  store: AttendanceStore;
  shopId: string;
  workdayType: EmployeeWorkdayType;
}, runtime: WorkforceRuntime): Promise<EmployeeTimesheet> {
  await store.prepareTimesheets();
  const rows = await store.readTimesheets();
  const timesheets = rows.list();
  const hasLeave = timesheets.some(
    (timesheet) =>
      timesheet.employeeId === employeeId &&
      timesheet.status === EmployeeTimesheetStatus.Leave &&
      getBangkokDate(timesheet.createdAt) === date,
  );
  if (hasLeave) {
    throw new EmployeeTimesheetDateConflictError(
      "Employee already has leave recorded for this date.",
    );
  }

  const now = runtime.timestamp(date);
  const timesheet: EmployeeTimesheet = {
    id: `ETS-${runtime.createId()}`,
    employeeId,
    shopId,
    status: EmployeeTimesheetStatus.Work,
    isOpen: true,
    createdAt: now,
    updatedAt: now,
    workdayType,
  };
  await store.appendTimesheet(timesheet);
  return timesheet;
}

export async function addEmployeeLeave({
  date,
  employeeId,
  store,
  shopId,
}: {
  date: string;
  employeeId: string;
  store: AttendanceStore;
  shopId: string;
}, runtime: WorkforceRuntime): Promise<EmployeeTimesheet> {
  await store.prepareTimesheets();
  const rows = await store.readTimesheets();
  const hasTimesheetForDate = rows.some((timesheet) => {
    return (
      timesheet?.employeeId === employeeId &&
      getBangkokDate(timesheet.createdAt) === date
    );
  });
  if (hasTimesheetForDate) {
    throw new EmployeeTimesheetDateConflictError(
      "Employee already has a timesheet for this date.",
    );
  }

  const now = runtime.timestamp(date);
  const timesheet: EmployeeTimesheet = {
    id: `ETS-${runtime.createId()}`,
    employeeId,
    shopId,
    status: EmployeeTimesheetStatus.Leave,
    isOpen: false,
    createdAt: now,
    updatedAt: now,
    workdayType: null,
  };
  await store.appendTimesheet(timesheet);
  return timesheet;
}

export async function clockOutEmployee({
  store,
  timesheetId,
}: {
  store: AttendanceStore;
  timesheetId: string;
}, runtime: WorkforceRuntime): Promise<EmployeeTimesheet | null> {
  const rows = await store.readTimesheets();
  const reference = rows.find(timesheetId);
  if (!reference) return null;

  const current = reference.read();
  if (!current) return null;
  if (current.status === EmployeeTimesheetStatus.Leave || !current.isOpen) {
    return current;
  }

  const timesheet: EmployeeTimesheet = {
    ...current,
    status: EmployeeTimesheetStatus.Work,
    isOpen: false,
    updatedAt: runtime.timestamp(
      getBangkokDate(current.createdAt),
    ),
  };
  await store.updateTimesheet(reference, timesheet);
  return timesheet;
}

