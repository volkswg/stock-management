import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import { createGoogleSheetsServiceFromConfig } from "@/externals/google/sheet";
import {
  getGoogleSheetsDailySales,
  isValidBangkokSalesDate,
  listSalesSyncStatus,
} from "@/services/sales";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const config = getConfig();
    const accounts = config.loyverse.accounts.map(({ id, shopName }) => ({
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

    const googleSheetsService = createGoogleSheetsServiceFromConfig(config);
    const [report, syncStatus] = await Promise.all([
      getGoogleSheetsDailySales({
        accountId,
        googleSheetsService,
        salesDate: date,
      }),
      listSalesSyncStatus({
        accountId,
        googleSheetsService,
        month: date.slice(0, 7),
      }),
    ]);
    const isSynced = syncStatus.rows.some(
      (row) => row.salesDate === date && row.status === "complete",
    );

    return NextResponse.json({
      ok: true,
      source: "google_sheets",
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
    console.error("Failed to load daily sales from Google Sheets", {
      error: getErrorMessage(error),
    });

    return NextResponse.json(
      { ok: false, error: "Failed to load daily sales from Google Sheets." },
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
