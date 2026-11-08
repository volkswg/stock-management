import "server-only";
import { PostgresRecords } from "@/infrastructure/persistence/postgres/records";
import { SALES_RECEIPT_HEADERS } from "@/modules/sales/infrastructure/google-sheets/receipts/const";
import { SALES_RECEIPT_ITEM_HEADERS } from "@/modules/sales/infrastructure/google-sheets/receipt-items/const";
import { SALES_RECEIPT_PAYMENT_HEADERS } from "@/modules/sales/infrastructure/google-sheets/receipt-payments/const";
import { SALES_RECEIPT_SYNC_HEADERS } from "@/modules/sales/infrastructure/google-sheets/receipt-syncs/const";
import { SALES_PROFIT_COST_OVERRIDE_HEADERS } from "@/modules/sales/infrastructure/google-sheets/profit-cost-overrides/const";

export function salesTables() {
  return {
    salesReceipts: new PostgresRecords({ table: "sales_receipts", headers: SALES_RECEIPT_HEADERS }),
    salesReceiptItems: new PostgresRecords({ table: "sales_receipt_items", headers: SALES_RECEIPT_ITEM_HEADERS }),
    salesReceiptPayments: new PostgresRecords({ table: "sales_receipt_payments", headers: SALES_RECEIPT_PAYMENT_HEADERS }),
    salesReceiptSyncs: new PostgresRecords({ table: "sales_receipt_syncs", headers: SALES_RECEIPT_SYNC_HEADERS }),
    salesProfitCostOverrides: new PostgresRecords({ table: "sales_profit_cost_overrides", headers: SALES_PROFIT_COST_OVERRIDE_HEADERS }),
  };
}
