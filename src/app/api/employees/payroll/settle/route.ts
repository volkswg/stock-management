import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import { createGoogleSheetsServiceFromConfig } from "@/externals/google/sheet";
import { SalaryAdvanceError } from "@/services/employees/manageSalaryAdvances";
import { settleEmployeePayroll } from "@/services/employees/settleEmployeePayroll";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const settlement = await settleEmployeePayroll(createGoogleSheetsServiceFromConfig(getConfig()), await request.json().catch(() => null));
    return NextResponse.json({ ok: true, settlement });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof SalaryAdvanceError ? error.message : "Could not settle payroll. Please retry." }, { status: error instanceof SalaryAdvanceError ? error.status : 500 });
  }
}
