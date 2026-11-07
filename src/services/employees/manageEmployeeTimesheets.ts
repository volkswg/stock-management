import { randomUUID } from "node:crypto";
import {
  EMPLOYEE_TIMESHEET_HEADERS,
  type GoogleSheetRow,
  type IGoogleSheetsService,
} from "@/externals/google/sheet";
import { listEmployees } from "./manageEmployees";

import { EmployeeTimesheetStatus } from "@/modules/hr/contracts";
export { EmployeeTimesheetStatus } from "@/modules/hr/contracts";
import type { EmployeeTimesheet, EmployeeWorkdayType } from "@/modules/hr/contracts";
export type { EmployeeTimesheet, EmployeeWorkdayType } from "@/modules/hr/contracts";

export class EmployeeTimesheetDateConflictError extends Error {}
export class EmployeeTimesheetValidationError extends Error {}

export async function updateEmployeeTimesheet({
  timesheetId,
  date,
  employeeId,
  shopId,
  status,
  workdayType,
  googleSheetsService,
}: {
  timesheetId: string;
  date: string;
  employeeId: string;
  shopId: string;
  status: EmployeeTimesheetStatus;
  workdayType: EmployeeWorkdayType | null;
  googleSheetsService: IGoogleSheetsService;
}): Promise<EmployeeTimesheet | null> {
  const rows = await googleSheetsService.employeeTimesheets.readRows();
  const rowIndex = rows.findIndex(
    (row, index) => index > 0 && toStringValue(row[0]) === timesheetId,
  );
  if (rowIndex < 0) return null;
  const current = mapTimesheetRow(rows[rowIndex]);
  if (!current) return null;

  const employees = await listEmployees({ googleSheetsService });
  const employee = employees.find((candidate) => candidate.id === employeeId);
  if (!employee || (employee.status !== "active" && employeeId !== current.employeeId)) {
    throw new EmployeeTimesheetValidationError("Select an active employee.");
  }
  const conflict = rows.some((row, index) => {
    if (index === rowIndex) return false;
    const other = mapTimesheetRow(row);
    return other?.employeeId === employeeId &&
      getBangkokDate(other.createdAt) === date &&
      (status === EmployeeTimesheetStatus.Leave || other.status === EmployeeTimesheetStatus.Leave);
  });
  if (conflict) {
    throw new EmployeeTimesheetDateConflictError(
      "Employee cannot have leave and another timesheet on the same date.",
    );
  }

  const createdAt = getBangkokDate(current.createdAt) === date
    ? current.createdAt
    : createTimestampForBangkokDate(date);
  const isOpen = status === EmployeeTimesheetStatus.Work && current.isOpen;
  // Existing work rows encode an open shift with equal timestamps.
  const updatedAt = isOpen ? createdAt : new Date(
    Math.max(Date.now(), new Date(createdAt).getTime() + 1),
  ).toISOString();
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
  await googleSheetsService.employeeTimesheets.updateRows(
    `A${rowIndex + 1}:G${rowIndex + 1}`,
    [timesheetToRow(timesheet)],
  );
  return timesheet;
}

export async function listEmployeeTimesheets({
  date,
  googleSheetsService,
  shopId,
}: {
  date: string;
  googleSheetsService: IGoogleSheetsService;
  shopId?: string;
}): Promise<EmployeeTimesheet[]> {
  const rows = await googleSheetsService.employeeTimesheets.readRows();
  return rows
    .map(mapTimesheetRow)
    .filter((timesheet): timesheet is EmployeeTimesheet => Boolean(timesheet))
    .filter(
      (timesheet) =>
        getBangkokDate(timesheet.createdAt) === date &&
        (!shopId || timesheet.shopId === shopId),
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function listEmployeeTimesheetsForMonth({
  googleSheetsService,
  month,
  shopId,
}: {
  googleSheetsService: IGoogleSheetsService;
  month: string;
  shopId?: string;
}): Promise<EmployeeTimesheet[]> {
  const rows = await googleSheetsService.employeeTimesheets.readRows();
  return rows
    .map(mapTimesheetRow)
    .filter((timesheet): timesheet is EmployeeTimesheet => Boolean(timesheet))
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
  googleSheetsService,
  shopId,
  workdayType,
}: {
  date: string;
  employeeId: string;
  googleSheetsService: IGoogleSheetsService;
  shopId: string;
  workdayType: EmployeeWorkdayType;
}): Promise<EmployeeTimesheet> {
  await ensureTimesheetHeaders(googleSheetsService);
  const rows = await googleSheetsService.employeeTimesheets.readRows();
  const timesheets = rows
    .map(mapTimesheetRow)
    .filter((timesheet): timesheet is EmployeeTimesheet => Boolean(timesheet));
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

  const now = createTimestampForBangkokDate(date);
  const timesheet: EmployeeTimesheet = {
    id: `ETS-${randomUUID()}`,
    employeeId,
    shopId,
    status: EmployeeTimesheetStatus.Work,
    isOpen: true,
    createdAt: now,
    updatedAt: now,
    workdayType,
  };
  await googleSheetsService.employeeTimesheets.appendRows("A:G", [
    timesheetToRow(timesheet),
  ]);
  return timesheet;
}

export async function addEmployeeLeave({
  date,
  employeeId,
  googleSheetsService,
  shopId,
}: {
  date: string;
  employeeId: string;
  googleSheetsService: IGoogleSheetsService;
  shopId: string;
}): Promise<EmployeeTimesheet> {
  await ensureTimesheetHeaders(googleSheetsService);
  const rows = await googleSheetsService.employeeTimesheets.readRows();
  const hasTimesheetForDate = rows.some((row) => {
    const timesheet = mapTimesheetRow(row);
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

  const now = createTimestampForBangkokDate(date);
  const timesheet: EmployeeTimesheet = {
    id: `ETS-${randomUUID()}`,
    employeeId,
    shopId,
    status: EmployeeTimesheetStatus.Leave,
    isOpen: false,
    createdAt: now,
    updatedAt: now,
    workdayType: null,
  };
  await googleSheetsService.employeeTimesheets.appendRows("A:G", [
    timesheetToRow(timesheet),
  ]);
  return timesheet;
}

export async function clockOutEmployee({
  googleSheetsService,
  timesheetId,
}: {
  googleSheetsService: IGoogleSheetsService;
  timesheetId: string;
}): Promise<EmployeeTimesheet | null> {
  const rows = await googleSheetsService.employeeTimesheets.readRows();
  const rowIndex = rows.findIndex(
    (row, index) => index > 0 && toStringValue(row[0]) === timesheetId,
  );
  if (rowIndex < 0) return null;

  const current = mapTimesheetRow(rows[rowIndex]);
  if (!current) return null;
  if (current.status === EmployeeTimesheetStatus.Leave || !current.isOpen) {
    return current;
  }

  const timesheet: EmployeeTimesheet = {
    ...current,
    status: EmployeeTimesheetStatus.Work,
    isOpen: false,
    updatedAt: createTimestampForBangkokDate(
      getBangkokDate(current.createdAt),
    ),
  };
  await googleSheetsService.employeeTimesheets.updateRows(
    `A${rowIndex + 1}:G${rowIndex + 1}`,
    [timesheetToRow(timesheet)],
  );
  return timesheet;
}

async function ensureTimesheetHeaders(
  googleSheetsService: IGoogleSheetsService,
): Promise<void> {
  const rows = await googleSheetsService.employeeTimesheets.readRows("A1:G1");
  if (rows[0]?.join("|") !== EMPLOYEE_TIMESHEET_HEADERS.join("|")) {
    await googleSheetsService.employeeTimesheets.updateRows("A1:G1", [
      EMPLOYEE_TIMESHEET_HEADERS,
    ]);
  }
}

function mapTimesheetRow(row: GoogleSheetRow): EmployeeTimesheet | null {
  if (!row.length || row[0] === "id") return null;
  const id = toStringValue(row[0]);
  const employeeId = toStringValue(row[1]);
  const shopId = toStringValue(row[2]);
  const rawStatus = toStringValue(row[3]);
  const createdAt = toStringValue(row[4]);
  const updatedAt = toStringValue(row[5]);
  if (!id || !employeeId || !shopId || !createdAt) return null;
  return {
    id,
    employeeId,
    shopId,
    status:
      rawStatus === EmployeeTimesheetStatus.Leave
        ? EmployeeTimesheetStatus.Leave
        : EmployeeTimesheetStatus.Work,
    isOpen:
      rawStatus !== EmployeeTimesheetStatus.Leave &&
      (rawStatus === "clocked_in" ||
        (rawStatus === EmployeeTimesheetStatus.Work &&
          (!updatedAt || updatedAt === createdAt))),
    createdAt,
    updatedAt,
    workdayType:
      rawStatus === EmployeeTimesheetStatus.Leave
        ? null
        : toStringValue(row[6]) === "half"
          ? "half"
          : "full",
  };
}

function timesheetToRow(timesheet: EmployeeTimesheet): GoogleSheetRow {
  return [
    timesheet.id,
    timesheet.employeeId,
    timesheet.shopId,
    timesheet.status,
    timesheet.createdAt,
    timesheet.updatedAt,
    timesheet.workdayType || "",
  ];
}

function getBangkokDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Bangkok",
    year: "numeric",
  }).format(date);
}

function createTimestampForBangkokDate(
  date: string,
  now = new Date(),
): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Bangkok",
  }).formatToParts(now);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || "00";
  const milliseconds = String(now.getMilliseconds()).padStart(3, "0");
  return new Date(
    `${date}T${getPart("hour")}:${getPart("minute")}:${getPart(
      "second",
    )}.${milliseconds}+07:00`,
  ).toISOString();
}

function toStringValue(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}
