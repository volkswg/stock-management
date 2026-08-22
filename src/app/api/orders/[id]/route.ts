import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import { createGoogleSheetsServiceFromConfig } from "@/externals/google/sheet";
import { getOrderDetail } from "@/services/orders";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const orderId = id.trim();
    if (!orderId) {
      return NextResponse.json(
        { error: "Order ID is required." },
        { status: 400 },
      );
    }

    const googleSheetsService = createGoogleSheetsServiceFromConfig(getConfig());
    const order = await getOrderDetail({ googleSheetsService, orderId });
    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (error) {
    console.error("Failed to load order", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Failed to load order." },
      { status: 500 },
    );
  }
}
