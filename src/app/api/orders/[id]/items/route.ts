import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import { createGoogleSheetsServiceFromConfig } from "@/externals/google/sheet";
import { isRecord } from "@/features/backend/shared/utils";
import { updateOrderProducts, type OrderProductUpdate } from "@/services/orders";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const orderId = (await params).id.trim();
  if (!orderId) {
    return NextResponse.json({ error: "Order ID is required." }, { status: 400 });
  }
  const items = await readProductUpdates(request);
  if (!items) {
    return NextResponse.json({
      error: "Provide unique product IDs, product codes up to 100 characters, and positive whole-number quantities.",
    }, { status: 400 });
  }

  try {
    const result = await updateOrderProducts({
      googleSheetsService: createGoogleSheetsServiceFromConfig(getConfig()),
      orderId,
      items,
    });
    if (result.outcome === "not_found") {
      return NextResponse.json({
        error: `Order product not found: ${result.itemId}. No changes were saved.`,
      }, { status: 404 });
    }
    return NextResponse.json({ items: result.items });
  } catch (error) {
    console.error("Failed to save order products", {
      orderId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({
      error: "Could not save all product changes. Your edits are kept. Retry saving to apply them again.",
    }, { status: 500 });
  }
}

async function readProductUpdates(request: Request): Promise<OrderProductUpdate[] | undefined> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return undefined;
  }
  if (!isRecord(body) || !Array.isArray(body.items) || body.items.length === 0) return undefined;
  const items: OrderProductUpdate[] = [];
  const ids = new Set<string>();
  for (const value of body.items) {
    if (!isRecord(value) || typeof value.id !== "string" || !value.id.trim()) return undefined;
    const item: OrderProductUpdate = { id: value.id.trim() };
    if (ids.has(item.id)) return undefined;
    ids.add(item.id);
    if ("productCode" in value) {
      if (typeof value.productCode !== "string" || value.productCode.length > 100) return undefined;
      item.productCode = value.productCode.trim();
    }
    for (const field of ["quoteQuantity", "deliveredQuantity"] as const) {
      if (!(field in value)) continue;
      const quantity = value[field];
      if (typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity <= 0) return undefined;
      item[field] = quantity;
    }
    if (Object.keys(item).length === 1) return undefined;
    items.push(item);
  }
  return items;
}
