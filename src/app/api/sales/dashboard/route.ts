import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import { createGoogleSheetsServiceFromConfig } from "@/externals/google/sheet";
import {
  getGoogleSheetsSalesDashboard,
  isValidBangkokSalesDate,
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
    const accountIds = [
      ...new Set(
        (searchParams.get("accounts") || "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ];
    if (
      accountIds.some(
        (accountId) => !accounts.some((account) => account.id === accountId),
      )
    ) {
      return NextResponse.json(
        { ok: false, error: "Sales account not found." },
        { status: 404 },
      );
    }

    const today = getBangkokDate();
    const fromDate =
      searchParams.get("from")?.trim() || `${today.slice(0, 7)}-01`;
    const toDate = searchParams.get("to")?.trim() || today;
    if (
      !isValidBangkokSalesDate(fromDate) ||
      !isValidBangkokSalesDate(toDate) ||
      fromDate > toDate
    ) {
      return NextResponse.json(
        { ok: false, error: "A valid date range is required." },
        { status: 400 },
      );
    }

    const dashboard = await getGoogleSheetsSalesDashboard({
      accountIds: accountIds.length ? accountIds : undefined,
      fromDate,
      googleSheetsService: createGoogleSheetsServiceFromConfig(config),
      toDate,
    });

    return NextResponse.json({
      ok: true,
      source: "google_sheets",
      fromDate,
      toDate,
      accountIds,
      accounts,
      ...dashboard,
    });
  } catch (error) {
    console.error("Failed to load sales dashboard from Google Sheets", {
      error: getErrorMessage(error),
    });
    return NextResponse.json(
      { ok: false, error: "Failed to load sales dashboard from Google Sheets." },
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
