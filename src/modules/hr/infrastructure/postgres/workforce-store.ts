import "server-only";
import type { NativeRecord } from "@/infrastructure/persistence/postgres/native-records";
import { EmployeeTimesheetStatus, type Employee, type EmployeeCompensation, type EmployeeTimesheet } from "../../contracts";
import type { EmployeeStore, AttendanceStore, EmployeeSnapshot, CompensationSnapshot, EmployeeReference, TimesheetSnapshot, TimesheetReference } from "../../application/ports/workforce";
import type { Storage } from "./storage";
export class PostgresWorkforceStore implements EmployeeStore, AttendanceStore {
  private readonly employees = new WeakMap<EmployeeReference, Parameters<Storage["employees"]["update"]>[0]>();
  private readonly timesheets = new WeakMap<TimesheetReference, Parameters<Storage["employeeTimesheets"]["update"]>[0]>();
  constructor(private readonly storage: Pick<Storage, "employees" | "employeeCompensations" | "employeeTimesheets">) {}
  prepareEmployees() { return this.storage.employees.prepare(); }
  prepareCompensations() { return this.storage.employeeCompensations.prepare(); }
  prepareTimesheets() { return this.storage.employeeTimesheets.prepare(); }
  async readEmployees(): Promise<EmployeeSnapshot> {
    const records = await this.storage.employees.all();
    return { list: () => records.map(mapEmployeeRow).filter((v): v is Employee => Boolean(v)), find: id => {
      const record = records.find(r => toStringValue(r.id) === id); if (!record) return undefined;
      const reference = { read: () => mapEmployeeRow(record) }; this.employees.set(reference, record); return reference;
    } };
  }
  async readCompensations(): Promise<CompensationSnapshot> {
    const records = await this.storage.employeeCompensations.all();
    return { list: () => records.map(mapEmployeeCompensationRow).filter((v): v is EmployeeCompensation => Boolean(v)), entries: function* () { for (const record of records) yield mapEmployeeCompensationRow(record); } };
  }
  appendEmployee(value: Employee) { return this.storage.employees.insert(employeeRecord(value)); }
  updateEmployee(reference: EmployeeReference, value: Employee) { return this.storage.employees.update(this.employees.get(reference)!, employeeRecord(value)); }
  appendCompensation(value: EmployeeCompensation) { return this.storage.employeeCompensations.insert(compensationRecord(value)); }
  async readTimesheets(): Promise<TimesheetSnapshot> {
    const records = await this.storage.employeeTimesheets.all();
    return { list: () => records.map(mapTimesheetRow).filter((v): v is EmployeeTimesheet => Boolean(v)), find: id => {
      const record = records.find(r => toStringValue(r.id) === id); if (!record) return undefined;
      const reference = { read: () => mapTimesheetRow(record) }; this.timesheets.set(reference, record); return reference;
    }, some: (predicate, except) => records.some(record => except && this.timesheets.get(except) === record ? false : predicate(mapTimesheetRow(record))) };
  }
  appendTimesheet(value: EmployeeTimesheet) { return this.storage.employeeTimesheets.insert(timesheetRecord(value)); }
  updateTimesheet(reference: TimesheetReference, value: EmployeeTimesheet) { return this.storage.employeeTimesheets.update(this.timesheets.get(reference)!, timesheetRecord(value)); }
}
function employeeRecord(value: Employee) { return { id: value.id, name: value.name, phone: value.phone, status: value.status, hiredDate: value.hiredDate, terminatedDate: value.terminatedDate, createdAt: value.createdAt, updatedAt: value.updatedAt, createdBy: value.createdBy }; }
function compensationRecord(value: EmployeeCompensation) { return { employeeId: value.employeeId, baseSalary: value.baseSalary, commission: value.commission, createdAt: value.createdAt, updatedAt: value.updatedAt, updatedBy: value.updatedBy, effectiveFrom: value.effectiveFrom, compensationType: value.compensationType, commissionType: value.commissionType, commissionBucketSales: value.commissionBucketSales, commissionBucketAmount: value.commissionBucketAmount, commissionRoundupThreshold: value.commissionRoundupThreshold }; }
function timesheetRecord(value: EmployeeTimesheet) { return { id: value.id, employeeId: value.employeeId, shopId: value.shopId, status: value.status, createdAt: value.createdAt, updatedAt: value.updatedAt, workdayType: value.workdayType || "" }; }
function mapEmployeeRow(row: NativeRecord): Employee | null {
  if (row.id === "id") return null; // Preserve the existing reserved-identity filter.
  const id = toStringValue(row.id);
  const name = toStringValue(row.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    phone: toStringValue(row.phone),
    status: toStringValue(row.status) === "inactive" ? "inactive" : "active",
    hiredDate: toStringValue(row.hiredDate),
    terminatedDate: toStringValue(row.terminatedDate),
    createdAt: toStringValue(row.createdAt),
    updatedAt: toStringValue(row.updatedAt),
    createdBy: toStringValue(row.createdBy),
    compensation: null,
  };
}

function mapEmployeeCompensationRow(
  row: NativeRecord,
): EmployeeCompensation | null {
  if (row.employeeId === "employeeId") return null; // Preserve the existing reserved-identity filter.
  const employeeId = toStringValue(row.employeeId);
  if (!employeeId) return null;
  return {
    employeeId,
    baseSalary: toMoney(row.baseSalary),
    commission: toMoney(row.commission),
    createdAt: toStringValue(row.createdAt),
    updatedAt: toStringValue(row.updatedAt),
    updatedBy: toStringValue(row.updatedBy),
    effectiveFrom:
      toStringValue(row.effectiveFrom) || toStringValue(row.createdAt).slice(0, 10),
    compensationType: toStringValue(row.compensationType) === "daily" ? "daily" : "monthly",
    commissionType:
      toStringValue(row.commissionType) === "sales_bucket"
        ? "sales_bucket"
        : "none",
    commissionBucketSales: toMoney(row.commissionBucketSales),
    commissionBucketAmount: toMoney(row.commissionBucketAmount),
    commissionRoundupThreshold: toMoney(row.commissionRoundupThreshold),
  };
}

function mapTimesheetRow(row: NativeRecord): EmployeeTimesheet | null {
  if (row.id === "id") return null; // Preserve the existing reserved-identity filter.
  const id = toStringValue(row.id);
  const employeeId = toStringValue(row.employeeId);
  const shopId = toStringValue(row.shopId);
  const rawStatus = toStringValue(row.status);
  const createdAt = toStringValue(row.createdAt);
  const updatedAt = toStringValue(row.updatedAt);
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
        : toStringValue(row.workdayType) === "half"
          ? "half"
          : "full",
  };
}

function toStringValue(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function toMoney(value: unknown): number {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}

export type WorkforceStorage = Storage;
