import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import { createGoogleSheetsServiceFromConfig } from "@/externals/google/sheet";
import { isRecord } from "@/features/backend/shared/utils";
import {
  addEmployeeLeave,
  clockInEmployee,
  EmployeeAlreadyClockedInError,
  listEmployeeTimesheets,
  listEmployees,
  EmployeeTimesheetDateConflictError,
  EmployeeTimesheetStatus,
} from "@/services/employees";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date")?.trim() || "";
  const shopId = searchParams.get("shopId")?.trim() || "";
  if (!isValidDate(date)) {
    return NextResponse.json(
      { ok: false, error: "Enter a valid timesheet date." },
      { status: 400 },
    );
  }

  try {
    const config = getConfig();
    const shops = config.loyverse.accounts.map(({ id, shopName }) => ({
      id,
      name: shopName,
    }));
    if (shopId && !shops.some((shop) => shop.id === shopId)) {
      return NextResponse.json(
        { ok: false, error: "Shop not found." },
        { status: 400 },
      );
    }
    const googleSheetsService = createGoogleSheetsServiceFromConfig(config);
    const [employees, timesheets] = await Promise.all([
      listEmployees({ googleSheetsService }),
      listEmployeeTimesheets({ date, googleSheetsService, shopId }),
    ]);
    return NextResponse.json({
      ok: true,
      date,
      shopId: shopId || null,
      shops,
      employees,
      timesheets,
    });
  } catch (error) {
    console.error("Failed to list employee timesheets", {
      error: getErrorMessage(error),
    });
    return NextResponse.json(
      { ok: false, error: "Failed to load employee timesheets." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = await readJsonBody(request);
  const employeeId = isRecord(body) ? readString(body.employeeId) : "";
  const shopId = isRecord(body) ? readString(body.shopId) : "";
  const date = isRecord(body) ? readString(body.date) : "";
  const status = isRecord(body) ? readString(body.status) : "";
  if (
    !employeeId ||
    !shopId ||
    !isValidDate(date) ||
    (status !== EmployeeTimesheetStatus.Work &&
      status !== EmployeeTimesheetStatus.Leave)
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "Select a valid status, date, employee, and shop.",
      },
      { status: 400 },
    );
  }
  if (date > getBangkokDate()) {
    return NextResponse.json(
      { ok: false, error: "Timesheet date cannot be in the future." },
      { status: 400 },
    );
  }

  try {
    const config = getConfig();
    if (!config.loyverse.accounts.some((shop) => shop.id === shopId)) {
      return NextResponse.json(
        { ok: false, error: "Shop not found." },
        { status: 400 },
      );
    }
    const googleSheetsService = createGoogleSheetsServiceFromConfig(config);
    const employees = await listEmployees({ googleSheetsService });
    const employee = employees.find((candidate) => candidate.id === employeeId);
    if (!employee) {
      return NextResponse.json(
        { ok: false, error: "Employee not found." },
        { status: 404 },
      );
    }
    if (employee.status !== "active") {
      return NextResponse.json(
        { ok: false, error: "Inactive employees cannot be added." },
        { status: 400 },
      );
    }
    const timesheet =
      status === EmployeeTimesheetStatus.Leave
        ? await addEmployeeLeave({
            date,
            employeeId,
            googleSheetsService,
            shopId,
          })
        : await clockInEmployee({
            date,
            employeeId,
            googleSheetsService,
            shopId,
          });
    return NextResponse.json({ ok: true, timesheet }, { status: 201 });
  } catch (error) {
    if (
      error instanceof EmployeeAlreadyClockedInError ||
      error instanceof EmployeeTimesheetDateConflictError
    ) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 409 },
      );
    }
    console.error("Failed to add employee timesheet", {
      employeeId,
      shopId,
      error: getErrorMessage(error),
    });
    return NextResponse.json(
      { ok: false, error: "Failed to add employee timesheet." },
      { status: 500 },
    );
  }
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function getBangkokDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Bangkok",
    year: "numeric",
  }).format(new Date());
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
