import "server-only";
import { PostgresRecords } from "@/infrastructure/persistence/postgres/records";
import { STOCK_COUNT_HEADERS } from "@/modules/inventory/infrastructure/google-sheets/stock-counts/const";
import { ADJUSTMENT_HEADERS } from "@/modules/inventory/infrastructure/google-sheets/stock-adjustments/const";
import { MASTER_HEADERS } from "@/modules/inventory/infrastructure/google-sheets/movement-schema";
import { DETAIL_HEADERS } from "@/modules/inventory/infrastructure/google-sheets/movement-schema";

export function inventoryTables() {
  return {
    stockCounts: new PostgresRecords({ table: "stock_counts", headers: STOCK_COUNT_HEADERS }),
    stockAdjustments: new PostgresRecords({ table: "stock_adjustments", headers: ADJUSTMENT_HEADERS }),
    movementMasters: new PostgresRecords({ table: "movements", headers: MASTER_HEADERS }),
    movementDetails: new PostgresRecords({ table: "movement_details", headers: DETAIL_HEADERS }),
  };
}
