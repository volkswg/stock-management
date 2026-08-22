import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import { createGoogleSheetsServiceFromConfig } from "@/externals/google/sheet";
import { completeWebOrderPrice, getOrderDetail } from "@/services/orders";

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
  if (!isRecord(body) || !isValidPrice(body.totalPrice)) {
    return NextResponse.json(
      { error: "Enter a valid non-negative total price." },
      { status: 400 },
    );
  }

  try {
    const googleSheetsService = createGoogleSheetsServiceFromConfig(getConfig());
    const result = await completeWebOrderPrice({
      googleSheetsService,
      orderId,
      totalPrice: body.totalPrice,
    });
    if (result.outcome === "not_found") {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }
    if (result.outcome === "invalid_status") {
      return NextResponse.json(
        {
          error:
            "Only web orders waiting for a total price can be completed here.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      order: {
        id: orderId,
        status: result.status,
        totalPrice: result.totalPrice,
        updatedAt: result.updatedAt,
      },
    });
  } catch (error) {
    console.error("Failed to complete web order price", {
      orderId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to update the order price." },
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

function isValidPrice(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
