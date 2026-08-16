import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import { createGoogleSheetsServiceFromConfig } from "@/externals/google/sheet";
import { listOrders } from "@/services/orders";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    const googleSheetsService = createGoogleSheetsServiceFromConfig(getConfig());
    const orders = await listOrders({ googleSheetsService });

    return NextResponse.json({ orders, total: orders.length });
  } catch (error) {
    console.error("Failed to list orders", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Failed to load orders." },
      { status: 500 },
    );
  }
}
