import { withPersistence } from "@/composition/postgres/route";
import { NextResponse } from "next/server";
import { createBusinessDatabase } from "@/composition/postgres/service";
import { updateOrderDetails } from "@/modules/orders/server";
import { getOrderDetail } from "@/modules/orders/server";
import { PostgresOrderDetailShipmentProjection } from "@/modules/shipments/infrastructure/postgres/order-detail-shipment-projection";

export const runtime = "nodejs";

async function GETOperation(
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

    const storage = createBusinessDatabase();
    const order = await getOrderDetail({
      storage,
      orderId,
      shipmentProjection: new PostgresOrderDetailShipmentProjection(storage),
    });
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

async function PATCHOperation(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const orderId = id.trim();
  if (!orderId) {
    return NextResponse.json(
      { error: "Order ID is required." },
      { status: 400 },
    );
  }

  const body = await readJsonBody(request);
  const input = parseOrderUpdate(body);
  if (!input) {
    return NextResponse.json(
      { error: "Enter a valid seller, total price or remark." },
      { status: 400 },
    );
  }

  try {
    const storage = createBusinessDatabase();
    const result = await updateOrderDetails({
      storage,
      orderId,
      seller: input.seller,
      remark: input.remark,
      totalPrice: input.totalPrice,
    });
    if (result.outcome === "not_found") {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }
    if (result.outcome === "invalid_status") {
      return NextResponse.json(
        { error: "Order has an invalid status." },
        { status: 409 },
      );
    }

    return NextResponse.json({
      order: {
        id: orderId,
        ...result.order,
      },
    });
  } catch (error) {
    console.error("Failed to update order details", {
      orderId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to update the order details." },
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

function parseOrderUpdate(value: unknown): {
  seller?: string;
  totalPrice?: number;
  remark?: string;
} | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const seller = value.seller;
  const totalPrice = value.totalPrice;
  const remark = value.remark;
  if (
    (seller !== undefined &&
      (typeof seller !== "string" || seller.trim().length > 100)) ||
    (totalPrice !== undefined &&
      (typeof totalPrice !== "number" ||
        !Number.isFinite(totalPrice) ||
        totalPrice < 0)) ||
    (remark !== undefined &&
      (typeof remark !== "string" || remark.length > 1000)) ||
    (seller === undefined && totalPrice === undefined && remark === undefined)
  ) {
    return undefined;
  }

  return {
    seller: typeof seller === "string" ? seller.trim() : undefined,
    totalPrice: typeof totalPrice === "number" ? totalPrice : undefined,
    remark: typeof remark === "string" ? remark : undefined,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const GET = withPersistence(GETOperation);
export const PATCH = withPersistence(PATCHOperation);
