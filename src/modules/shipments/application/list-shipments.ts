import type {
  ShipmentCostSummary, ShipmentListItem, ShipmentQuantityCost,
  ShipmentRelatedOrder, ShipmentStatus,
} from "../contracts";
import type { ShipmentListReader } from "./ports/shipment-list-reader";

export async function listShipments(
  reader: ShipmentListReader,
  { includeOrders = true, excludeStatuses = [] }: {
    includeOrders?: boolean;
    excludeStatuses?: readonly ShipmentStatus[];
  } = {},
): Promise<ShipmentListItem[]> {
  const { shipments, orderIdsByShipmentId, ordersById } =
    await reader.readShipmentList({ includeOrders });
  const excludedStatusSet = new Set(excludeStatuses);

  return shipments
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

export async function getShipmentDetail(
  reader: ShipmentListReader,
  shipmentId: string,
): Promise<ShipmentListItem | undefined> {
  const shipments = await listShipments(reader);
  return shipments.find((shipment) => shipment.id === shipmentId);
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

function toPositiveNumber(value: string): number | null {
  const number = Number(value.replace(/,/g, ""));
  return Number.isFinite(number) && number > 0 ? number : null;
}
