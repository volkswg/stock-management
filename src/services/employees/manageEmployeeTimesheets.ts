import { randomUUID } from "node:crypto";
import {
  EMPLOYEE_TIMESHEET_HEADERS,
  type GoogleSheetRow,
  type IGoogleSheetsService,
} from "@/externals/google/sheet";

export enum EmployeeTimesheetStatus {
  Work = "work",
  Leave = "leave",
}

export type EmployeeTimesheet = {
  id: string;
  employeeId: string;
  shopId: string;
  status: EmployeeTimesheetStatus;
  isOpen: boolean;
  createdAt: string;
  updatedAt: string;
};

export class EmployeeAlreadyClockedInError extends Error {}
export class EmployeeTimesheetDateConflictError extends Error {}

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
}: {
  date: string;
  employeeId: string;
  googleSheetsService: IGoogleSheetsService;
  shopId: string;
}): Promise<EmployeeTimesheet> {
  await ensureTimesheetHeaders(googleSheetsService);
  const rows = await googleSheetsService.employeeTimesheets.readRows();
  const timesheets = rows
    .map(mapTimesheetRow)
    .filter((timesheet): timesheet is EmployeeTimesheet => Boolean(timesheet));
  const hasOpenTimesheet = timesheets.some(
    (timesheet) => timesheet.employeeId === employeeId && timesheet.isOpen,
  );
  if (hasOpenTimesheet) {
    throw new EmployeeAlreadyClockedInError(
      "Employee already has an active timesheet.",
    );
  }
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
  };
  await googleSheetsService.employeeTimesheets.appendRows("A:F", [
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
  };
  await googleSheetsService.employeeTimesheets.appendRows("A:F", [
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
    `A${rowIndex + 1}:F${rowIndex + 1}`,
    [timesheetToRow(timesheet)],
  );
  return timesheet;
}

async function ensureTimesheetHeaders(
  googleSheetsService: IGoogleSheetsService,
): Promise<void> {
  const rows = await googleSheetsService.employeeTimesheets.readRows("A1:F1");
  if (rows[0]?.join("|") !== EMPLOYEE_TIMESHEET_HEADERS.join("|")) {
    await googleSheetsService.employeeTimesheets.updateRows("A1:F1", [
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
