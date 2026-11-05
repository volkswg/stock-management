import type * as Server from "../src/modules/shipments/server";
import type * as Legacy from "../src/services/shipments";
import type * as Direct from "../src/services/shipments/linkOrderToShipment";
import type * as Application from "../src/modules/shipments/application/link-order-to-shipment";
type Equal<A,B>=(<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
type Assert<T extends true>=T;
export type HttpBoundaryCompatibility=[
 Assert<Equal<typeof Server.LinkOrderToShipmentError,typeof Direct.LinkOrderToShipmentError>>,
 Assert<Equal<typeof Server.LinkOrderToShipmentError,typeof Legacy.LinkOrderToShipmentError>>,
 Assert<Equal<typeof Server.LinkOrderToShipmentError,typeof Application.LinkOrderToShipmentError>>,
 Assert<Equal<typeof Server.createShipment,typeof Legacy.createShipment>>,
 Assert<Equal<typeof Server.listShipments,typeof Legacy.listShipments>>,
 Assert<Equal<typeof Server.getShipmentDetail,typeof Legacy.getShipmentDetail>>,
 Assert<Equal<typeof Server.linkOrderToShipment,typeof Legacy.linkOrderToShipment>>,
 Assert<Equal<typeof Server.updateShipmentStatus,typeof Legacy.updateShipmentStatus>>,
];
