import { randomUUID } from "node:crypto";
import {
  EMPLOYEE_HEADERS,
  type GoogleSheetRow,
  type IGoogleSheetsService,
} from "@/externals/google/sheet";

export type EmployeeStatus = "active" | "inactive";

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
};

export type EmployeeInput = {
  name: string;
  phone: string;
  status: EmployeeStatus;
  hiredDate: string;
  terminatedDate: string;
};

export async function listEmployees({
  googleSheetsService,
}: {
  googleSheetsService: IGoogleSheetsService;
}): Promise<Employee[]> {
  const rows = await googleSheetsService.employees.readRows();
  return rows
    .map(mapEmployeeRow)
    .filter((employee): employee is Employee => Boolean(employee))
    .sort((left, right) => {
      if (left.status !== right.status) return left.status === "active" ? -1 : 1;
      return left.name.localeCompare(right.name);
    });
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
    ...input,
    terminatedDate: input.status === "active" ? "" : input.terminatedDate,
    createdAt: now,
    updatedAt: now,
    createdBy,
  };
  await googleSheetsService.employees.appendRows("A:I", [
    employeeToRow(employee),
  ]);
  return employee;
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
  const employee: Employee = {
    ...current,
    ...input,
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
  return employee;
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
  };
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
