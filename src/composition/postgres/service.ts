import "server-only";
import type { IGoogleSheetsService } from "@/infrastructure/persistence/google-sheets/service-contracts";
import { expensesTables } from "@/modules/expenses/infrastructure/postgres/tables";
import { hrTables } from "@/modules/hr/infrastructure/postgres/tables";
import { inventoryTables } from "@/modules/inventory/infrastructure/postgres/tables";
import { line_workflowsTables } from "@/modules/line-workflows/infrastructure/postgres/tables";
import { ordersTables } from "@/modules/orders/infrastructure/postgres/tables";
import { salesTables } from "@/modules/sales/infrastructure/postgres/tables";
import { shipmentsTables } from "@/modules/shipments/infrastructure/postgres/tables";

export function createPostgresService(): IGoogleSheetsService {
  const tables = { ...ordersTables(), ...shipmentsTables(), ...inventoryTables(), ...salesTables(), ...expensesTables(), ...hrTables(), ...line_workflowsTables() };
  return { ...tables,
    readMovementRanges: ranges => Promise.all(ranges.map(({sheet,range}) => tables[sheet].readRows(range))),
    checkConnection: async () => { await tables.orders.checkConnection(); },
  };
}
