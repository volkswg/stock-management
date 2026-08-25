import type {
  GoogleSheetCellValue,
  GoogleSheetRow,
  IGoogleSheetsService,
} from "@/externals/google/sheet";
import { ShipmentStatus, type Shipment } from "@/services/shipments";
import { OrderStatus } from "./createDraftOrder";

export type OrderListItem = {
  id: string;
  status: OrderStatus;
  seller: string;
  totalPrice: number | null;
  remark: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  productImages: OrderProductImage[];
};

export type OrderProductImage = {
  id: string;
  orderId: string;
  imageUrl: string;
  quoteQuantity: string;
  deliveredQuantity: string;
  productCode: string;
  createdAt: string;
};

export type OrderBillImage = {
  id: string;
  orderId: string;
  imageUrl: string;
  createdAt: string;
};

export type OrderDetail = OrderListItem & {
  billImages: OrderBillImage[];
  shipmentId: string | null;
  shipment: Shipment | null;
};

export async function listOrders({
  googleSheetsService,
}: {
  googleSheetsService: IGoogleSheetsService;
}): Promise<OrderListItem[]> {
  const [orderRows, orderItemRows] = await Promise.all([
    googleSheetsService.orders.readRows("A:I"),
    googleSheetsService.orderItems.readRows(),
  ]);
  const productImagesByOrderId = groupProductImagesByOrderId(orderItemRows);

  return orderRows
    .map(mapOrderRow)
    .filter((order): order is OrderListItem => Boolean(order))
    .map((order) => ({
      ...order,
      productImages: productImagesByOrderId.get(order.id) ?? [],
    }))
    .reverse();
}

export async function getOrderDetail({
  googleSheetsService,
  orderId,
}: {
  googleSheetsService: IGoogleSheetsService;
  orderId: string;
}): Promise<OrderDetail | undefined> {
  const [
    orderRows,
    orderItemRows,
    orderBillRows,
    shipmentOrderRows,
    shipmentRows,
  ] =
    await Promise.all([
      googleSheetsService.orders.readRows("A:I"),
      googleSheetsService.orderItems.readRows(),
      googleSheetsService.orderBills.readRows(),
      googleSheetsService.shipmentOrders.readRows(),
      googleSheetsService.shipments.readRows(),
    ]);
  const order = orderRows
    .map(mapOrderRow)
    .find((candidate) => candidate?.id === orderId);

  if (!order) {
    return undefined;
  }

  const shipmentId = findShipmentIdForOrder(shipmentOrderRows, orderId);

  return {
    ...order,
    productImages: orderItemRows
      .map(mapOrderProductImageRow)
      .filter(
        (image): image is OrderProductImage => image?.orderId === orderId,
      ),
    billImages: orderBillRows
      .map(mapOrderBillImageRow)
      .filter((image): image is OrderBillImage => image?.orderId === orderId),
    shipmentId,
    shipment: shipmentId
      ? (shipmentRows
          .map(mapShipmentRow)
          .find((shipment) => shipment?.id === shipmentId) ?? null)
      : null,
  };
}

function findShipmentIdForOrder(
  rows: GoogleSheetRow[],
  orderId: string,
): string | null {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const [, shipmentId, linkedOrderId, , , deletedAt] = rows[index];
    if (
      toStringValue(linkedOrderId) === orderId &&
      !toStringValue(deletedAt)
    ) {
      return toStringValue(shipmentId) || null;
    }
  }
  return null;
}

function mapOrderRow(row: GoogleSheetRow): OrderListItem | undefined {
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
    productImages: [],
  };
}

function groupProductImagesByOrderId(
  rows: GoogleSheetRow[],
): Map<string, OrderProductImage[]> {
  const productImagesByOrderId = new Map<string, OrderProductImage[]>();

  for (const row of rows) {
    const productImage = mapOrderProductImageRow(row);
    if (!productImage) {
      continue;
    }

    const productImages = productImagesByOrderId.get(productImage.orderId) ?? [];
    productImages.push(productImage);
    productImagesByOrderId.set(productImage.orderId, productImages);
  }

  return productImagesByOrderId;
}

function mapOrderProductImageRow(
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

function mapOrderBillImageRow(
  row: GoogleSheetRow,
): OrderBillImage | undefined {
  const [id, orderId, imageUrl, createdAt, , deletedAt] = row;
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
    createdAt: toStringValue(createdAt),
  };
}

function mapShipmentRow(row: GoogleSheetRow): Shipment | undefined {
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
    shippingFee: toPrice(shippingFee),
    remark: toStringValue(remark),
    shippedAt: toStringValue(shippedAt),
    deliveredAt: toStringValue(deliveredAt),
    deletedAt: toStringValue(deletedAt),
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

function toPrice(value: GoogleSheetCellValue | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const price = Number(value.replace(/,/g, ""));
  return Number.isFinite(price) ? price : null;
}

function isOrderStatus(value: string): value is OrderStatus {
  return Object.values(OrderStatus).includes(value as OrderStatus);
}

function isShipmentStatus(value: string): value is ShipmentStatus {
  return Object.values(ShipmentStatus).includes(value as ShipmentStatus);
}
