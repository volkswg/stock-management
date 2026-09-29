import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import { createGoogleSheetsServiceFromConfig } from "@/externals/google/sheet";
import { isRecord } from "@/features/backend/shared/utils";
import {
  getMonthlyStockCounts,
  saveMonthlyStockCount,
} from "@/services/stock-counts";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  const month = new URL(request.url).searchParams.get("month")?.trim() || "";
  if (!isValidMonth(month)) {
    return NextResponse.json(
      { ok: false, error: "Enter a valid stock-count month." },
      { status: 400 },
    );
  }
  try {
    const config = getConfig();
    const accounts = config.loyverse.accounts.map(({ id, shopName }) => ({
      id,
      shopName,
    }));
    const stockCounts = await getMonthlyStockCounts({
      accounts,
      googleSheetsService: createGoogleSheetsServiceFromConfig(config),
      month,
    });
    return NextResponse.json({ ok: true, month, stockCounts });
  } catch (error) {
    console.error("Failed to load monthly stock counts", {
      error: getErrorMessage(error),
      month,
    });
    return NextResponse.json(
      { ok: false, error: "Failed to load monthly stock counts." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request): Promise<NextResponse> {
  const body = await readJsonBody(request);
  if (!isRecord(body)) {
    return invalidInput();
  }
  const month = typeof body.month === "string" ? body.month.trim() : "";
  const accountId =
    typeof body.accountId === "string" ? body.accountId.trim() : "";
  const physicalCount = body.physicalCount;
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (
    !isValidMonth(month) ||
    !accountId ||
    typeof physicalCount !== "number" ||
    !Number.isFinite(physicalCount) ||
    !Number.isInteger(physicalCount) ||
    physicalCount < 0 ||
    physicalCount > 1_000_000_000 ||
    note.length > 500
  ) {
    return invalidInput();
  }

  try {
    const config = getConfig();
    const account = config.loyverse.accounts
      .map(({ id, shopName }) => ({ id, shopName }))
      .find((candidate) => candidate.id === accountId);
    if (!account) {
      return NextResponse.json(
        { ok: false, error: "Shop not found." },
        { status: 404 },
      );
    }
    const googleSheetsService = createGoogleSheetsServiceFromConfig(config);
    await saveMonthlyStockCount({
      account,
      googleSheetsService,
      month,
      note,
      physicalCount,
      updatedBy: "web",
    });
    const stockCounts = await getMonthlyStockCounts({
      accounts: config.loyverse.accounts.map(({ id, shopName }) => ({
        id,
        shopName,
      })),
      googleSheetsService,
      month,
    });
    return NextResponse.json({ ok: true, month, stockCounts });
  } catch (error) {
    console.error("Failed to save monthly stock count", {
      accountId,
      error: getErrorMessage(error),
      month,
    });
    return NextResponse.json(
      { ok: false, error: "Failed to save the physical stock count." },
      { status: 500 },
    );
  }
}

function invalidInput(): NextResponse {
  return NextResponse.json(
    { ok: false, error: "Enter a valid shop, month, and physical count." },
    { status: 400 },
  );
}

function isValidMonth(value: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(value)) return false;
  const month = Number(value.slice(5));
  return month >= 1 && month <= 12;
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
