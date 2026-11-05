import type * as Public from "../src/modules/shipments/contracts";
import type * as Leaf from "../src/services/shipments/types";
import type * as Barrel from "../src/services/shipments";
import type * as Link from "../src/services/shipments/linkOrderToShipment";
import type * as Update from "../src/services/shipments/updateShipmentStatus";
import type * as Server from "../src/modules/shipments/server";
import type { ShipmentStatus } from "../src/modules/shipments/status";
import type { OrderStatus, OrderShipment } from "../src/modules/orders/contracts";
type Equal<A,B> = (<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2) ? true : false;
type Assert<T extends true> = T;
export type DtoOwnershipCompatibility = [
  Assert<Equal<Public.Shipment,Leaf.Shipment>>, Assert<Equal<Public.Shipment,Barrel.Shipment>>,
  Assert<Equal<Public.ShipmentListItem,Leaf.ShipmentListItem>>, Assert<Equal<Public.ShipmentListItem,Barrel.ShipmentListItem>>,
  Assert<Equal<Public.ShipmentRelatedOrder,Leaf.ShipmentRelatedOrder>>, Assert<Equal<Public.ShipmentRelatedOrder,Barrel.ShipmentRelatedOrder>>,
  Assert<Equal<Public.ShipmentRelatedProductImage,Leaf.ShipmentRelatedProductImage>>, Assert<Equal<Public.ShipmentRelatedProductImage,Barrel.ShipmentRelatedProductImage>>,
  Assert<Equal<Public.ShipmentQuantityCost,Leaf.ShipmentQuantityCost>>, Assert<Equal<Public.ShipmentQuantityCost,Barrel.ShipmentQuantityCost>>,
  Assert<Equal<Public.ShipmentCostSummary,Leaf.ShipmentCostSummary>>, Assert<Equal<Public.ShipmentCostSummary,Barrel.ShipmentCostSummary>>,
  Assert<Equal<Public.ShipmentStatusUpdate,Leaf.ShipmentStatusUpdate>>, Assert<Equal<Public.ShipmentStatusUpdate,Barrel.ShipmentStatusUpdate>>,
  Assert<Equal<Public.ShipmentOrder,Leaf.ShipmentOrder>>, Assert<Equal<Public.ShipmentOrder,Barrel.ShipmentOrder>>,
  Assert<Equal<Public.ShipmentStatusUpdate,Update.ShipmentStatusUpdate>>,Assert<Equal<Public.ShipmentOrder,Link.ShipmentOrder>>,
  Assert<Equal<Public.Shipment["status"],ShipmentStatus>>,Assert<Equal<Public.ShipmentStatusUpdate["status"],ShipmentStatus>>,
  Assert<Equal<Public.Shipment["shippingFee"],number|null>>,Assert<Equal<Public.ShipmentCostSummary["quote"],Public.ShipmentQuantityCost|null>>,
  Assert<Equal<Public.ShipmentCostSummary["delivered"],Public.ShipmentQuantityCost|null>>,Assert<Equal<Public.ShipmentRelatedOrder["status"],OrderStatus>>,
  Assert<Equal<Public.ShipmentRelatedProductImage["quoteQuantity"],string>>,Assert<Equal<Public.ShipmentRelatedProductImage["deliveredQuantity"],string>>,
  Assert<Equal<Omit<Public.Shipment,"status">,Omit<OrderShipment,"status">>>,Assert<Equal<OrderShipment["status"],`${ShipmentStatus}`>>,
  Assert<Public.Shipment extends OrderShipment?true:false>,
];
export type ServerCompatibility = [
  Assert<Equal<typeof Server.createShipment,typeof Barrel.createShipment>>,
  Assert<Equal<typeof Server.listShipments,typeof Barrel.listShipments>>,
  Assert<Equal<typeof Server.getShipmentDetail,typeof Barrel.getShipmentDetail>>,
  Assert<Equal<typeof Server.linkOrderToShipment,typeof Link.linkOrderToShipment>>,
  Assert<Equal<typeof Server.updateShipmentStatus,typeof Update.updateShipmentStatus>>,
];
