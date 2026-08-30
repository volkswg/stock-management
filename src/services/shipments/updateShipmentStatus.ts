import type { IGoogleSheetsService } from "@/externals/google/sheet";
import { ShipmentStatus } from "./types";

export type ShipmentStatusUpdate = {
  status: ShipmentStatus;
  poNumber: string;
  shippingFee: number | null;
  shippedAt: string;
  deliveredAt: string;
  updatedAt: string;
};

export type UpdateShipmentStatusResult =
  | { outcome: "updated"; shipment: ShipmentStatusUpdate }
  | { outcome: "not_found" }
  | { outcome: "invalid_transition" }
  | { outcome: "invalid_delivery_fee" }
  | { outcome: "invalid_po_number" };

export async function updateShipmentStatus({
  deliveryFee,
  googleSheetsService,
  poNumber,
  shipmentId,
  status,
}: {
  deliveryFee?: number;
  googleSheetsService: IGoogleSheetsService;
  poNumber?: string;
  shipmentId: string;
  status: ShipmentStatus;
}): Promise<UpdateShipmentStatusResult> {
  if (
    status === ShipmentStatus.Delivered &&
    (deliveryFee === undefined ||
      !Number.isFinite(deliveryFee) ||
      deliveryFee < 0 ||
      deliveryFee > 1_000_000_000)
  ) {
    return { outcome: "invalid_delivery_fee" };
  }

  const rows = await googleSheetsService.shipments.readRows("A2:L");
  const rowIndex = rows.findIndex(
    ([id, , , , , , , , , , deletedAt]) =>
      String(id ?? "").trim() === shipmentId &&
      !String(deletedAt ?? "").trim(),
  );
  if (rowIndex === -1) {
    return { outcome: "not_found" };
  }

  const [
    ,
    currentStatus,
    carrier,
    currentPoNumber,
    currentShippingFee,
    remark,
    currentShippedAt,
    currentDeliveredAt,
    createdAt,
  ] = rows[rowIndex];
  if (!isValidTransition(String(currentStatus ?? "").trim(), status)) {
    return { outcome: "invalid_transition" };
  }
  if (
    status === ShipmentStatus.Shipping &&
    (!poNumber?.trim() || poNumber.length > 100)
  ) {
    return { outcome: "invalid_po_number" };
  }

  const now = new Date().toISOString();
  const updatedPoNumber =
    status === ShipmentStatus.Shipping
      ? (poNumber?.trim() ?? "")
      : String(currentPoNumber ?? "").trim();
  const shippingFee =
    status === ShipmentStatus.Delivered
      ? (deliveryFee ?? null)
      : toNumber(currentShippingFee);
  const shippedAt =
    status === ShipmentStatus.Shipping
      ? now
      : String(currentShippedAt ?? "").trim();
  const deliveredAt =
    status === ShipmentStatus.Delivered
      ? now
      : String(currentDeliveredAt ?? "").trim();
  const sheetRowNumber = rowIndex + 2;

  await googleSheetsService.shipments.updateRows(
    `B${sheetRowNumber}:J${sheetRowNumber}`,
    [
      [
        status,
        carrier ?? "",
        updatedPoNumber,
        shippingFee,
        remark ?? "",
        shippedAt,
        deliveredAt,
        createdAt ?? "",
        now,
      ],
    ],
  );

  return {
    outcome: "updated",
    shipment: {
      status,
      poNumber: updatedPoNumber,
      shippingFee,
      shippedAt,
      deliveredAt,
      updatedAt: now,
    },
  };
}

function isValidTransition(
  currentStatus: string,
  nextStatus: ShipmentStatus,
): boolean {
  return (
    (currentStatus === ShipmentStatus.Draft &&
      nextStatus === ShipmentStatus.ReadyToShip) ||
    (currentStatus === ShipmentStatus.ReadyToShip &&
      nextStatus === ShipmentStatus.Shipping) ||
    (currentStatus === ShipmentStatus.Shipping &&
      nextStatus === ShipmentStatus.Delivered)
  );
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const number = Number(value.replace(/,/g, ""));
  return Number.isFinite(number) ? number : null;
}
