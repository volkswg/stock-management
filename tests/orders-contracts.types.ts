import type * as Contracts from "../src/modules/orders/contracts";
import type * as Legacy from "../src/services/orders";
import type { Shipment, ShipmentStatus } from "../src/services/shipments/types";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;

// Checked by npm run typecheck; no runtime service imports or fake DTO copies.
export type Compatibility = [
  Assert<Equal<Contracts.OrderStatus, Legacy.OrderStatus>>,
  Assert<Equal<Contracts.OrderItemQuantityType, Legacy.OrderItemQuantityType>>,
  Assert<Equal<Contracts.OrderListItem, Legacy.OrderListItem>>,
  Assert<Equal<Contracts.OrderDetail, Legacy.OrderDetail>>,
  Assert<Equal<Contracts.OrderProductImage, Legacy.OrderProductImage>>,
  Assert<Equal<Contracts.OrderBillImage, Legacy.OrderBillImage>>,
  Assert<Equal<Contracts.CreatedOrder, Legacy.CreatedOrder>>,
  Assert<Equal<Contracts.OrderProductUpdate, Legacy.OrderProductUpdate>>,
  Assert<Equal<Contracts.UpdatedOrderProduct, Legacy.UpdatedOrderProduct>>,
  Assert<Equal<Contracts.ReplacedOrderProductImage, Legacy.ReplacedOrderProductImage>>,
  Assert<Equal<Omit<Contracts.OrderShipment, "status">, Omit<Shipment, "status">>>,
  Assert<Equal<Contracts.OrderShipment["status"], `${ShipmentStatus}`>>,
  Assert<Shipment extends Contracts.OrderShipment ? true : false>,
];
