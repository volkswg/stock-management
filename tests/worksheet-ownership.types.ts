type Equal<A,B> = (<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
type Assert<T extends true> = T;
import type { OrdersSheet as Legacy0 } from "@/modules/orders/infrastructure/google-sheets/orders/OrdersSheet";
import type { OrdersSheet as Physical0 } from "../src/modules/orders/infrastructure/google-sheets/orders/OrdersSheet";
import type { ORDERS_SHEET_HEADERS as Legacy1 } from "@/modules/orders/infrastructure/google-sheets/orders/const";
import type { ORDERS_SHEET_HEADERS as Physical1 } from "../src/modules/orders/infrastructure/google-sheets/orders/const";
import type { OrderItemsSheet as Legacy2 } from "@/modules/orders/infrastructure/google-sheets/order-items/OrderItemsSheet";
import type { OrderItemsSheet as Physical2 } from "../src/modules/orders/infrastructure/google-sheets/order-items/OrderItemsSheet";
import type { ORDER_ITEMS_SHEET_HEADERS as Legacy3 } from "@/modules/orders/infrastructure/google-sheets/order-items/const";
import type { ORDER_ITEMS_SHEET_HEADERS as Physical3 } from "../src/modules/orders/infrastructure/google-sheets/order-items/const";
import type { OrderBillsSheet as Legacy4 } from "@/modules/orders/infrastructure/google-sheets/order-bills/OrderBillsSheet";
import type { OrderBillsSheet as Physical4 } from "../src/modules/orders/infrastructure/google-sheets/order-bills/OrderBillsSheet";
import type { ORDER_BILLS_SHEET_HEADERS as Legacy5 } from "@/modules/orders/infrastructure/google-sheets/order-bills/const";
import type { ORDER_BILLS_SHEET_HEADERS as Physical5 } from "../src/modules/orders/infrastructure/google-sheets/order-bills/const";
import type { ShipmentsSheet as Legacy6 } from "@/modules/shipments/infrastructure/google-sheets/shipments/ShipmentsSheet";
import type { ShipmentsSheet as Physical6 } from "../src/modules/shipments/infrastructure/google-sheets/shipments/ShipmentsSheet";
import type { SHIPMENTS_SHEET_HEADERS as Legacy7 } from "@/modules/shipments/infrastructure/google-sheets/shipments/const";
import type { SHIPMENTS_SHEET_HEADERS as Physical7 } from "../src/modules/shipments/infrastructure/google-sheets/shipments/const";
import type { ShipmentOrdersSheet as Legacy8 } from "@/modules/shipments/infrastructure/google-sheets/shipment-orders/ShipmentOrdersSheet";
import type { ShipmentOrdersSheet as Physical8 } from "../src/modules/shipments/infrastructure/google-sheets/shipment-orders/ShipmentOrdersSheet";
import type { SHIPMENT_ORDERS_SHEET_HEADERS as Legacy9 } from "@/modules/shipments/infrastructure/google-sheets/shipment-orders/const";
import type { SHIPMENT_ORDERS_SHEET_HEADERS as Physical9 } from "../src/modules/shipments/infrastructure/google-sheets/shipment-orders/const";
export type WorksheetCompatibility = [
 Assert<Equal<typeof Legacy0,typeof Physical0>>,
 Assert<Equal<Legacy0,Physical0>>,
 Assert<Equal<typeof Legacy1,typeof Physical1>>,
 Assert<Equal<typeof Legacy2,typeof Physical2>>,
 Assert<Equal<Legacy2,Physical2>>,
 Assert<Equal<typeof Legacy3,typeof Physical3>>,
 Assert<Equal<typeof Legacy4,typeof Physical4>>,
 Assert<Equal<Legacy4,Physical4>>,
 Assert<Equal<typeof Legacy5,typeof Physical5>>,
 Assert<Equal<typeof Legacy6,typeof Physical6>>,
 Assert<Equal<Legacy6,Physical6>>,
 Assert<Equal<typeof Legacy7,typeof Physical7>>,
 Assert<Equal<typeof Legacy8,typeof Physical8>>,
 Assert<Equal<Legacy8,Physical8>>,
 Assert<Equal<typeof Legacy9,typeof Physical9>>
];
