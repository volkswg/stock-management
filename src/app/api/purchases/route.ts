import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import { createGoogleSheetsServiceFromConfig } from "@/externals/google/sheet";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    const googleSheets = createGoogleSheetsServiceFromConfig(getConfig());
    const rows = await googleSheets.readPurchaseRows();

    return NextResponse.json({
      rows,
      rowCount: rows.length,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to read purchases.";

    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 },
    );
  }
}
