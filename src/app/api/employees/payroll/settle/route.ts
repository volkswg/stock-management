import { withPersistence } from "@/composition/postgres/route";
import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import { createGoogleSheetsServiceFromConfig } from "@/composition/google-sheets";
import { SalaryAdvanceError, settleEmployeePayroll } from "@/modules/hr/payroll-server";
import { createPayrollReaders } from "@/composition/hr-payroll";
export const runtime = "nodejs";
async function POSTOperation(request: Request) {
  try {
    const sheets = createGoogleSheetsServiceFromConfig(getConfig());
    const settlement = await settleEmployeePayroll(sheets, await request.json().catch(() => null), createPayrollReaders(sheets));
    return NextResponse.json({ ok: true, settlement });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof SalaryAdvanceError ? error.message : "Could not settle payroll. Please retry." }, { status: error instanceof SalaryAdvanceError ? error.status : 500 });
  }
}

export const POST = withPersistence(POSTOperation);
