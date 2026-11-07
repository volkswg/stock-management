import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import { createGoogleSheetsServiceFromConfig } from "@/externals/google/sheet";
import { createStockAdjustment, listAdjustmentEmployees, listStockAdjustments, reverseStockAdjustment, StockAdjustmentError, validStockMonth } from "@/modules/inventory/server";
export const runtime = "nodejs";
function fail(error: unknown) {
  return NextResponse.json({ ok: false, error: error instanceof StockAdjustmentError ? error.message : "Stock adjustment operation failed. Please retry." }, { status: error instanceof StockAdjustmentError ? error.status : 500 });
}
export async function GET(request: Request) {
  try {
    const month = new URL(request.url).searchParams.get("month") || "";
    if (!validStockMonth(month)) throw new StockAdjustmentError("Choose a valid adjustment month.");
    const config = getConfig(), service = createGoogleSheetsServiceFromConfig(config);
    const [records, employees] = await Promise.all([listStockAdjustments(service), listAdjustmentEmployees(service)]);
    return NextResponse.json({ ok: true, records: records.filter(a => a.date.slice(0, 7) === month), employees, accounts: config.loyverse.accounts.map(({ id, shopName }) => ({ id, shopName })) });
  } catch (error) { return fail(error); }
}
export async function POST(request: Request) {
  try {
    const config = getConfig();
    const record = await createStockAdjustment(createGoogleSheetsServiceFromConfig(config), config.loyverse.accounts.map(({ id, shopName }) => ({ id, shopName })), await request.json().catch(() => null));
    return NextResponse.json({ ok: true, record }, { status: 201 });
  } catch (error) { return fail(error); }
}
export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || body.action !== "reverse") throw new StockAdjustmentError("Choose the reverse action.");
    const record = await reverseStockAdjustment(createGoogleSheetsServiceFromConfig(getConfig()), body);
    return NextResponse.json({ ok: true, record });
  } catch (error) { return fail(error); }
}
