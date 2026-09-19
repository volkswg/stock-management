import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import {
  createGoogleDriveServiceFromConfig,
  type IGoogleDriveService,
} from "@/externals/google/drive";
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

const ALLOWED_SHIPPING_BILL_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_SHIPPING_BILL_SIZE_BYTES = 10 * 1024 * 1024;

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

  let googleDriveService: IGoogleDriveService | undefined;
  let uploadedFileId: string | undefined;
  try {
    const config = getConfig();
    const googleSheetsService = createGoogleSheetsServiceFromConfig(config);
    let shippingBillUrl: string | undefined;
    if (shippingBill) {
      googleDriveService = createGoogleDriveServiceFromConfig(config);
      if (!googleDriveService) {
        return NextResponse.json(
          { error: "Google Drive is not configured." },
          { status: 503 },
        );
      }
      const driveFile = await googleDriveService.uploadImage({
        fileName: createShippingBillFileName(shipmentId, shippingBill),
        contentType: shippingBill.type,
        bytes: Buffer.from(await shippingBill.arrayBuffer()),
      });
      uploadedFileId = driveFile.id;
      shippingBillUrl = driveFile.webViewLink;
    }

    const result = await updateShipmentStatus({
      deliveryFee,
      googleSheetsService,
      poNumber,
      shippingBillUrl,
      shipmentId,
      status: body.status,
    });

    if (result.outcome !== "updated") {
      await cleanUpUploadedFile(googleDriveService, uploadedFileId);
      uploadedFileId = undefined;
    }
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
    await cleanUpUploadedFile(googleDriveService, uploadedFileId);
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

function createShippingBillFileName(shipmentId: string, file: File): string {
  const extension =
    file.type === "application/pdf"
      ? ".pdf"
      : file.type === "image/png"
        ? ".png"
        : file.type === "image/webp"
          ? ".webp"
          : ".jpg";
  const safeShipmentId = shipmentId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `shipment-bill-${safeShipmentId}-${Date.now()}${extension}`;
}

async function cleanUpUploadedFile(
  googleDriveService: IGoogleDriveService | undefined,
  fileId: string | undefined,
): Promise<void> {
  if (!googleDriveService || !fileId) return;
  try {
    await googleDriveService.deleteFile(fileId);
  } catch (error) {
    console.error("Failed to clean up shipment bill upload", {
      fileId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
