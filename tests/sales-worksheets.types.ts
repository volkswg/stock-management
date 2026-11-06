type Equal<A,B> = (<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
type Assert<T extends true> = T;
import type { SalesReceiptsSheet as Legacy0 } from "../src/externals/google/sheet/sheets/sales/receipts/SalesReceiptsSheet";
import type { SalesReceiptsSheet as Physical0 } from "../src/modules/sales/infrastructure/google-sheets/receipts/SalesReceiptsSheet";
import type { SALES_RECEIPT_HEADERS as Legacy1 } from "../src/externals/google/sheet/sheets/sales/receipts/const";
import type { SALES_RECEIPT_HEADERS as Physical1 } from "../src/modules/sales/infrastructure/google-sheets/receipts/const";
import type { SalesReceiptItemsSheet as Legacy2 } from "../src/externals/google/sheet/sheets/sales/receipt-items/SalesReceiptItemsSheet";
import type { SalesReceiptItemsSheet as Physical2 } from "../src/modules/sales/infrastructure/google-sheets/receipt-items/SalesReceiptItemsSheet";
import type { SALES_RECEIPT_ITEM_HEADERS as Legacy3 } from "../src/externals/google/sheet/sheets/sales/receipt-items/const";
import type { SALES_RECEIPT_ITEM_HEADERS as Physical3 } from "../src/modules/sales/infrastructure/google-sheets/receipt-items/const";
import type { SalesReceiptPaymentsSheet as Legacy4 } from "../src/externals/google/sheet/sheets/sales/receipt-payments/SalesReceiptPaymentsSheet";
import type { SalesReceiptPaymentsSheet as Physical4 } from "../src/modules/sales/infrastructure/google-sheets/receipt-payments/SalesReceiptPaymentsSheet";
import type { SALES_RECEIPT_PAYMENT_HEADERS as Legacy5 } from "../src/externals/google/sheet/sheets/sales/receipt-payments/const";
import type { SALES_RECEIPT_PAYMENT_HEADERS as Physical5 } from "../src/modules/sales/infrastructure/google-sheets/receipt-payments/const";
import type { SalesReceiptSyncsSheet as Legacy6 } from "../src/externals/google/sheet/sheets/sales/receipt-syncs/SalesReceiptSyncsSheet";
import type { SalesReceiptSyncsSheet as Physical6 } from "../src/modules/sales/infrastructure/google-sheets/receipt-syncs/SalesReceiptSyncsSheet";
import type { SALES_RECEIPT_SYNC_HEADERS as Legacy7 } from "../src/externals/google/sheet/sheets/sales/receipt-syncs/const";
import type { SALES_RECEIPT_SYNC_HEADERS as Physical7 } from "../src/modules/sales/infrastructure/google-sheets/receipt-syncs/const";
import type { SalesProfitCostOverridesSheet as Legacy8 } from "../src/externals/google/sheet/sheets/sales/profit-cost-overrides/SalesProfitCostOverridesSheet";
import type { SalesProfitCostOverridesSheet as Physical8 } from "../src/modules/sales/infrastructure/google-sheets/profit-cost-overrides/SalesProfitCostOverridesSheet";
import type { SALES_PROFIT_COST_OVERRIDE_HEADERS as Legacy9 } from "../src/externals/google/sheet/sheets/sales/profit-cost-overrides/const";
import type { SALES_PROFIT_COST_OVERRIDE_HEADERS as Physical9 } from "../src/modules/sales/infrastructure/google-sheets/profit-cost-overrides/const";
export type SalesWorksheetCompatibility = [
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
