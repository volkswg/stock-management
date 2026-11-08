import "server-only";
import { PostgresRecords } from "@/infrastructure/persistence/postgres/records";
import { ORDERS_SHEET_HEADERS } from "@/modules/orders/infrastructure/google-sheets/orders/const";
import { ORDER_ITEMS_SHEET_HEADERS } from "@/modules/orders/infrastructure/google-sheets/order-items/const";
import { ORDER_BILLS_SHEET_HEADERS } from "@/modules/orders/infrastructure/google-sheets/order-bills/const";

export function ordersTables() {
  return {
    orders: new PostgresRecords({ table: "orders", headers: ORDERS_SHEET_HEADERS }),
    orderItems: new PostgresRecords({ table: "order_items", headers: ORDER_ITEMS_SHEET_HEADERS }),
    orderBills: new PostgresRecords({ table: "order_bills", headers: ORDER_BILLS_SHEET_HEADERS }),
  };
}
