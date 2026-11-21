import { withPersistence } from "@/composition/postgres/route";
import { listLoyverseAccounts } from "@/composition/loyverse-accounts";
import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import { createBusinessDatabase } from "@/composition/postgres/service";
import {
  getDailySales,
  isValidBangkokSalesDate,
  listSalesSyncStatus,
} from "@/modules/sales/server";

export const runtime = "nodejs";

async function GETOperation(request: Request): Promise<NextResponse> {
  try {
    const config = getConfig();
    const accounts = (await listLoyverseAccounts(config)).map(({ id, shopName }) => ({
      id,
      shopName,
    }));
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("account")?.trim() || accounts[0]?.id || "";
    const account = accounts.find((candidate) => candidate.id === accountId);
    if (!account) {
      return NextResponse.json(
        { ok: false, error: "Sales account not found." },
        { status: 404 },
      );
    }

    const date = searchParams.get("date")?.trim() || getBangkokDate();
    if (!isValidBangkokSalesDate(date)) {
      return NextResponse.json(
        { ok: false, error: "A valid date in YYYY-MM-DD format is required." },
        { status: 400 },
      );
    }

    const storage = createBusinessDatabase();
    const [report, syncStatus] = await Promise.all([
      getDailySales({
        accountId,
        storage,
        salesDate: date,
      }),
      listSalesSyncStatus({
        accountId,
        storage,
        month: date.slice(0, 7),
      }),
    ]);
    const isSynced = syncStatus.rows.some(
      (row) => row.salesDate === date && row.status === "complete",
    );

    return NextResponse.json({
      ok: true,
      source: "postgres",
      date,
      account,
      accounts,
      isSynced,
      hourlyGrossSales: report.hourlyGrossSales,
      report: {
        receiptCount: report.receiptCount,
        rows: report.rows,
        paymentsByType: report.paymentsByType,
        totals: report.totals,
      },
    });
  } catch (error) {
    console.error("Failed to load daily sales", {
      error: getErrorMessage(error),
    });

    return NextResponse.json(
      { ok: false, error: "Failed to load daily sales." },
      { status: 500 },
    );
  }
}

function getBangkokDate(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Bangkok",
    year: "numeric",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value || "";
  const month = parts.find((part) => part.type === "month")?.value || "";
  const day = parts.find((part) => part.type === "day")?.value || "";
  return `${year}-${month}-${day}`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const GET = withPersistence(GETOperation);
