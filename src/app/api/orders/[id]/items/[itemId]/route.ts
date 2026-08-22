import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import { createGoogleSheetsServiceFromConfig } from "@/externals/google/sheet";
import {
  OrderItemQuantityType,
  updateOrderItemQuantity,
} from "@/services/orders";

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
  if (
    !isRecord(body) ||
    !isOrderItemQuantityType(body.quantityType) ||
    !isValidQuantity(body.quantity)
  ) {
    return NextResponse.json(
      { error: "Enter a valid quantity type and positive whole number." },
      { status: 400 },
    );
  }

  try {
    const googleSheetsService = createGoogleSheetsServiceFromConfig(getConfig());
    const result = await updateOrderItemQuantity({
      googleSheetsService,
      orderId,
      orderItemId,
      quantity: body.quantity,
      quantityType: body.quantityType,
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
        quantity: result.quantity,
        quantityType: body.quantityType,
        updatedAt: result.updatedAt,
      },
    });
  } catch (error) {
    console.error("Failed to update order product quantity", {
      orderId,
      orderItemId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to update the product quantity." },
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

function isValidQuantity(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isOrderItemQuantityType(value: unknown): value is OrderItemQuantityType {
  return Object.values(OrderItemQuantityType).includes(
    value as OrderItemQuantityType,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
