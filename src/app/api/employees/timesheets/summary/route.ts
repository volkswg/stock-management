import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import { createGoogleSheetsServiceFromConfig } from "@/externals/google/sheet";
import {
  listEmployees,
  listEmployeeTimesheetsForMonth,
} from "@/services/employees";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month")?.trim() || "";
  const shopId = searchParams.get("shopId")?.trim() || "";
  if (!isValidMonth(month)) {
    return NextResponse.json(
      { ok: false, error: "Enter a valid summary month." },
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
      listEmployeeTimesheetsForMonth({
        googleSheetsService,
        month,
        shopId,
      }),
    ]);
    return NextResponse.json({
      ok: true,
      month,
      shopId: shopId || null,
      shops,
      employees,
      timesheets,
    });
  } catch (error) {
    console.error("Failed to load employee timesheet summary", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, error: "Failed to load timesheet summary." },
      { status: 500 },
    );
  }
}

function isValidMonth(value: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(value)) return false;
  const month = Number(value.slice(5));
  return month >= 1 && month <= 12;
}
