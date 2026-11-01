import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import { createGoogleSheetsServiceFromConfig } from "@/externals/google/sheet";
import { listEmployees } from "@/services/employees";
import { listExpenseShops } from "@/services/expenses";
import { createSalaryAdvance, readSalaryLedger, recoveredAmount, SalaryAdvanceError, transitionSalaryAdvance, money } from "@/services/employees/manageSalaryAdvances";
export const runtime = "nodejs";
function service() { return createGoogleSheetsServiceFromConfig(getConfig()); }
function fail(error: unknown) { return NextResponse.json({ ok: false, error: error instanceof SalaryAdvanceError ? error.message : "Salary advance operation failed. Please retry." }, { status: error instanceof SalaryAdvanceError ? error.status : 500 }); }
export async function GET() {
  try {
    const sheets = service();
    const [{ advances, settlements }, employees, shops] = await Promise.all([readSalaryLedger(sheets), listEmployees({ googleSheetsService: sheets }), listExpenseShops(sheets)]);
    return NextResponse.json({ ok: true, advances: advances.map(a => ({ ...a, recoveredAmount: recoveredAmount(a.id, settlements), outstandingAmount: a.status === "paid" ? money(Math.max(0, a.paidAmount - recoveredAmount(a.id, settlements))) : 0 })), employees: employees.map(({ id, name, status }) => ({ id, name, status })), shops: shops.map(({ id, name, active }) => ({ id, name, active })), settledMonths: settlements.map(({ employeeId, month }) => ({ employeeId, month })) });
  } catch (error) { return fail(error); }
}
export async function POST(request: Request) {
  try { const advance = await createSalaryAdvance(service(), await request.json().catch(() => null)); return NextResponse.json({ ok: true, advance }, { status: 201 }); } catch (error) { return fail(error); }
}
export async function PATCH(request: Request) {
  try { const advance = await transitionSalaryAdvance(service(), await request.json().catch(() => null)); return NextResponse.json({ ok: true, advance }); } catch (error) { return fail(error); }
}
