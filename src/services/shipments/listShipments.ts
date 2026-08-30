import type {
  GoogleSheetCellValue,
  GoogleSheetRow,
  IGoogleSheetsService,
} from "@/externals/google/sheet";
import { OrderStatus } from "../orders/createDraftOrder";
import {
  ShipmentStatus,
  type ShipmentCostSummary,
  type ShipmentListItem,
  type ShipmentQuantityCost,
  type ShipmentRelatedOrder,
  type ShipmentRelatedProductImage,
} from "./types";

type ShipmentRow = Omit<ShipmentListItem, "costSummary" | "orders">;
type RelatedOrderRow = Omit<ShipmentRelatedOrder, "productImages">;

export async function listShipments({
  excludeStatuses = [],
  googleSheetsService,
  includeOrders = true,
}: {
  excludeStatuses?: readonly ShipmentStatus[];
  googleSheetsService: IGoogleSheetsService;
  includeOrders?: boolean;
}): Promise<ShipmentListItem[]> {
  const [shipmentRows, shipmentOrderRows, orderRows, orderItemRows] =
    await Promise.all([
      googleSheetsService.shipments.readRows(),
      includeOrders
        ? googleSheetsService.shipmentOrders.readRows()
        : Promise.resolve([]),
      includeOrders
        ? googleSheetsService.orders.readRows("A:I")
        : Promise.resolve([]),
      includeOrders
        ? googleSheetsService.orderItems.readRows()
        : Promise.resolve([]),
    ]);
  const orderIdsByShipmentId = groupOrderIdsByShipmentId(shipmentOrderRows);
  const productImagesByOrderId = groupProductImagesByOrderId(orderItemRows);
  const excludedStatusSet = new Set(excludeStatuses);
  const ordersById = new Map<string, ShipmentRelatedOrder>();
  for (const row of orderRows) {
    const order = mapRelatedOrderRow(row);
    if (order) {
      ordersById.set(order.id, {
        ...order,
        productImages: productImagesByOrderId.get(order.id) ?? [],
      });
    }
  }

  return shipmentRows
    .map(mapShipmentRow)
    .filter((shipment): shipment is ShipmentRow => Boolean(shipment))
    .filter((shipment) => !excludedStatusSet.has(shipment.status))
    .map((shipment) => {
      const orders = (orderIdsByShipmentId.get(shipment.id) ?? [])
        .map((orderId) => ordersById.get(orderId))
        .filter((order): order is ShipmentRelatedOrder => Boolean(order));

      return {
        ...shipment,
        costSummary: calculateShipmentCostSummary(
          shipment.shippingFee,
          orders,
        ),
        orders,
      };
    })
    .reverse();
}

export async function getShipmentDetail({
  googleSheetsService,
  shipmentId,
}: {
  googleSheetsService: IGoogleSheetsService;
  shipmentId: string;
}): Promise<ShipmentListItem | undefined> {
  const shipments = await listShipments({ googleSheetsService });
  return shipments.find((shipment) => shipment.id === shipmentId);
}

function mapShipmentRow(row: GoogleSheetRow): ShipmentRow | undefined {
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

function groupOrderIdsByShipmentId(
  rows: GoogleSheetRow[],
): Map<string, string[]> {
  const orderIdsByShipmentId = new Map<string, string[]>();

  for (const row of rows) {
    const [, shipmentId, orderId, , , deletedAt] = row;
    const normalizedShipmentId = toStringValue(shipmentId);
    const normalizedOrderId = toStringValue(orderId);
    if (
      !normalizedShipmentId ||
      !normalizedOrderId ||
      toStringValue(deletedAt)
    ) {
      continue;
    }

    const orderIds = orderIdsByShipmentId.get(normalizedShipmentId) ?? [];
    if (!orderIds.includes(normalizedOrderId)) {
      orderIds.push(normalizedOrderId);
      orderIdsByShipmentId.set(normalizedShipmentId, orderIds);
    }
  }

  return orderIdsByShipmentId;
}

function calculateShipmentCostSummary(
  shippingFee: number | null,
  orders: ShipmentRelatedOrder[],
): ShipmentCostSummary | null {
  if (
    shippingFee === null ||
    orders.length === 0 ||
    orders.some((order) => order.totalPrice === null)
  ) {
    return null;
  }

  const totalOrderPrice = orders.reduce(
    (total, order) => total + (order.totalPrice ?? 0),
    0,
  );
  const landedTotal = totalOrderPrice + shippingFee;

  return {
    totalOrderPrice,
    shippingFee,
    quote: calculateQuantityCost(orders, "quoteQuantity", landedTotal),
    delivered: calculateQuantityCost(
      orders,
      "deliveredQuantity",
      landedTotal,
    ),
  };
}

function calculateQuantityCost(
  orders: ShipmentRelatedOrder[],
  quantityField: "quoteQuantity" | "deliveredQuantity",
  landedTotal: number,
): ShipmentQuantityCost | null {
  const quantities = orders.flatMap((order) =>
    order.productImages.map((product) =>
      toPositiveNumber(product[quantityField]),
    ),
  );
  if (
    quantities.length === 0 ||
    quantities.some((quantity) => quantity === null)
  ) {
    return null;
  }

  const totalQuantity = quantities.reduce<number>(
    (total, quantity) => total + (quantity ?? 0),
    0,
  );
  return {
    totalQuantity,
    averageLandedCostPerUnit: landedTotal / totalQuantity,
  };
}

function mapRelatedOrderRow(
  row: GoogleSheetRow,
): RelatedOrderRow | undefined {
  const [id, status, seller, totalPrice, , createdAt, , deletedAt] = row;
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
    totalPrice: toNumber(totalPrice),
    createdAt: toStringValue(createdAt),
  };
}

function groupProductImagesByOrderId(
  rows: GoogleSheetRow[],
): Map<string, ShipmentRelatedProductImage[]> {
  const productImagesByOrderId = new Map<
    string,
    ShipmentRelatedProductImage[]
  >();

  for (const row of rows) {
    const [
      id,
      orderId,
      imageUrl,
      quoteQuantity,
      deliveredQuantity,
      productCode,
      ,
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
      continue;
    }

    const images = productImagesByOrderId.get(normalizedOrderId) ?? [];
    images.push({
      id: normalizedId,
      imageUrl: normalizedImageUrl,
      quoteQuantity: toStringValue(quoteQuantity),
      deliveredQuantity: toStringValue(deliveredQuantity),
      productCode: toStringValue(productCode),
    });
    productImagesByOrderId.set(normalizedOrderId, images);
  }

  return productImagesByOrderId;
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

function toPositiveNumber(value: string): number | null {
  const number = Number(value.replace(/,/g, ""));
  return Number.isFinite(number) && number > 0 ? number : null;
}

function isShipmentStatus(value: string): value is ShipmentStatus {
  return Object.values(ShipmentStatus).includes(value as ShipmentStatus);
}

function isOrderStatus(value: string): value is OrderStatus {
  return Object.values(OrderStatus).includes(value as OrderStatus);
}
