import { payrollRevision, calculateEmployeePayroll } from "@/modules/hr/payroll-server";
import { createPayrollReaders } from "@/services/employees/payroll-composition";
import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import { createGoogleSheetsServiceFromConfig } from "@/externals/google/sheet";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  const month = new URL(request.url).searchParams.get("month")?.trim() || "";
  if (!isValidMonth(month)) {
    return NextResponse.json(
      { ok: false, error: "Enter a valid payroll month." },
      { status: 400 },
    );
  }

  try {
    const googleSheetsService = createGoogleSheetsServiceFromConfig(getConfig());
    const payroll = await calculateEmployeePayroll({
      googleSheetsService,
      readers: createPayrollReaders(googleSheetsService),
      month,
    });
    return NextResponse.json({ ok: true, month, payroll: payroll.map(record => ({ ...record, revision: payrollRevision(record) })) });
  } catch (error) {
    console.error("Failed to calculate employee payroll", {
      error: error instanceof Error ? error.message : String(error),
      month,
    });
    return NextResponse.json(
      { ok: false, error: "Failed to calculate payroll." },
      { status: 500 },
    );
  }
}

function isValidMonth(value: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(value)) return false;
  const month = Number(value.slice(5));
  return month >= 1 && month <= 12;
}
