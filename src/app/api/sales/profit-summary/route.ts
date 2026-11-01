import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import { createGoogleSheetsServiceFromConfig } from "@/externals/google/sheet";
import {
  getGoogleSheetsProfitSummary,
  listSalesProfitCostOverrides,
} from "@/services/sales";

import { listExpenses, listExpenseShops } from "@/services/expenses";

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
    const configuredAccounts = config.loyverse.accounts.map(({ id, shopName }) => ({
      id,
      shopName,
    }));
    const googleSheetsService = createGoogleSheetsServiceFromConfig(config);
    const [expenses, costOverrides, shops] = await Promise.all([
      listExpenses({ googleSheetsService, year }),
      listSalesProfitCostOverrides({ googleSheetsService, year }),
      listExpenseShops(googleSheetsService),
    ]);
    const accountMap = new Map(configuredAccounts.map(account => [account.id, account]));
    for (const shop of shops) {
      const id = shop.loyverseAccountId || shop.id;
      accountMap.set(id, { id, shopName: shop.name });
    }
    const accounts = [...accountMap.values()];
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
