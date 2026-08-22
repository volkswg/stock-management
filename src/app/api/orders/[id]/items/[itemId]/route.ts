import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import { createGoogleSheetsServiceFromConfig } from "@/externals/google/sheet";
import { updateOrderItemQuoteQuantity } from "@/services/orders";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
): Promise<NextResponse> {
  const { id, itemId } = await params;
  const orderId = id.trim();
  const orderItemId = itemId.trim();
  if (!orderId || !orderItemId) {
    return NextResponse.json(
      { error: "Order ID and product ID are required." },
      { status: 400 },
    );
  }

  const body = await readJsonBody(request);
  if (!isRecord(body) || !isValidQuoteQuantity(body.quoteQuantity)) {
    return NextResponse.json(
      { error: "Enter a positive whole-number quote quantity." },
      { status: 400 },
    );
  }

  try {
    const googleSheetsService = createGoogleSheetsServiceFromConfig(getConfig());
    const result = await updateOrderItemQuoteQuantity({
      googleSheetsService,
      orderId,
      orderItemId,
      quoteQuantity: body.quoteQuantity,
    });
    if (result.outcome === "not_found") {
      return NextResponse.json(
        { error: "Order product not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      item: {
        id: orderItemId,
        quoteQuantity: result.quoteQuantity,
        updatedAt: result.updatedAt,
      },
    });
  } catch (error) {
    console.error("Failed to update order product quote quantity", {
      orderId,
      orderItemId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to update the quote quantity." },
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

function isValidQuoteQuantity(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
