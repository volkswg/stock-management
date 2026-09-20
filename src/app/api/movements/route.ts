import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import { createGoogleSheetsServiceFromConfig } from "@/externals/google/sheet";
import { listMovements, type MovementDateFilter } from "@/services/movements";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  const filter = parseDateFilter(new URL(request.url).searchParams);
  if (!filter) {
    return NextResponse.json(
      { error: "Use YYYY-MM-DD for date, fromDate, and toDate." },
      { status: 400 },
    );
  }

  try {
    const records = await listMovements({
      filter,
      googleSheetsService: createGoogleSheetsServiceFromConfig(getConfig()),
    });
    return NextResponse.json({ records });
  } catch (error) {
    console.error("Failed to list movements", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to load movements." },
      { status: 500 },
    );
  }
}

function parseDateFilter(
  searchParams: URLSearchParams,
): MovementDateFilter | null {
  const date = optionalDate(searchParams.get("date"));
  const fromDate = optionalDate(searchParams.get("fromDate"));
  const toDate = optionalDate(searchParams.get("toDate"));
  if (date === null || fromDate === null || toDate === null) return null;
  return { date, fromDate, toDate };
}

function optionalDate(value: string | null): string | undefined | null {
  if (!value?.trim()) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}
