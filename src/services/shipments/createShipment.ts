import {
  lastColumnLetter,
  SHIPMENTS_SHEET_HEADERS,
  type IGoogleSheetsService,
} from "@/externals/google/sheet";
import { createSortableId } from "../utils/createSortableId";
import { ShipmentStatus, type Shipment } from "./types";

export async function createShipment({
  googleSheetsService,
  poNumber,
  carrier,
  createdBy,
}: {
  googleSheetsService: IGoogleSheetsService;
  poNumber: string;
  carrier?: string;
  createdBy: string;
}): Promise<Shipment> {
  const normalizedPoNumber = poNumber.trim();
  if (!normalizedPoNumber) {
    throw new Error("Shipment PO number is required.");
  }

  const now = new Date().toISOString();
  const shipment: Shipment = {
    id: createSortableId(),
    status: ShipmentStatus.Draft,
    carrier: carrier?.trim() || "",
    poNumber: normalizedPoNumber,
    shippingFee: null,
    remark: "",
    shippedAt: "",
    deliveredAt: "",
    createdAt: now,
    updatedAt: now,
    deletedAt: "",
    createdBy,
  };

  await googleSheetsService.shipments.appendRows(getShipmentsAppendRange(), [
    [
      shipment.id,
      shipment.status,
      shipment.carrier,
      shipment.poNumber,
      shipment.shippingFee,
      shipment.remark,
      shipment.shippedAt,
      shipment.deliveredAt,
      shipment.createdAt,
      shipment.updatedAt,
      shipment.deletedAt,
      shipment.createdBy,
    ],
  ]);

  return shipment;
}

function getShipmentsAppendRange(): string {
  return `A:${lastColumnLetter(SHIPMENTS_SHEET_HEADERS.length - 1)}`;
}
