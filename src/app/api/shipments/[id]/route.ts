import { withPersistence } from "@/composition/postgres/route";
import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import { createGoogleDriveServiceFromConfig } from "@/infrastructure/files/google-drive";
import { advanceShipmentStatusWithBill } from "@/modules/shipments/server";
import { createGoogleSheetsServiceFromConfig } from "@/composition/google-sheets";
import { isRecord } from "@/shared/lib/is-record";
import {
  isUpdatableStatus,
  isValidDeliveryFee,
  isValidPoNumber,
  readJsonBody,
} from "@/modules/shipments/http";
import {
  getShipmentDetail,
  updateShipmentStatus,
} from "@/modules/shipments/server";
import { ShipmentStatus } from "@/modules/shipments/contracts";

export const runtime = "nodejs";

const ALLOWED_SHIPPING_BILL_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_SHIPPING_BILL_SIZE_BYTES = 10 * 1024 * 1024;

async function GETOperation(
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

async function PATCHOperation(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const shipmentId = id.trim();
  const body = await readShipmentUpdateBody(request);
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
  let shippingBill: File | undefined;
  if (body.status === ShipmentStatus.Shipping) {
    if (!isValidPoNumber(body.poNumber)) {
      return NextResponse.json(
        { error: "PO number confirmation is required." },
        { status: 400 },
      );
    }
    poNumber = body.poNumber.trim();
    if (body.shippingBill !== undefined) {
      if (!isValidShippingBill(body.shippingBill)) {
        return NextResponse.json(
          { error: "Select a PDF, JPEG, PNG, or WebP file up to 10 MB." },
          { status: 400 },
        );
      }
      shippingBill = body.shippingBill;
    }
  }

  let workflow: Awaited<ReturnType<typeof advanceShipmentStatusWithBill>> | undefined;
  try {
    const config = getConfig();
    const googleSheetsService = createGoogleSheetsServiceFromConfig(config);
    workflow = await advanceShipmentStatusWithBill({
      shipmentId,
      shippingBill,
      createDriveService: () => createGoogleDriveServiceFromConfig(config),
      updateStatus: (shippingBillUrl) => updateShipmentStatus({
        deliveryFee,
        googleSheetsService,
        poNumber,
        shippingBillUrl,
        shipmentId,
        status: body.status as ShipmentStatus,
      }),
    });
    if (workflow.outcome === "drive_unavailable") {
      return NextResponse.json(
        { error: "Google Drive is not configured." },
        { status: 503 },
      );
    }
    const result = workflow.result;
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
    await workflow?.cleanupAfterFailure();
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

async function readShipmentUpdateBody(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.includes("multipart/form-data")) {
    return readJsonBody(request);
  }

  try {
    const formData = await request.formData();
    const shippingBill = formData.get("shippingBill");
    return {
      status: formData.get("status"),
      poNumber: formData.get("poNumber"),
      shippingBill:
        shippingBill instanceof File && shippingBill.size > 0
          ? shippingBill
          : undefined,
    };
  } catch {
    return undefined;
  }
}

function isValidShippingBill(value: unknown): value is File {
  return (
    value instanceof File &&
    value.size > 0 &&
    value.size <= MAX_SHIPPING_BILL_SIZE_BYTES &&
    ALLOWED_SHIPPING_BILL_TYPES.has(value.type)
  );
}

export const GET = withPersistence(GETOperation);
export const PATCH = withPersistence(PATCHOperation);
