import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import { createGoogleSheetsServiceFromConfig } from "@/externals/google/sheet";
import { getOrderDetail, updateOrderDetails } from "@/services/orders";

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

export async function PATCH(
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
      { error: "Enter a valid total price or remark." },
      { status: 400 },
    );
  }

  try {
    const googleSheetsService = createGoogleSheetsServiceFromConfig(getConfig());
    const result = await updateOrderDetails({
      googleSheetsService,
      orderId,
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
  totalPrice?: number;
  remark?: string;
} | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const totalPrice = value.totalPrice;
  const remark = value.remark;
  if (
    (totalPrice !== undefined &&
      (typeof totalPrice !== "number" ||
        !Number.isFinite(totalPrice) ||
        totalPrice < 0)) ||
    (remark !== undefined &&
      (typeof remark !== "string" || remark.length > 1000)) ||
    (totalPrice === undefined && remark === undefined)
  ) {
    return undefined;
  }

  return {
    totalPrice: typeof totalPrice === "number" ? totalPrice : undefined,
    remark: typeof remark === "string" ? remark : undefined,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
