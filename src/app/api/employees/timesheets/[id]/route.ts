import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import { createGoogleSheetsServiceFromConfig } from "@/externals/google/sheet";
import { isRecord } from "@/features/backend/shared/utils";
import {
  clockOutEmployee,
  updateEmployeeTimesheet,
  EmployeeTimesheetStatus,
  EmployeeTimesheetDateConflictError,
  EmployeeTimesheetValidationError,
} from "@/modules/hr/server";

export const runtime = "nodejs";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const timesheetId = (await params).id.trim();
  if (!timesheetId) {
    return NextResponse.json(
      { ok: false, error: "Timesheet ID is required." },
      { status: 400 },
    );
  }

  try {
    const timesheet = await clockOutEmployee({
      googleSheetsService: createGoogleSheetsServiceFromConfig(getConfig()),
      timesheetId,
    });
    if (!timesheet) {
      return NextResponse.json(
        { ok: false, error: "Timesheet not found." },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, timesheet });
  } catch (error) {
    console.error("Failed to clock out employee", {
      timesheetId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, error: "Failed to clock out employee." },
      { status: 500 },
    );
  }
}

// Detail updates are separate from the legacy PATCH clock-out operation.
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const timesheetId = (await params).id.trim();
  const body: unknown = await request.json().catch(() => undefined);
  if (!timesheetId || !isRecord(body)) {
    return NextResponse.json({ ok: false, error: "Invalid timesheet details." }, { status: 400 });
  }
  const { date, employeeId, shopId, status, workdayType } = body;
  if (
    typeof date !== "string" || !isValidDate(date) ||
    typeof employeeId !== "string" || !employeeId.trim() ||
    typeof shopId !== "string" || !shopId.trim() ||
    (status !== EmployeeTimesheetStatus.Work && status !== EmployeeTimesheetStatus.Leave) ||
    (status === EmployeeTimesheetStatus.Work && workdayType !== "full" && workdayType !== "half")
  ) {
    return NextResponse.json({ ok: false, error: "Select a valid status, date, employee, and shop." }, { status: 400 });
  }
  const today = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Bangkok",
  }).format(new Date());
  if (date > today) {
    return NextResponse.json({ ok: false, error: "Timesheet date cannot be in the future." }, { status: 400 });
  }
  try {
    const config = getConfig();
    if (!config.loyverse.accounts.some((shop) => shop.id === shopId.trim())) {
      return NextResponse.json({ ok: false, error: "Shop not found." }, { status: 400 });
    }
    const timesheet = await updateEmployeeTimesheet({
      timesheetId,
      date,
      employeeId: employeeId.trim(),
      shopId: shopId.trim(),
      status,
      workdayType: status === EmployeeTimesheetStatus.Work && workdayType === "half" ? "half" : status === EmployeeTimesheetStatus.Work ? "full" : null,
      googleSheetsService: createGoogleSheetsServiceFromConfig(config),
    });
    if (!timesheet) {
      return NextResponse.json({ ok: false, error: "Timesheet not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, timesheet });
  } catch (error) {
    if (error instanceof EmployeeTimesheetDateConflictError || error instanceof EmployeeTimesheetValidationError) {
      return NextResponse.json({ ok: false, error: error.message }, {
        status: error instanceof EmployeeTimesheetDateConflictError ? 409 : 400,
      });
    }
    console.error("Failed to update employee timesheet", {
      timesheetId, error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ ok: false, error: "Failed to update employee timesheet." }, { status: 500 });
  }
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
