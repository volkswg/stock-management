import { withPersistence } from "@/composition/postgres/route";
import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import { createGoogleSheetsServiceFromConfig } from "@/composition/google-sheets";
import { isRecord } from "@/shared/lib/is-record";
import { ExpenseError, listExpenses, listExpenseCategories, listExpenseShops, removeExpense, saveExpense, validMonth } from "@/modules/expenses/server";
import type { ExpenseInput } from "@/modules/expenses/contracts";
export const runtime = "nodejs";
const string = (value: unknown) => typeof value === "string" ? value.trim() : "";
function failed(error: unknown) {
  if (error instanceof ExpenseError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  console.error("Expense operation failed", error instanceof Error ? error.message : "Unknown error");
  return NextResponse.json({ ok: false, error: "Expense operation failed. Please retry." }, { status: 500 });
}
async function GETOperation(request: Request) {
  const month = new URL(request.url).searchParams.get("month") || "";
  if (!validMonth(month)) return NextResponse.json({ ok: false, error: "Select a valid month." }, { status: 400 });
  try {
    const service = createGoogleSheetsServiceFromConfig(getConfig());
    const [expenses, shops, categories] = await Promise.all([listExpenses({ googleSheetsService: service, year: month.slice(0, 4) }), listExpenseShops(service), listExpenseCategories(service)]);
    return NextResponse.json({ ok: true, month, expenses: expenses.filter(row => row.month === month), shops, categories });
  } catch (error) { return failed(error); }
}
async function POSTOperation(request: Request) {
  try {
    const body: unknown = await request.json().catch(() => null);
    if (!isRecord(body) || typeof body.amount !== "number") throw new ExpenseError("Enter valid expense details.");
    const input = { requestId: string(body.requestId) || undefined, id: string(body.id) || undefined, month: string(body.month), expenseDate: string(body.expenseDate), shopId: string(body.shopId), scope: string(body.scope), categoryId: string(body.categoryId), name: string(body.name), amount: body.amount, note: string(body.note) } as ExpenseInput;
    const id = await saveExpense(createGoogleSheetsServiceFromConfig(getConfig()), input);
    return NextResponse.json({ ok: true, id });
  } catch (error) { return failed(error); }
}
async function DELETEOperation(request: Request) {
  try {
    const body: unknown = await request.json().catch(() => null);
    if (!isRecord(body) || !string(body.id)) throw new ExpenseError("Expense ID is required.");
    await removeExpense(createGoogleSheetsServiceFromConfig(getConfig()), string(body.id));
    return NextResponse.json({ ok: true });
  } catch (error) { return failed(error); }
}

export const GET = withPersistence(GETOperation);
export const POST = withPersistence(POSTOperation);
export const DELETE = withPersistence(DELETEOperation);
