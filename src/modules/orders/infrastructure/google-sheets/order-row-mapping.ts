import "server-only";
import type { GoogleSheetCellValue, GoogleSheetRow } from "@/infrastructure/persistence/google-sheets/service-contracts";
import { OrderStatus, type OrderListItem, type OrderProductImage } from "../../contracts";

export function mapOrderRow(row: GoogleSheetRow): OrderListItem | undefined {
  const [
    id,
    status,
    seller,
    totalPrice,
    remark,
    createdAt,
    updatedAt,
    deletedAt,
    createdBy,
  ] = row;

  const normalizedId = toStringValue(id);
  const normalizedStatus = toStringValue(status);
  if (
    !normalizedId ||
    !isOrderStatus(normalizedStatus) ||
    toStringValue(deletedAt)
  ) {
    return undefined;
  }

  return {
    id: normalizedId,
    status: normalizedStatus,
    seller: toStringValue(seller),
    totalPrice: toPrice(totalPrice),
    remark: toStringValue(remark),
    createdAt: toStringValue(createdAt),
    updatedAt: toStringValue(updatedAt),
    createdBy: toStringValue(createdBy),
    shipmentId: null,
    productImages: [],
  };
}

export function mapOrderProductImageRow(
  row: GoogleSheetRow,
): OrderProductImage | undefined {
  const [
    id,
    orderId,
    imageUrl,
    quoteQuantity,
    deliveredQuantity,
    productCode,
    createdAt,
    ,
    deletedAt,
  ] = row;
  const normalizedId = toStringValue(id);
  const normalizedOrderId = toStringValue(orderId);
  const normalizedImageUrl = toStringValue(imageUrl);
  if (
    !normalizedId ||
    !normalizedOrderId ||
    !normalizedImageUrl ||
    toStringValue(deletedAt)
  ) {
    return undefined;
  }

  return {
    id: normalizedId,
    orderId: normalizedOrderId,
    imageUrl: normalizedImageUrl,
    quoteQuantity: toStringValue(quoteQuantity),
    deliveredQuantity: toStringValue(deliveredQuantity),
    productCode: toStringValue(productCode),
    createdAt: toStringValue(createdAt),
  };
}

export function toStringValue(value: GoogleSheetCellValue | undefined): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

export function toPrice(value: GoogleSheetCellValue | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const price = Number(value.replace(/,/g, ""));
  return Number.isFinite(price) ? price : null;
}

export function isOrderStatus(value: string): value is OrderStatus {
  return Object.values(OrderStatus).includes(value as OrderStatus);
}
