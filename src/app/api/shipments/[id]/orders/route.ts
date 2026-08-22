import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import { createGoogleSheetsServiceFromConfig } from "@/externals/google/sheet";
import {
  linkOrderToShipment,
  LinkOrderToShipmentError,
} from "@/services/shipments";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const shipmentId = id.trim();
  const body = await readJsonBody(request);
  if (!shipmentId || !isRecord(body) || !isValidId(body.orderId)) {
    return NextResponse.json(
      { error: "Shipment ID and order ID are required." },
      { status: 400 },
    );
  }

  try {
    const googleSheetsService = createGoogleSheetsServiceFromConfig(getConfig());
    const result = await linkOrderToShipment({
      googleSheetsService,
      shipmentId,
      orderId: body.orderId.trim(),
      createdBy: "web",
    });

    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    if (error instanceof LinkOrderToShipmentError) {
      return NextResponse.json(
        { error: error.message },
        { status: getLinkErrorStatus(error) },
      );
    }

    console.error("Failed to link order to shipment", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to link order to shipment." },
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

function isValidId(value: unknown): value is string {
  return (
    typeof value === "string" && Boolean(value.trim()) && value.length <= 100
  );
}

function getLinkErrorStatus(error: LinkOrderToShipmentError): number {
  switch (error.code) {
    case "shipment_not_found":
    case "order_not_found":
      return 404;
    case "order_already_linked":
    case "shipment_not_linkable":
      return 409;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
