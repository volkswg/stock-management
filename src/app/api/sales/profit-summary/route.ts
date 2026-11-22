import { withPersistence } from "@/composition/postgres/route";
import { listLoyverseAccounts } from "@/composition/loyverse-accounts";
import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import { createBusinessDatabase } from "@/composition/postgres/service";
import {
  getProfitSummary,
  projectProfitExpenses,
  listSalesProfitCostOverrides,
} from "@/modules/sales/server";

import { listExpenses, listExpenseShops, listExpenseCategories } from "@/modules/expenses/server";

export const runtime = "nodejs";

async function GETOperation(request: Request): Promise<NextResponse> {
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
    const configuredAccounts = (await listLoyverseAccounts(config)).map(({ id, shopName }) => ({
      id,
      shopName,
    }));
    const storage = createBusinessDatabase();
    const [expenses, costOverrides, shops, categories] = await Promise.all([
      listExpenses({ storage, year }),
      listSalesProfitCostOverrides({ storage, year }),
      listExpenseShops(storage),
      listExpenseCategories(storage),
    ]);
    const accountMap = new Map(configuredAccounts.map(account => [account.id, account]));
    for (const shop of shops) {
      const id = shop.loyverseAccountId || shop.id;
      accountMap.set(id, { id, shopName: shop.name });
    }
    const accounts = [...accountMap.values()];
    const summary = await getProfitSummary({
      accounts,
      costOverrides,
      expenses: projectProfitExpenses(expenses, shops, categories),
      storage,
      year,
    });
    return NextResponse.json({
      ok: true,
      source: "postgres",
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

export const GET = withPersistence(GETOperation);
