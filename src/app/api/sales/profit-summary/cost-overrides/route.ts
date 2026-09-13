import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import { createGoogleSheetsServiceFromConfig } from "@/externals/google/sheet";
import { isRecord } from "@/features/backend/shared/utils";
import {
  removeSalesProfitCostOverride,
  setSalesProfitCostOverride,
} from "@/services/sales";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const body = await readJsonBody(request);
  const month = isRecord(body) ? readString(body.month) : "";
  const accountId = isRecord(body) ? readString(body.accountId) : "";
  const averageItemCost = isRecord(body)
    ? readNumber(body.averageItemCost)
    : null;
  const note = isRecord(body) ? readString(body.note) : "";
  if (
    !isValidMonth(month) ||
    !accountId ||
    averageItemCost === null ||
    averageItemCost < 0 ||
    note.length > 200
  ) {
    return NextResponse.json(
      { ok: false, error: "Enter valid item-cost override details." },
      { status: 400 },
    );
  }

  try {
    const config = getConfig();
    if (!config.loyverse.accounts.some((account) => account.id === accountId)) {
      return NextResponse.json(
        { ok: false, error: "Shop not found." },
        { status: 404 },
      );
    }
    const costOverride = await setSalesProfitCostOverride({
      accountId,
      averageItemCost,
      createdBy: "web",
      googleSheetsService: createGoogleSheetsServiceFromConfig(config),
      month,
      note,
    });
    return NextResponse.json({ ok: true, costOverride });
  } catch (error) {
    console.error("Failed to save sales profit cost override", {
      accountId,
      month,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, error: "Failed to save item-cost override." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const body = await readJsonBody(request);
  const month = isRecord(body) ? readString(body.month) : "";
  const accountId = isRecord(body) ? readString(body.accountId) : "";
  if (!isValidMonth(month) || !accountId) {
    return NextResponse.json(
      { ok: false, error: "Enter a valid month and shop." },
      { status: 400 },
    );
  }

  try {
    const config = getConfig();
    if (!config.loyverse.accounts.some((account) => account.id === accountId)) {
      return NextResponse.json(
        { ok: false, error: "Shop not found." },
        { status: 404 },
      );
    }
    const removed = await removeSalesProfitCostOverride({
      accountId,
      googleSheetsService: createGoogleSheetsServiceFromConfig(config),
      month,
    });
    return NextResponse.json({ ok: true, removed });
  } catch (error) {
    console.error("Failed to remove sales profit cost override", {
      accountId,
      month,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, error: "Failed to remove item-cost override." },
      { status: 500 },
    );
  }
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function isValidMonth(value: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(value)) return false;
  const month = Number(value.slice(5));
  return month >= 1 && month <= 12;
}
