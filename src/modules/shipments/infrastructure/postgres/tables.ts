import "server-only";
import { PostgresRecords } from "@/infrastructure/persistence/postgres/records";
import { SHIPMENTS_SHEET_HEADERS } from "@/modules/shipments/infrastructure/google-sheets/shipments/const";
import { SHIPMENT_ORDERS_SHEET_HEADERS } from "@/modules/shipments/infrastructure/google-sheets/shipment-orders/const";

export function shipmentsTables() {
  return {
    shipments: new PostgresRecords({ table: "shipments", headers: SHIPMENTS_SHEET_HEADERS }),
    shipmentOrders: new PostgresRecords({ table: "shipment_orders", headers: SHIPMENT_ORDERS_SHEET_HEADERS }),
  };
}
