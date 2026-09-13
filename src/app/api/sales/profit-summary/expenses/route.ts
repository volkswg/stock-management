import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import { createGoogleSheetsServiceFromConfig } from "@/externals/google/sheet";
import { isRecord } from "@/features/backend/shared/utils";
import {
  removeSalesProfitSharedExpense,
  saveSalesProfitSharedExpense,
  setSalesProfitExpense,
} from "@/services/sales";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const body = await readJsonBody(request);
  const month = isRecord(body) ? readString(body.month) : "";
  const accountId = isRecord(body) ? readString(body.accountId) : "";
  const amount = isRecord(body) ? readNumber(body.amount) : null;
  const note = isRecord(body) ? readString(body.note) : "";
  const scope = isRecord(body) ? readString(body.scope).toUpperCase() : "SHOP";
  const category = isRecord(body) ? readString(body.category).toUpperCase() : "";
  const name = isRecord(body) ? readString(body.name) : "";
  const id = isRecord(body) ? readString(body.id) : "";
  if (
    !isValidMonth(month) ||
    amount === null ||
    amount < 0 ||
    note.length > 200 ||
    (scope === "SHOP" && !accountId) ||
    (scope === "SHARED" &&
      (!name || name.length > 100 || !isValidCategory(category))) ||
    (scope !== "SHOP" && scope !== "SHARED")
  ) {
    return NextResponse.json(
      { ok: false, error: "Enter valid expense details." },
      { status: 400 },
    );
  }

  try {
    const config = getConfig();
    if (
      scope === "SHOP" &&
      !config.loyverse.accounts.some((account) => account.id === accountId)
    ) {
      return NextResponse.json(
        { ok: false, error: "Shop not found." },
        { status: 404 },
      );
    }
    const googleSheetsService = createGoogleSheetsServiceFromConfig(config);
    const expense =
      scope === "SHARED"
        ? await saveSalesProfitSharedExpense({
            amount,
            category,
            createdBy: "web",
            googleSheetsService,
            id: id || undefined,
            month,
            name,
            note,
          })
        : await setSalesProfitExpense({
            accountId,
            amount,
            createdBy: "web",
            googleSheetsService,
            month,
            note,
          });
    return NextResponse.json({ ok: true, expense });
  } catch (error) {
    console.error("Failed to save sales profit expense", {
      accountId,
      month,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, error: "Failed to save expense." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const body = await readJsonBody(request);
  const id = isRecord(body) ? readString(body.id) : "";
  if (!id) {
    return NextResponse.json(
      { ok: false, error: "Shared expense id is required." },
      { status: 400 },
    );
  }

  try {
    const config = getConfig();
    const removed = await removeSalesProfitSharedExpense({
      googleSheetsService: createGoogleSheetsServiceFromConfig(config),
      id,
    });
    if (!removed) {
      return NextResponse.json(
        { ok: false, error: "Shared expense not found." },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, removed: true });
  } catch (error) {
    console.error("Failed to remove shared sales profit expense", {
      id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, error: "Failed to remove shared expense." },
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

function isValidCategory(value: string): boolean {
  return ["RENT", "UTILITIES", "SALARY", "OTHER"].includes(value);
}
