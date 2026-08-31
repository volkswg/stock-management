import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import { createGoogleSheetsServiceFromConfig } from "@/externals/google/sheet";
import { createLoyverseAccountsFromConfig } from "@/externals/loyverse";
import { isRecord } from "@/features/backend/shared/utils";
import { syncLoyverseDailySales } from "@/services/sales";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const body = await readJsonBody(request);
  if (!isRecord(body)) {
    return NextResponse.json(
      { ok: false, error: "Account and date are required." },
      { status: 400 },
    );
  }

  const accountId = toTrimmedString(body.account);
  const date = toTrimmedString(body.date);
  if (!accountId || !isValidDate(date)) {
    return NextResponse.json(
      {
        ok: false,
        error: "A valid account and date in YYYY-MM-DD format are required.",
      },
      { status: 400 },
    );
  }

  if (date === getBangkokDate(new Date()) && isBeforeBangkokSyncCutoff()) {
    return NextResponse.json(
      {
        ok: false,
        error: "Today's sales can be synced after 20:30 Bangkok time.",
      },
      { status: 409 },
    );
  }

  try {
    const config = getConfig();
    const account = createLoyverseAccountsFromConfig(config).find(
      (candidate) => candidate.id === accountId,
    );
    if (!account) {
      return NextResponse.json(
        { ok: false, error: "Loyverse account not found." },
        { status: 404 },
      );
    }

    const result = await syncLoyverseDailySales({
      account,
      googleSheetsService: createGoogleSheetsServiceFromConfig(config),
      salesDate: date,
    });
    if (result.outcome === "already_synced") {
      return NextResponse.json(
        { ok: false, error: "Selected sales date is already synced." },
        { status: 409 },
      );
    }

    return NextResponse.json({
      ok: true,
      date,
      account: { id: account.id, shopName: account.shopName },
      ...result,
    });
  } catch (error) {
    console.error("Failed to sync Loyverse daily sales", {
      accountId,
      date,
      error: getErrorMessage(error),
    });

    return NextResponse.json(
      { ok: false, error: getErrorMessage(error) },
      { status: 502 },
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

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00+07:00`);
  return !Number.isNaN(date.getTime()) && getBangkokDate(date) === value;
}

function isBeforeBangkokSyncCutoff(): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value || 0,
  );
  return hour * 60 + minute < 20 * 60 + 30;
}

function getBangkokDate(date: Date): string {
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

function toTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
