import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import { createGoogleSheetsServiceFromConfig } from "@/externals/google/sheet";
import { isRecord } from "@/features/backend/shared/utils";
import {
  isUpdatableStatus,
  isValidDeliveryFee,
  isValidPoNumber,
  readJsonBody,
} from "@/features/backend/shipments/utils";
import {
  getShipmentDetail,
  ShipmentStatus,
  updateShipmentStatus,
} from "@/services/shipments";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const shipmentId = id.trim();
  if (!shipmentId) {
    return NextResponse.json(
      { error: "Shipment ID is required." },
      { status: 400 },
    );
  }

  try {
    const googleSheetsService = createGoogleSheetsServiceFromConfig(
      getConfig(),
    );
    const shipment = await getShipmentDetail({
      googleSheetsService,
      shipmentId,
    });

    if (!shipment) {
      return NextResponse.json(
        { error: "Shipment was not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ shipment });
  } catch (error) {
    console.error("Failed to load shipment", {
      error: error instanceof Error ? error.message : String(error),
      shipmentId,
    });
    return NextResponse.json(
      { error: "Failed to load shipment." },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const shipmentId = id.trim();
  const body = await readJsonBody(request);
  if (!shipmentId || !isRecord(body) || !isUpdatableStatus(body.status)) {
    return NextResponse.json(
      { error: "Shipment ID and a valid next status are required." },
      { status: 400 },
    );
  }

  let deliveryFee: number | undefined;
  if (body.status === ShipmentStatus.Delivered) {
    if (!isValidDeliveryFee(body.deliveryFee)) {
      return NextResponse.json(
        { error: "Delivery fee must be a non-negative number." },
        { status: 400 },
      );
    }
    deliveryFee = body.deliveryFee;
  }

  let poNumber: string | undefined;
  if (body.status === ShipmentStatus.Shipping) {
    if (!isValidPoNumber(body.poNumber)) {
      return NextResponse.json(
        { error: "PO number confirmation is required." },
        { status: 400 },
      );
    }
    poNumber = body.poNumber.trim();
  }

  try {
    const googleSheetsService = createGoogleSheetsServiceFromConfig(
      getConfig(),
    );
    const result = await updateShipmentStatus({
      deliveryFee,
      googleSheetsService,
      poNumber,
      shipmentId,
      status: body.status,
    });

    if (result.outcome === "not_found") {
      return NextResponse.json(
        { error: "Shipment was not found." },
        { status: 404 },
      );
    }
    if (result.outcome === "invalid_transition") {
      return NextResponse.json(
        { error: "Shipment status has changed or cannot be advanced." },
        { status: 409 },
      );
    }
    if (result.outcome === "invalid_delivery_fee") {
      return NextResponse.json(
        { error: "Delivery fee must be a non-negative number." },
        { status: 400 },
      );
    }
    if (result.outcome === "invalid_po_number") {
      return NextResponse.json(
        { error: "Enter a valid PO number before starting shipping." },
        { status: 400 },
      );
    }

    return NextResponse.json({ shipment: result.shipment });
  } catch (error) {
    console.error("Failed to update shipment status", {
      error: error instanceof Error ? error.message : String(error),
      shipmentId,
    });
    return NextResponse.json(
      { error: "Failed to update shipment status." },
      { status: 500 },
    );
  }
}
