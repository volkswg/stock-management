import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import { createGoogleSheetsServiceFromConfig } from "@/externals/google/sheet";
import { clockOutEmployee } from "@/services/employees";

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
