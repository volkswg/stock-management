import { withPersistence } from "@/composition/postgres/route";
import { listLoyverseAccounts } from "@/composition/loyverse-accounts";
import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import { createBusinessDatabase } from "@/composition/postgres/service";
import { listSalesSyncStatus } from "@/modules/sales/server";

export const runtime = "nodejs";

async function GETOperation(request: Request): Promise<NextResponse> {
  try {
    const config = getConfig();
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month")?.trim() || getBangkokMonth();
    if (!isValidMonth(month)) {
      return NextResponse.json(
        { ok: false, error: "A valid month in YYYY-MM format is required." },
        { status: 400 },
      );
    }

    const accountId = searchParams.get("account")?.trim() || "";
    const accounts = (await listLoyverseAccounts(config)).map(({ id, shopName }) => ({
      id,
      shopName,
    }));
    if (accountId && !accounts.some((account) => account.id === accountId)) {
      return NextResponse.json(
        { ok: false, error: "Loyverse account not found." },
        { status: 404 },
      );
    }

    const storage = createBusinessDatabase();
    const { rows, summary } = await listSalesSyncStatus({
      accountId: accountId || undefined,
      storage,
      month,
    });

    return NextResponse.json({
      ok: true,
      source: "postgres",
      month,
      accountId: accountId || null,
      accounts,
      rows,
      summary,
    });
  } catch (error) {
    console.error("Failed to load sales sync status", {
      error: getErrorMessage(error),
    });

    return NextResponse.json(
      { ok: false, error: "Failed to load sales sync status." },
      { status: 500 },
    );
  }
}

function getBangkokMonth(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    timeZone: "Asia/Bangkok",
    year: "numeric",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value || "";
  const month = parts.find((part) => part.type === "month")?.value || "";
  return `${year}-${month}`;
}

function isValidMonth(month: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const GET = withPersistence(GETOperation);
