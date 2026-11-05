import type * as Leaf from "../src/services/shipments/types";
import type * as Physical from "../src/modules/shipments/status";
import type { OrderShipment } from "../src/modules/orders/contracts";
import type * as Public from "../src/modules/shipments/contracts";
import type * as Legacy from "../src/services/shipments";
import type { OrderStatus } from "../src/modules/orders/contracts";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
export type ShipmentCompatibility = [
  Assert<Equal<Public.ShipmentOrder, Leaf.ShipmentOrder>>,
  Assert<Equal<Public.ShipmentStatusUpdate, Leaf.ShipmentStatusUpdate>>,
  Assert<Equal<Public.ShipmentCostSummary, Leaf.ShipmentCostSummary>>,
  Assert<Equal<Public.ShipmentQuantityCost, Leaf.ShipmentQuantityCost>>,
  Assert<Equal<Public.ShipmentRelatedProductImage, Leaf.ShipmentRelatedProductImage>>,
  Assert<Equal<Public.ShipmentRelatedOrder, Leaf.ShipmentRelatedOrder>>,
  Assert<Equal<Public.ShipmentListItem, Leaf.ShipmentListItem>>,
  Assert<Equal<Public.Shipment, Leaf.Shipment>>,
  Assert<Equal<Public.ShipmentStatus, Physical.ShipmentStatus>>,
  Assert<Equal<Leaf.ShipmentStatus, Physical.ShipmentStatus>>,
  Assert<Equal<Legacy.ShipmentStatus, Physical.ShipmentStatus>>,
  Assert<Equal<typeof Public.ShipmentStatus, typeof Physical.ShipmentStatus>>,
  Assert<Equal<OrderShipment["status"], `${Physical.ShipmentStatus}`>>,
  Assert<Equal<Public.Shipment["status"], Physical.ShipmentStatus>>,
  Assert<Equal<Public.ShipmentStatusUpdate["status"], Physical.ShipmentStatus>>,
  Assert<Equal<Public.ShipmentStatus, Legacy.ShipmentStatus>>,
  Assert<Equal<Public.Shipment, Legacy.Shipment>>,
  Assert<Equal<Public.ShipmentListItem, Legacy.ShipmentListItem>>,
  Assert<Equal<Public.ShipmentRelatedOrder, Legacy.ShipmentRelatedOrder>>,
  Assert<Equal<Public.ShipmentRelatedProductImage, Legacy.ShipmentRelatedProductImage>>,
  Assert<Equal<Public.ShipmentQuantityCost, Legacy.ShipmentQuantityCost>>,
  Assert<Equal<Public.ShipmentCostSummary, Legacy.ShipmentCostSummary>>,
  Assert<Equal<Public.ShipmentStatusUpdate, Legacy.ShipmentStatusUpdate>>,
  Assert<Equal<Public.ShipmentOrder, Legacy.ShipmentOrder>>,
  Assert<Equal<Public.ShipmentRelatedOrder["status"], OrderStatus>>,
  Assert<Equal<Public.ShipmentStatusUpdate["shippingFee"], number | null>>,
];
