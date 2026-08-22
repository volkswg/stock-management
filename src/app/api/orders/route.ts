import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import { createGoogleSheetsServiceFromConfig } from "@/externals/google/sheet";
import { createOrder, listOrders } from "@/services/orders";

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

export async function POST(request: Request): Promise<NextResponse> {
  const body = await readJsonBody(request);
  const input = parseCreateOrderInput(body);
  if (!input) {
    return NextResponse.json(
      { error: "Enter valid order details." },
      { status: 400 },
    );
  }

  try {
    const googleSheetsService = createGoogleSheetsServiceFromConfig(getConfig());
    const order = await createOrder({
      googleSheetsService,
      seller: input.seller,
      totalPrice: input.totalPrice,
      remark: input.remark,
      createdBy: "web",
    });

    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    console.error("Failed to create order", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to create order." },
      { status: 500 },
    );
  }
}

type CreateOrderInput = {
  seller?: string;
  totalPrice?: number | null;
  remark?: string;
};

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

function parseCreateOrderInput(value: unknown): CreateOrderInput | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const seller = value.seller;
  const totalPrice = value.totalPrice;
  const remark = value.remark;
  if (
    (seller !== undefined && typeof seller !== "string") ||
    (typeof seller === "string" && seller.trim().length > 100) ||
    (totalPrice !== undefined &&
      totalPrice !== null &&
      (typeof totalPrice !== "number" ||
        !Number.isFinite(totalPrice) ||
        totalPrice < 0)) ||
    (remark !== undefined && typeof remark !== "string") ||
    (typeof remark === "string" && remark.length > 1000)
  ) {
    return undefined;
  }

  return {
    seller: typeof seller === "string" ? seller.trim() : undefined,
    totalPrice:
      typeof totalPrice === "number" || totalPrice === null
        ? totalPrice
        : undefined,
    remark: typeof remark === "string" ? remark.trim() : undefined,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
