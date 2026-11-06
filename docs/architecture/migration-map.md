# Current ownership and remaining legacy

Source verified at main `71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb`, after merged PR23. This replaces the original base-wide proposed destination list as the current map. The [progress/history index](../refactoring/progress.md#document-consolidation-index) preserves that original proposal and all PR-specific detail; a historical proposed path is not authorization to move a file.

| Slice | Actual owner now | Compatibility / unfinished work |
| --- | --- | --- |
| Orders browser | `modules/orders/contracts.ts`, `modules/orders/ui/` | Next pages/loading stay in app; legacy enum/type forwards remain |
| Orders list/simple creation | Own application/ports and Sheets list-reader/writer; named server composition | Drafts, image workflows, mutations and LINE orchestration remain legacy |
| Orders detail | Own application and three-read deferred reader; own Shipment projection port | App GET and legacy facade inject Shipment adapter; legacy detail call signature remains |
| Orders picker | Required Orders UI picker port | Stable adapter in `app/orders/[id]/OrderDetailClient.tsx`; server page passes only orderId |
| Shipment public contracts | Single enum in `modules/shipments/status.ts`; eight DTO aliases in `contracts.ts` | Legacy types/barrel forward identical values/types; removal not authorized |
| Shipment UI/client | Seven actual files under `modules/shipments/ui/` | Next wrappers stay app-owned; retired app browser client has no shim |
| Shipment server | Own creation/read/link/status/bill applications, consumer ports and Sheets/Drive adapters; named server composition | Legacy direct/barrel facades remain. Three API routes and backend validation already use module public surfaces |
| Shared Google | Root `infrastructure/persistence/google-sheets` auth/JWT/client/base/constants/generic types; `infrastructure/files/google-drive` provider/factory/types | Old externals leaves forward. Aggregate GoogleSheetsService, config factory and both Sheets indexes remain legacy composition |
| Sales | Five worksheet/header pairs in own infrastructure | Sync/report/profit/API/UI and aggregate consumers remain legacy |
| Inventory | Two pure DTOs, employee-directory port/application | Stock counts/adjustments/movements algorithms, UI and most services remain legacy |
| HR | Pure directory DTO, employee reader and public query | Employee/compensation/timesheet worksheet ownership and payroll/advance/settlement/lifecycle extraction remain pending |
| Expenses, LINE workflows, workspace | Target ownership defined, not broad migrations | Existing ledger/shop master, webhook/session and app shell remain until scoped work |

## Physical worksheet owners

Paths below are relative to `src/modules/<owner>/infrastructure/google-sheets/`. Each class and its local `const.ts` have exactly one physical owner; the corresponding old `externals/google/sheet/sheets/` paths are explicit named forwards. Headers retain their original mutable array identity, names and order.

| Owner / subdirectory | Class | Header export | Original default range |
| --- | --- | --- | --- |
| orders / orders | OrdersSheet | ORDERS_SHEET_HEADERS | A:Z |
| orders / order-items | OrderItemsSheet | ORDER_ITEMS_SHEET_HEADERS | A:J |
| orders / order-bills | OrderBillsSheet | ORDER_BILLS_SHEET_HEADERS | A:G |
| shipments / shipments | ShipmentsSheet | SHIPMENTS_SHEET_HEADERS | A:M |
| shipments / shipment-orders | ShipmentOrdersSheet | SHIPMENT_ORDERS_SHEET_HEADERS | A:G |
| sales / receipts | SalesReceiptsSheet | SALES_RECEIPT_HEADERS | A:Z |
| sales / receipt-items | SalesReceiptItemsSheet | SALES_RECEIPT_ITEM_HEADERS | A:U |
| sales / receipt-payments | SalesReceiptPaymentsSheet | SALES_RECEIPT_PAYMENT_HEADERS | A:J |
| sales / receipt-syncs | SalesReceiptSyncsSheet | SALES_RECEIPT_SYNC_HEADERS | A:I |
| sales / profit-cost-overrides | SalesProfitCostOverridesSheet | SALES_PROFIT_COST_OVERRIDE_HEADERS | A:H |

Orders A:Z is deliberately preserved rather than reduced to its current header count. Other original header-derived `lastColumnLetter(headers.length - 1)` expressions remain. Registry-created instances and legacy leaf/both-index exports share exact class/prototype/header identity; there is no parallel registry or copied implementation.

The six generic root Sheets declarations are GoogleSheetCellValue, GoogleSheetRow, GoogleSheetRangeUpdate, IGoogleSheet, IGoogleRowsSheet and IGoogleBatchRowsSheet. The old types file retains the aggregate GoogleSheetsConfig, IGoogleSheetsService, MovementWorksheet and MovementRange plus explicit generic forwards. Feature classes use pure root generic types, never erased imports through the mixed aggregate index.

## Pending worksheet ownership

Still physically legacy: employees, employee-compensations, employee-timesheets, employee-advances/PayrollRecordsSheet, expenses/RecordsSheet, movements/MovementSheet, stock-adjustments/StockAdjustmentsSheet, stock-counts/StockCountsSheet and user-state/UserStateSheet with their associated headers. Do not infer that a feature's service has migrated because a worksheet has moved.

The proposed six HR class/header files were blocked by Inventory's direct employee-header dependency. PR23 removed that coupling through consumer-owned directory composition; **it did not move those files**. Reverify a new main, complete all direct/aggregate/runtime/type consumers and rerun the virtual-to-actual graph checks before attempting the HR move. PayrollRecordsSheet and expense RecordsSheet remain separate scopes.

## Compatibility retirement gates

Keep original paths until direct/aggregate callers, erased types, scripts, public export keys and error-class identity have been audited. Shipment barrel has no current production consumer after PR18, but old facades/exports still have compatibility tests. Legacy Orders detail composition is outside both feature cores to avoid reverse imports. Retire neither merely because new entrypoints exist. Preserve [historical source witnesses](../refactoring/progress.md#historical-evidence) and [workflow invariants](decisions.md) for any next move.
