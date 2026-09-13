import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import { createGoogleSheetsServiceFromConfig } from "@/externals/google/sheet";
import {
  getGoogleSheetsProfitSummary,
  listSalesProfitCostOverrides,
  listSalesProfitExpenses,
} from "@/services/sales";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get("year")?.trim() || getBangkokYear();
  if (!isValidYear(year)) {
    return NextResponse.json(
      { ok: false, error: "Enter a valid profit summary year." },
      { status: 400 },
    );
  }

  try {
    const config = getConfig();
    const accounts = config.loyverse.accounts.map(({ id, shopName }) => ({
      id,
      shopName,
    }));
    const googleSheetsService = createGoogleSheetsServiceFromConfig(config);
    const [expenses, costOverrides] = await Promise.all([
      listSalesProfitExpenses({ googleSheetsService, year }),
      listSalesProfitCostOverrides({ googleSheetsService, year }),
    ]);
    const summary = await getGoogleSheetsProfitSummary({
      accounts,
      costOverrides,
      expenses,
      googleSheetsService,
      year,
    });
    return NextResponse.json({
      ok: true,
      source: "google_sheets",
      accounts,
      ...summary,
    });
  } catch (error) {
    console.error("Failed to load sales profit summary", {
      year,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, error: "Failed to load sales profit summary." },
      { status: 500 },
    );
  }
}

function getBangkokYear(): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
  }).format(new Date());
}

function isValidYear(value: string): boolean {
  return /^\d{4}$/.test(value) && Number(value) >= 2000 && Number(value) <= 2100;
}
