import "server-only";
import type { GoogleSheetRow, IGoogleRowsSheet } from "@/infrastructure/persistence/google-sheets/types";
import { EmployeeTimesheetStatus, type Employee, type EmployeeCompensation, type EmployeeTimesheet } from "../../contracts";
import type { EmployeeStore, AttendanceStore, EmployeeSnapshot, CompensationSnapshot, EmployeeReference, TimesheetSnapshot, TimesheetReference } from "../../application/ports/workforce";
import { EMPLOYEE_HEADERS } from "./employees/const";
import { EMPLOYEE_COMPENSATION_HEADERS } from "./employee-compensations/const";
import { EMPLOYEE_TIMESHEET_HEADERS } from "./employee-timesheets/const";
export type WorkforceSheets = { readonly employees: IGoogleRowsSheet; readonly employeeCompensations: IGoogleRowsSheet; readonly employeeTimesheets: IGoogleRowsSheet };

// Snapshots defer parsing and retain original short-circuit phases. Only this
// adapter owns row locations; use cases receive semantic references and DTOs.
export class GoogleSheetsWorkforceStore implements EmployeeStore, AttendanceStore {
  private readonly locations = new WeakMap<object, number>();
  constructor(private readonly sheets: WorkforceSheets) {}
  async prepareEmployees(): Promise<void> { await ensureEmployeeHeaders(this.sheets); }
  async prepareCompensations(): Promise<void> { await ensureEmployeeCompensationHeaders(this.sheets); }
  async prepareTimesheets(): Promise<void> { await ensureTimesheetHeaders(this.sheets); }
  readEmployees(): Promise<EmployeeSnapshot> {
    return Promise.resolve(this.sheets.employees.readRows()).then(rows => ({
      list: () => rows.map(mapEmployeeRow).filter((value): value is Employee => Boolean(value)),
      find: id => {
        const index = rows.findIndex((row, i) => i > 0 && toStringValue(row[0]) === id);
        if (index < 0) return undefined;
        const reference = { read: () => mapEmployeeRow(rows[index]) };
        this.locations.set(reference, index + 1); return reference;
      },
    }));
  }
  readCompensations(): Promise<CompensationSnapshot> {
    return Promise.resolve(this.sheets.employeeCompensations.readRows()).then(rows => ({
      list: () => rows.map(mapEmployeeCompensationRow).filter((value): value is EmployeeCompensation => Boolean(value)),
      entries: function* () { for (const row of rows) yield mapEmployeeCompensationRow(row); },
    }));
  }
  async appendEmployee(employee: Employee): Promise<void> { await this.sheets.employees.appendRows("A:I", [employeeToRow(employee)]); }
  async updateEmployee(reference: EmployeeReference, employee: Employee): Promise<void> { const at = this.locations.get(reference)!; await this.sheets.employees.updateRows(`A${at}:I${at}`, [employeeToRow(employee)]); }
  async appendCompensation(compensation: EmployeeCompensation): Promise<void> { await this.sheets.employeeCompensations.appendRows("A:L", [compensationToRow(compensation)]); }
  readTimesheets(): Promise<TimesheetSnapshot> {
    return Promise.resolve(this.sheets.employeeTimesheets.readRows()).then(rows => ({
      list: () => rows.map(mapTimesheetRow).filter((value): value is EmployeeTimesheet => Boolean(value)),
      find: id => {
        const index = rows.findIndex((row, i) => i > 0 && toStringValue(row[0]) === id);
        if (index < 0) return undefined;
        const reference = { read: () => mapTimesheetRow(rows[index]) };
        this.locations.set(reference, index + 1); return reference;
      },
      some: (predicate, except) => rows.some((row, index) => except && this.locations.get(except) === index + 1 ? false : predicate(mapTimesheetRow(row))),
    }));
  }
  async appendTimesheet(timesheet: EmployeeTimesheet): Promise<void> { await this.sheets.employeeTimesheets.appendRows("A:G", [timesheetToRow(timesheet)]); }
  async updateTimesheet(reference: TimesheetReference, timesheet: EmployeeTimesheet): Promise<void> { const at = this.locations.get(reference)!; await this.sheets.employeeTimesheets.updateRows(`A${at}:G${at}`, [timesheetToRow(timesheet)]); }
}
async function ensureEmployeeHeaders(
  googleSheetsService: WorkforceSheets,
): Promise<void> {
  const rows = await googleSheetsService.employees.readRows("A1:I1");
  if (rows[0]?.join("|") !== EMPLOYEE_HEADERS.join("|")) {
    await googleSheetsService.employees.updateRows("A1:I1", [EMPLOYEE_HEADERS]);
  }
}

function mapEmployeeRow(row: GoogleSheetRow): Employee | null {
  if (!row.length || row[0] === "id") return null;
  const id = toStringValue(row[0]);
  const name = toStringValue(row[1]);
  if (!id || !name) return null;
  return {
    id,
    name,
    phone: toStringValue(row[2]),
    status: toStringValue(row[3]) === "inactive" ? "inactive" : "active",
    hiredDate: toStringValue(row[4]),
    terminatedDate: toStringValue(row[5]),
    createdAt: toStringValue(row[6]),
    updatedAt: toStringValue(row[7]),
    createdBy: toStringValue(row[8]),
    compensation: null,
  };
}

async function ensureEmployeeCompensationHeaders(
  googleSheetsService: WorkforceSheets,
): Promise<void> {
  await googleSheetsService.employeeCompensations.ensureExists?.();
  const rows = await googleSheetsService.employeeCompensations.readRows("A1:L1");
  if (rows[0]?.join("|") !== EMPLOYEE_COMPENSATION_HEADERS.join("|")) {
    await googleSheetsService.employeeCompensations.updateRows("A1:L1", [
      EMPLOYEE_COMPENSATION_HEADERS,
    ]);
  }
}

function mapEmployeeCompensationRow(
  row: GoogleSheetRow,
): EmployeeCompensation | null {
  if (!row.length || row[0] === "employeeId") return null;
  const employeeId = toStringValue(row[0]);
  if (!employeeId) return null;
  return {
    employeeId,
    baseSalary: toMoney(row[1]),
    commission: toMoney(row[2]),
    createdAt: toStringValue(row[3]),
    updatedAt: toStringValue(row[4]),
    updatedBy: toStringValue(row[5]),
    effectiveFrom:
      toStringValue(row[6]) || toStringValue(row[3]).slice(0, 10),
    compensationType: toStringValue(row[7]) === "daily" ? "daily" : "monthly",
    commissionType:
      toStringValue(row[8]) === "sales_bucket"
        ? "sales_bucket"
        : "none",
    commissionBucketSales: toMoney(row[9]),
    commissionBucketAmount: toMoney(row[10]),
    commissionRoundupThreshold: toMoney(row[11]),
  };
}

function compensationToRow(
  compensation: EmployeeCompensation,
): GoogleSheetRow {
  return [
    compensation.employeeId,
    compensation.baseSalary,
    compensation.commission,
    compensation.createdAt,
    compensation.updatedAt,
    compensation.updatedBy,
    compensation.effectiveFrom,
    compensation.compensationType,
    compensation.commissionType,
    compensation.commissionBucketSales,
    compensation.commissionBucketAmount,
    compensation.commissionRoundupThreshold,
  ];
}

function employeeToRow(employee: Employee): GoogleSheetRow {
  return [
    employee.id,
    employee.name,
    employee.phone,
    employee.status,
    employee.hiredDate,
    employee.terminatedDate,
    employee.createdAt,
    employee.updatedAt,
    employee.createdBy,
  ];
}

async function ensureTimesheetHeaders(
  googleSheetsService: WorkforceSheets,
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

function toStringValue(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function toMoney(value: unknown): number {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}
