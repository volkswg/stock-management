import type * as Public from "../src/modules/shipments/contracts";
import type * as Legacy from "../src/services/shipments";
import type { OrderStatus } from "../src/modules/orders/contracts";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
export type ShipmentCompatibility = [
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
