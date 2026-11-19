import "server-only";
import { expensesTables } from "@/modules/expenses/infrastructure/postgres/tables";
import { hrTables } from "@/modules/hr/infrastructure/postgres/tables";
import { inventoryTables } from "@/modules/inventory/infrastructure/postgres/tables";
import { line_workflowsTables } from "@/modules/line-workflows/infrastructure/postgres/tables";
import { ordersTables } from "@/modules/orders/infrastructure/postgres/tables";
import { salesTables } from "@/modules/sales/infrastructure/postgres/tables";
import { shipmentsTables } from "@/modules/shipments/infrastructure/postgres/tables";

export function createBusinessDatabase() {
  return { ...ordersTables(), ...shipmentsTables(), ...inventoryTables(), ...salesTables(), ...expensesTables(), ...hrTables(), ...line_workflowsTables() };
}
export type BusinessDatabase = ReturnType<typeof createBusinessDatabase>;
