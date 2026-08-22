import type {
  GoogleSheetCellValue,
  GoogleSheetRow,
  IGoogleSheetsService,
} from "@/externals/google/sheet";
import { ShipmentStatus, type ShipmentListItem } from "./types";

export async function listShipments({
  googleSheetsService,
}: {
  googleSheetsService: IGoogleSheetsService;
}): Promise<ShipmentListItem[]> {
  const rows = await googleSheetsService.shipments.readRows();

  return rows
    .map(mapShipmentRow)
    .filter((shipment): shipment is ShipmentListItem => Boolean(shipment))
    .reverse();
}

function mapShipmentRow(row: GoogleSheetRow): ShipmentListItem | undefined {
  const [
    id,
    status,
    carrier,
    poNumber,
    shippingFee,
    remark,
    shippedAt,
    deliveredAt,
    createdAt,
    updatedAt,
    deletedAt,
    createdBy,
  ] = row;
  const normalizedId = toStringValue(id);
  const normalizedStatus = toStringValue(status);
  const normalizedPoNumber = toStringValue(poNumber);
  if (
    !normalizedId ||
    !isShipmentStatus(normalizedStatus) ||
    !normalizedPoNumber ||
    toStringValue(deletedAt)
  ) {
    return undefined;
  }

  return {
    id: normalizedId,
    status: normalizedStatus,
    carrier: toStringValue(carrier),
    poNumber: normalizedPoNumber,
    shippingFee: toNumber(shippingFee),
    remark: toStringValue(remark),
    shippedAt: toStringValue(shippedAt),
    deliveredAt: toStringValue(deliveredAt),
    createdAt: toStringValue(createdAt),
    updatedAt: toStringValue(updatedAt),
    createdBy: toStringValue(createdBy),
  };
}

function toStringValue(value: GoogleSheetCellValue | undefined): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

function toNumber(value: GoogleSheetCellValue | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const number = Number(value.replace(/,/g, ""));
  return Number.isFinite(number) ? number : null;
}

function isShipmentStatus(value: string): value is ShipmentStatus {
  return Object.values(ShipmentStatus).includes(value as ShipmentStatus);
}
