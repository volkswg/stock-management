import { randomUUID } from "node:crypto";
import {
  EMPLOYEE_COMPENSATION_HEADERS,
  EMPLOYEE_HEADERS,
  type GoogleSheetRow,
  type IGoogleSheetsService,
} from "@/externals/google/sheet";

export type EmployeeStatus = "active" | "inactive";
export type EmployeeCompensationType = "daily" | "monthly";
export type EmployeeCommissionType = "none" | "sales_bucket";

export type Employee = {
  id: string;
  name: string;
  phone: string;
  status: EmployeeStatus;
  hiredDate: string;
  terminatedDate: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  compensation: EmployeeCompensation | null;
};

export type EmployeeCompensation = {
  employeeId: string;
  baseSalary: number;
  commission: number;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  effectiveFrom: string;
  compensationType: EmployeeCompensationType;
  commissionType: EmployeeCommissionType;
  commissionBucketSales: number;
  commissionBucketAmount: number;
  commissionRoundupThreshold: number;
};

export type EmployeeInput = {
  name: string;
  phone: string;
  status: EmployeeStatus;
  hiredDate: string;
  terminatedDate: string;
  baseSalary: number;
  commission: number;
  compensationEffectiveFrom: string;
  compensationType: EmployeeCompensationType;
  commissionType: EmployeeCommissionType;
  commissionBucketSales: number;
  commissionBucketAmount: number;
  commissionRoundupThreshold: number;
};

export async function listEmployees({
  googleSheetsService,
}: {
  googleSheetsService: IGoogleSheetsService;
}): Promise<Employee[]> {
  await ensureEmployeeCompensationHeaders(googleSheetsService);
  const [rows, compensationRows] = await Promise.all([
    googleSheetsService.employees.readRows(),
    googleSheetsService.employeeCompensations.readRows(),
  ]);
  const compensationByEmployeeId = currentCompensationsByEmployeeId(
    compensationRows,
  );
  return rows
    .map(mapEmployeeRow)
    .filter((employee): employee is Employee => Boolean(employee))
    .map((employee) => ({
      ...employee,
      compensation: compensationByEmployeeId.get(employee.id) || null,
    }))
    .sort((left, right) => {
      if (left.status !== right.status) return left.status === "active" ? -1 : 1;
      return left.name.localeCompare(right.name);
    });
}

export async function listEmployeeCompensations({
  googleSheetsService,
}: {
  googleSheetsService: IGoogleSheetsService;
}): Promise<EmployeeCompensation[]> {
  await ensureEmployeeCompensationHeaders(googleSheetsService);
  const rows = await googleSheetsService.employeeCompensations.readRows();
  return rows
    .map(mapEmployeeCompensationRow)
    .filter(
      (compensation): compensation is EmployeeCompensation =>
        Boolean(compensation),
    )
    .sort((left, right) =>
      left.effectiveFrom === right.effectiveFrom
        ? left.createdAt.localeCompare(right.createdAt)
        : left.effectiveFrom.localeCompare(right.effectiveFrom),
    );
}

export async function createEmployee({
  createdBy,
  googleSheetsService,
  input,
}: {
  createdBy: string;
  googleSheetsService: IGoogleSheetsService;
  input: EmployeeInput;
}): Promise<Employee> {
  await ensureEmployeeHeaders(googleSheetsService);
  const now = new Date().toISOString();
  const employee: Employee = {
    id: `EMP-${randomUUID()}`,
    name: input.name,
    phone: input.phone,
    status: input.status,
    hiredDate: input.hiredDate,
    terminatedDate: input.status === "active" ? "" : input.terminatedDate,
    createdAt: now,
    updatedAt: now,
    createdBy,
    compensation: null,
  };
  await googleSheetsService.employees.appendRows("A:I", [
    employeeToRow(employee),
  ]);
  const compensation = await appendEmployeeCompensation({
    employeeId: employee.id,
    baseSalary: input.baseSalary,
    commission: input.commission,
    effectiveFrom: input.compensationEffectiveFrom,
    compensationType: input.compensationType,
    commissionType: input.commissionType,
    commissionBucketSales: input.commissionBucketSales,
    commissionBucketAmount: input.commissionBucketAmount,
    commissionRoundupThreshold: input.commissionRoundupThreshold,
    googleSheetsService,
    updatedBy: createdBy,
  });
  return { ...employee, compensation };
}

export async function updateEmployee({
  employeeId,
  googleSheetsService,
  input,
}: {
  employeeId: string;
  googleSheetsService: IGoogleSheetsService;
  input: Partial<EmployeeInput>;
}): Promise<Employee | null> {
  const rows = await googleSheetsService.employees.readRows();
  const rowIndex = rows.findIndex(
    (row, index) => index > 0 && toStringValue(row[0]) === employeeId,
  );
  if (rowIndex < 0) return null;

  const current = mapEmployeeRow(rows[rowIndex]);
  if (!current) return null;
  const status = input.status ?? current.status;
  const {
    baseSalary,
    commission,
    compensationEffectiveFrom,
    compensationType,
    commissionType,
    commissionBucketSales,
    commissionBucketAmount,
    commissionRoundupThreshold,
    ...employeeInput
  } = input;
  const employee: Employee = {
    ...current,
    ...employeeInput,
    status,
    terminatedDate:
      status === "active"
        ? ""
        : input.terminatedDate || current.terminatedDate || getBangkokDate(),
    updatedAt: new Date().toISOString(),
  };
  await googleSheetsService.employees.updateRows(
    `A${rowIndex + 1}:I${rowIndex + 1}`,
    [employeeToRow(employee)],
  );
  if (
    baseSalary === undefined &&
    commission === undefined &&
    compensationType === undefined &&
    commissionType === undefined &&
    commissionBucketSales === undefined &&
    commissionBucketAmount === undefined &&
    commissionRoundupThreshold === undefined
  ) {
    return employee;
  }
  await ensureEmployeeCompensationHeaders(googleSheetsService);
  const compensationRows =
    await googleSheetsService.employeeCompensations.readRows();
  const currentCompensation =
    currentCompensationsByEmployeeId(compensationRows).get(employeeId) || null;
  const nextBaseSalary = baseSalary ?? currentCompensation?.baseSalary ?? 0;
  const nextCommission = commission ?? currentCompensation?.commission ?? 0;
  const nextCompensationType =
    compensationType ?? currentCompensation?.compensationType ?? "monthly";
  const nextCommissionType =
    commissionType ?? currentCompensation?.commissionType ?? "none";
  const currentBucketSales =
    currentCompensation?.commissionType === "sales_bucket" &&
    currentCompensation.commissionBucketSales > 0
      ? currentCompensation.commissionBucketSales
      : 10_000;
  const nextCommissionBucketSales =
    nextCommissionType === "sales_bucket"
      ? commissionBucketSales ?? currentBucketSales
      : 0;
  const currentBucketAmount =
    currentCompensation?.commissionType === "sales_bucket" &&
    currentCompensation.commissionBucketAmount > 0
      ? currentCompensation.commissionBucketAmount
      : 70;
  const nextCommissionBucketAmount =
    nextCommissionType === "sales_bucket"
      ? commissionBucketAmount ?? currentBucketAmount
      : 0;
  const currentRoundupThreshold =
    currentCompensation?.commissionType === "sales_bucket" &&
    currentCompensation.commissionRoundupThreshold > 0
      ? currentCompensation.commissionRoundupThreshold
      : 8_000;
  const nextCommissionRoundupThreshold =
    nextCommissionType === "sales_bucket"
      ? commissionRoundupThreshold ?? currentRoundupThreshold
      : 0;
  if (
    currentCompensation &&
    nextBaseSalary === currentCompensation.baseSalary &&
    nextCommission === currentCompensation.commission &&
    nextCompensationType === currentCompensation.compensationType &&
    nextCommissionType === currentCompensation.commissionType &&
    nextCommissionBucketSales === currentCompensation.commissionBucketSales &&
    nextCommissionBucketAmount === currentCompensation.commissionBucketAmount &&
    nextCommissionRoundupThreshold ===
      currentCompensation.commissionRoundupThreshold
  ) {
    return { ...employee, compensation: currentCompensation };
  }
  const compensation = await appendEmployeeCompensation({
    employeeId,
    baseSalary: nextBaseSalary,
    commission: nextCommission,
    effectiveFrom: compensationEffectiveFrom || getBangkokDate(),
    compensationType: nextCompensationType,
    commissionType: nextCommissionType,
    commissionBucketSales: nextCommissionBucketSales,
    commissionBucketAmount: nextCommissionBucketAmount,
    commissionRoundupThreshold: nextCommissionRoundupThreshold,
    googleSheetsService,
    updatedBy: "web",
  });
  return { ...employee, compensation };
}

async function ensureEmployeeHeaders(
  googleSheetsService: IGoogleSheetsService,
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
  googleSheetsService: IGoogleSheetsService,
): Promise<void> {
  await googleSheetsService.employeeCompensations.ensureExists?.();
  const rows = await googleSheetsService.employeeCompensations.readRows("A1:L1");
  if (rows[0]?.join("|") !== EMPLOYEE_COMPENSATION_HEADERS.join("|")) {
    await googleSheetsService.employeeCompensations.updateRows("A1:L1", [
      EMPLOYEE_COMPENSATION_HEADERS,
    ]);
  }
}

async function appendEmployeeCompensation({
  employeeId,
  baseSalary,
  commission,
  effectiveFrom,
  compensationType,
  commissionType,
  commissionBucketSales,
  commissionBucketAmount,
  commissionRoundupThreshold,
  googleSheetsService,
  updatedBy,
}: {
  employeeId: string;
  baseSalary: number;
  commission: number;
  effectiveFrom: string;
  compensationType: EmployeeCompensationType;
  commissionType: EmployeeCommissionType;
  commissionBucketSales: number;
  commissionBucketAmount: number;
  commissionRoundupThreshold: number;
  googleSheetsService: IGoogleSheetsService;
  updatedBy: string;
}): Promise<EmployeeCompensation> {
  await ensureEmployeeCompensationHeaders(googleSheetsService);
  const now = new Date().toISOString();
  const compensation: EmployeeCompensation = {
    employeeId,
    baseSalary,
    commission,
    createdAt: now,
    updatedAt: now,
    updatedBy,
    effectiveFrom,
    compensationType,
    commissionType,
    commissionBucketSales,
    commissionBucketAmount,
    commissionRoundupThreshold,
  };
  await googleSheetsService.employeeCompensations.appendRows("A:L", [
    compensationToRow(compensation),
  ]);
  return compensation;
}

function currentCompensationsByEmployeeId(
  rows: GoogleSheetRow[],
): Map<string, EmployeeCompensation> {
  const today = getBangkokDate();
  const current = new Map<string, EmployeeCompensation>();
  for (const row of rows) {
    const compensation = mapEmployeeCompensationRow(row);
    if (!compensation || compensation.effectiveFrom > today) continue;
    const existing = current.get(compensation.employeeId);
    if (
      !existing ||
      compensation.effectiveFrom > existing.effectiveFrom ||
      (compensation.effectiveFrom === existing.effectiveFrom &&
        compensation.createdAt > existing.createdAt)
    ) {
      current.set(compensation.employeeId, compensation);
    }
  }
  return current;
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

function getBangkokDate(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Bangkok",
    year: "numeric",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value || "";
  const month = parts.find((part) => part.type === "month")?.value || "";
  const day = parts.find((part) => part.type === "day")?.value || "";
  return `${year}-${month}-${day}`;
}

function toStringValue(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function toMoney(value: unknown): number {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}
