# Current ownership and remaining legacy

Base verified at main `4952644f06fcfc216c9351c347dcc806d887bb09`, after merged PR26. This branch adds only the movement schema prerequisite; all physical worksheet owners remain unchanged. This replaces the original base-wide proposed destination list as the current map. The [progress/history index](../refactoring/progress.md#document-consolidation-index) preserves that original proposal and all PR-specific detail; a historical proposed path is not authorization to move a file.

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
| Inventory | Two pure DTOs, employee-directory port/application, StockCountsSheet/header and MovementSheet | Stock counts/adjustments/movements algorithms, UI and most services remain legacy |
| HR | Pure directory DTO, employee reader/public query, and three employee/compensation/timesheet worksheet/header pairs | Payroll records, advances, settlement/lifecycle/use-case extraction remain pending |
| Expenses, LINE workflows, workspace | Target ownership defined, not broad migrations | Existing ledger/shop master, webhook/session and app shell remain until scoped work |

## Physical worksheet owners

Paths below are relative to `src/modules/<owner>/infrastructure/google-sheets/`. Each class and existing header leaf have exactly one physical owner; MovementSheet has no local const.ts. The corresponding old `externals/google/sheet/sheets/` paths are explicit named forwards. Headers retain their original mutable array identity, names and order.

| Owner / subdirectory | Class | Header export | Original default range |
| --- | --- | --- | --- |
| orders / orders | OrdersSheet | ORDERS_SHEET_HEADERS | A:Z |
| orders / order-items | OrderItemsSheet | ORDER_ITEMS_SHEET_HEADERS | A:J |
| orders / order-bills | OrderBillsSheet | ORDER_BILLS_SHEET_HEADERS | A:G |
| shipments / shipments | ShipmentsSheet | SHIPMENTS_SHEET_HEADERS | A:M |
| shipments / shipment-orders | ShipmentOrdersSheet | SHIPMENT_ORDERS_SHEET_HEADERS | A:G |
| inventory / stock-counts | StockCountsSheet | STOCK_COUNT_HEADERS | A:I (dynamic) |
| inventory / movements | MovementSheet | None; legacy master/detail schemas unchanged | A:N (literal) |
| hr / employees | EmployeesSheet | EMPLOYEE_HEADERS | A:I |
| hr / employee-compensations | EmployeeCompensationsSheet | EMPLOYEE_COMPENSATION_HEADERS | A:L |
| hr / employee-timesheets | EmployeeTimesheetsSheet | EMPLOYEE_TIMESHEET_HEADERS | A:G |
| sales / receipts | SalesReceiptsSheet | SALES_RECEIPT_HEADERS | A:Z |
| sales / receipt-items | SalesReceiptItemsSheet | SALES_RECEIPT_ITEM_HEADERS | A:U |
| sales / receipt-payments | SalesReceiptPaymentsSheet | SALES_RECEIPT_PAYMENT_HEADERS | A:J |
| sales / receipt-syncs | SalesReceiptSyncsSheet | SALES_RECEIPT_SYNC_HEADERS | A:I |
| sales / profit-cost-overrides | SalesProfitCostOverridesSheet | SALES_PROFIT_COST_OVERRIDE_HEADERS | A:H |

Orders A:Z is deliberately preserved rather than reduced to its current header count. Other original header-derived `lastColumnLetter(headers.length - 1)` expressions remain. Registry-created instances and legacy leaf/index exports (where originally available) share exact class/prototype/header identity; there is no parallel registry or copied implementation.

The six generic root Sheets declarations are GoogleSheetCellValue, GoogleSheetRow, GoogleSheetRangeUpdate, IGoogleSheet, IGoogleRowsSheet and IGoogleBatchRowsSheet. The old types file retains the aggregate GoogleSheetsConfig, IGoogleSheetsService, MovementWorksheet and MovementRange plus explicit generic forwards. Feature classes use pure root generic types, never erased imports through the mixed aggregate index.

## Pending worksheet ownership

Still physically legacy: employee-advances/PayrollRecordsSheet, expenses/RecordsSheet, stock-adjustments/StockAdjustmentsSheet and user-state/UserStateSheet with their associated headers. Do not infer that a feature's service has migrated because a worksheet has moved.

The six HR class/header files were originally blocked by Inventory's direct employee-header dependency. PR23 removed that coupling without moving worksheets. PR25 completed only those six physical moves after reauditing direct/aggregate/runtime/type consumers. Six exact named forwards preserve all old paths. The directory reader's existing legacy-header import stays unchanged and resolves to its own HR header. PayrollRecordsSheet and expense RecordsSheet remain separate scopes; no aggregate service/factory/index or production consumer changes.

## Compatibility retirement gates

Keep original paths until direct/aggregate callers, erased types, scripts, public export keys and error-class identity have been audited. Shipment barrel has no current production consumer after PR18, but old facades/exports still have compatibility tests. Legacy Orders detail composition is outside both feature cores to avoid reverse imports. Retire neither merely because new entrypoints exist. Preserve [historical source witnesses](../refactoring/progress.md#historical-evidence) and [workflow invariants](decisions.md) for any next move.


PR26 moves exactly three Inventory files with three explicit named old-path forwards. Stock Counts retains its nine mutable headers and call-time A:I range; Movement retains literal A:N, read/append/update/deleteRow and original one-based row-number delegation. No Movement const.ts is created. StockCountsSheet stays exported by both legacy indexes; MovementSheet was not exported by either index and that absence stays unchanged. Both real service movement instances share the single physical class. Existing readMovementRanges, legacy movement master/detail schemas, all business services and consumers remain byte-identical.


## Movement schema prerequisite

On base `4952644f06fcfc216c9351c347dcc806d887bb09` (merged PR26), this branch separates MASTER_HEADERS, DETAIL_HEADERS and ensureHeader into the legacy-local Inventory leaf `services/movements/worksheet-schema.ts`. `manageMovements.ts` imports that leaf; `state.ts` retains aliases to the exact same arrays/function. This removes Inventory movement business → mixed session state → future LINE-private user-state header and the two movement-page erased paths. No worksheet moves, public DTO migration, state/context algorithm or provider changes occur.

The user-state worksheet remains at its original physical location. Its next move needs a fresh base/full consumer audit. Stock counts still calls legacy Sales queries which reach the complete aggregate Sheets registry; that unchanged chain remains explicit debt, not an ownership firewall. Physical RecordsSheet and its payroll/stock-adjustment subclasses remain legacy. Broader LINE/Inventory use-case, quantity-helper, compatibility and registry cleanup are deferred.
