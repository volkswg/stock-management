# Current ownership and retained compatibility

The completion stack starts at merged PR33/main `9ab9f2095342c66f30acf9612d79ed92063b8597`: [PR34](https://github.com/volkswg/stock-management/pull/34) Sales/Inventory, [PR35](https://github.com/volkswg/stock-management/pull/35) Orders/LINE, [PR36](https://github.com/volkswg/stock-management/pull/36) external transport, followed by the stacked final-cleanup branch. Publication does not imply merge or deployment. Earlier ownership stages and immutable evidence remain in [progress](../refactoring/progress.md).

| Slice | Actual owner | Retained boundaries |
| --- | --- | --- |
| Orders | Public contracts/rules/UI; list/create/detail, mutations, attachments/images and filename rules in own application/domain; Sheets/Drive adapters; named server | Detail receives its own Shipment projection port. LINE owns draft/session coordination. No Orders→Shipments/LINE module import |
| Shipments | Public status/contracts/UI, creation/read/link/status/bill applications/ports and own Sheets/Drive adapters; server and HTTP validation helpers | Shipment→Orders uses public contracts and specifically registered gallery/projection port |
| Inventory | Contracts/quantity rules; counts/balances/reconciliation, adjustments/reversals/replacements and movements/journey primitives; own semantic adapters/server | Public HR directory and Sales dashboard readers are composed only at its server; LINE never imports Inventory persistence |
| Sales | Public report contracts, daily/dashboard/profit, sync/status/cost applications/ports, receipt IDs and Sheets projections/adapters/server | HR payroll and Inventory use the public dashboard reader; provider-native Loyverse projections stay with transport |
| Expenses | Pure Expense/Shop/Category/Input contracts, ledger/master application/ports/rules, Sheets adapter/server | HR shop reader and Sales expense projection use public contracts/entrypoints |
| HR | Pure employee/compensation/attendance/payroll/advance/settlement contracts; financial/date rules, all workforce/financial applications/ports and own persistence/runtime/hash adapters | Named workforce/payroll servers receive explicit reader ports; no legacy implementation in core, no Payroll↔Advance cycle |
| LINE workflows | Public workflow contracts/commands, sessions/context validation, order/movement journeys/replies, sequential webhook orchestration; own session adapter/runtime/server | HTTP keeps raw parsing/auth/factories/status translation; application uses semantic Orders/Inventory operations and pure shared protocol/message helpers |
| Shared Google | Root Sheets auth/JWT/client/base/row delegates/types/constants/header repair and Drive provider/factory | No feature implementation import; one persistence path |
| Shared external | Root LINE/Loyverse client/protocol/factory files; original standalone LineRichMenuClient under root LINE transport | Old constructor names/signatures/error/retry behavior remain; scripts are opt-in and never run during verification |
| Composition | `composition/google-sheets/` owns aggregate construction/factory; `hr-payroll`, `salary-advance-shops`, `employee-directory`, `orders` own compatibility wiring | May wire concrete feature adapters; feature cores never depend on composition. No DI container or alternative registry |
| Shared/runtime | Pure LINE DTO/enum/message builders and isRecord in shared; original stateful sortable ID generator in root infrastructure/runtime | No feature dependency; old helper names alias one implementation |
| Workspace/Next shell | Existing app-owned home/navigation/layout and routes | No Workspace redesign, auth/product work or unrelated UI migration |

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
| line-workflows / user-state | UserStateSheet | USER_STATE_SHEET_HEADERS | A:H (dynamic) |
| inventory / stock-adjustments | StockAdjustmentsSheet | ADJUSTMENT_HEADERS | A:Z |
| expenses / expenses | RecordsSheet (shared constructor alias) | EXPENSE_HEADERS, CATEGORY_HEADERS, SHOP_HEADERS | A:Z |
| hr / employee-advances | PayrollRecordsSheet | ADVANCE_HEADERS, SETTLEMENT_HEADERS | A:Z |
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

## Aggregate and public composition

The aggregate GoogleSheetsService still constructs the same worksheets in the same order, validates the same configuration and checks connections/batches exactly as before. All current APIs need that service shape. Its implementation/factory now live in explicit composition, outside root infrastructure; active routes use its narrow named index. It is not safe to remove or lazily split construction/health checks during this behavior-preserving refactor. There is no second registry or persistence path.

Active routes use named module servers, canonical Google/external infrastructure, composition and pure shared helpers. Their runtime graphs reach no `services`, `externals` or backend compatibility implementation. Remaining generic/full-service interface imports from the pure legacy Sheets type leaf are erased, supported callable contracts; applications/domain never import them. Adapters still own every row/range/header/schema decision.

## Compatibility retirement gates

| Retained path | Reason / single owner |
| --- | --- |
| `services/{orders,shipments,employees,expenses,sales,movements,stock-counts,stock-adjustments,user-states,line}` and barrels | Supported callable/type/enum/error/header surfaces remain covered by runtime and compile-time consumers. They contain named forwards or identity bindings; actual wiring is in composition |
| `services/utils/createSortableId.ts` | Aliases the single stateful root ID module; no reset or duplicated sequence state |
| `features/backend/{line,shared,shipments}` | Named compatibility leaves to LINE workflows, pure shared helpers and Shipment HTTP validation |
| `externals/google` and Sheets indexes/types | Constructor/prototype/header/export compatibility. Generic transport and worksheets have canonical owners; the pure aggregate service/config type declarations retain original full-service signatures |
| `externals/{line,loyverse}` | Named transport/protocol forwards; original indexes retain exact exports and constructor identity |
| `scripts/line-rich-menu-client.ts` | Relative `.ts` compatibility forward to the original standalone client. Its RichMenuRequest declaration matches the app transport contract exactly and now shares that definition |

The consumer audit includes production static/erased/dynamic imports, barrels, script paths and inherited runtime/type tests. No supported surface is removed merely because production has switched imports; external consumers cannot be disproved from a private checkout. All legacy business function/class bodies have left services/backend compatibility paths. Necessary typed aliases retain callable and enum namespaces, and movement identity bindings retain original CommonJS descriptors. No forwarding cycle or duplicate implementation is introduced.

## Final graph and limitations

Runtime module edges: LINE workflows→Orders/Inventory, Inventory→HR/Sales, Shipments→Orders. Public erased contracts additionally permit HR→Expenses and Sales→Expenses. Cross-feature edges use only registered public leaves; allowed directions never authorize private infrastructure. Root transport/shared have no feature/composition dependency. Runtime/type file cycles and browser→server/provider reachability are forbidden.

Financial/stock formulas, quantities/coercion quirks, Bangkok dates, IDs, sorting, API routes, schemas, raw write modes, provider/auth configuration, retry/error phases and partial-write/concurrency limits are preserved. The exact route fixture remains 23 pages/35 APIs. Live permissions/delivery, production records, browser visuals and independent CI remain outside local evidence. See [verification](../refactoring/verification.md) and [deferred decisions](decisions.md#deferred-behavior-and-security-work).
