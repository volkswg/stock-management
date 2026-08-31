import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import {
  aggregateSalesByItem,
  createLoyverseAccountsFromConfig,
  type LoyverseReceipt,
} from "@/externals/loyverse";
import {
  getLoyverseReceiptsForSalesDate,
  isValidBangkokSalesDate,
} from "@/services/sales";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const loyverseAccounts = createLoyverseAccountsFromConfig(getConfig());
    if (loyverseAccounts.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Loyverse is not configured. Set LOYVERSE_ACCOUNTS_JSON.",
        },
        { status: 503 },
      );
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("account")?.trim() || "";
    const account = accountId
      ? loyverseAccounts.find((candidate) => candidate.id === accountId)
      : loyverseAccounts[0];
    if (!account) {
      return NextResponse.json(
        { ok: false, error: "Loyverse account not found." },
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

    const receipts = await getLoyverseReceiptsForSalesDate({
      loyverseService: account.service,
      salesDate: date,
      storeId: account.storeId,
    });
    const report = aggregateSalesByItem(receipts);

    return NextResponse.json({
      ok: true,
      source: "loyverse",
      date,
      account: { id: account.id, shopName: account.shopName },
      hourlyGrossSales: createHourlyGrossSales(receipts),
      report,
    });
  } catch (error) {
    console.error("Failed to load Loyverse daily sales", {
      error: getErrorMessage(error),
    });

    return NextResponse.json(
      { ok: false, error: getErrorMessage(error) },
      { status: 502 },
    );
  }
}

function getBangkokDate(): string {
  return getBangkokDateForDate(new Date());
}

function getBangkokDateForDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Bangkok",
    year: "numeric",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value || "";
  const month = parts.find((part) => part.type === "month")?.value || "";
  const day = parts.find((part) => part.type === "day")?.value || "";
  return `${year}-${month}-${day}`;
}

function createHourlyGrossSales(receipts: LoyverseReceipt[]): {
  hour: string;
  grossSales: number;
}[] {
  const values = Array.from({ length: 24 }, (_, hour) => ({
    hour: `${String(hour).padStart(2, "0")}:00`,
    grossSales: 0,
  }));
  const hourFormatter = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Bangkok",
  });

  for (const receipt of receipts) {
    if (receipt.cancelled_at || receipt.receipt_type !== "SALE") continue;
    const hour = Number(hourFormatter.format(new Date(receipt.receipt_date)));
    if (!Number.isInteger(hour) || !values[hour]) continue;
    values[hour].grossSales += (receipt.line_items || []).reduce(
      (sum, item) => sum + toNumber(item.gross_total_money),
      0,
    );
  }

  return values.map((value) => ({
    ...value,
    grossSales: normalizeNumber(value.grossSales),
  }));
}

function toNumber(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeNumber(value: number): number {
  return Number(value.toFixed(6));
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
