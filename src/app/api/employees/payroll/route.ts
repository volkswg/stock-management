import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import { createGoogleSheetsServiceFromConfig } from "@/externals/google/sheet";
import { calculateEmployeePayroll } from "@/services/employees";

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
    const payroll = await calculateEmployeePayroll({
      googleSheetsService: createGoogleSheetsServiceFromConfig(getConfig()),
      month,
    });
    return NextResponse.json({ ok: true, month, payroll });
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
