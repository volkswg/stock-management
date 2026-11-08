# Current ownership and retained compatibility

This map describes the **current source after merged [PR #40](https://github.com/volkswg/stock-management/pull/40)**. The prior Sales/Inventory, Orders/LINE, external transport and composition work is complete; all 65 files from `src/externals/` are retired. For the dated merge ledger and original evidence, see [progress](../refactoring/progress.md); for outstanding work, see the [roadmap](../refactoring/roadmap.md).

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

Paths below are relative to `src/modules/<owner>/infrastructure/google-sheets/`. Each class and existing header leaf have exactly one physical owner; MovementSheet has no local const.ts. The corresponding old `externals/google/sheet/sheets/` paths are retired; active imports use these physical owners. Headers retain their original mutable array identity, names and order.

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

Orders A:Z is deliberately preserved rather than reduced to its current header count. Other original header-derived `lastColumnLetter(headers.length - 1)` expressions remain. Registry-created instances and canonical imports share exact class/prototype/header identity; there is no parallel registry or copied implementation. Historical test-only export projections verify the former mixed barrels against these same owners.

The six generic root Sheets declarations are GoogleSheetCellValue, GoogleSheetRow, GoogleSheetRangeUpdate, IGoogleSheet, IGoogleRowsSheet and IGoogleBatchRowsSheet. The root `service-contracts.ts` leaf retains the aggregate GoogleSheetsConfig, IGoogleSheetsService, MovementWorksheet and MovementRange plus explicit generic forwards, byte-for-byte from the retired types file. Feature classes use pure root generic types, never erased imports through the mixed aggregate index.

## Aggregate and public composition

The aggregate GoogleSheetsService still constructs the same worksheets in the same order, validates the same configuration and checks connections/batches exactly as before. All current APIs need that service shape. Its implementation/factory now live in explicit composition, outside root infrastructure; active routes use its narrow named index. It is not safe to remove or lazily split construction/health checks during this behavior-preserving refactor. There is no second registry or persistence path.

Active routes use named module servers, canonical Google/external infrastructure, composition and pure shared helpers. Their runtime graphs reach no `services`, `externals` or backend compatibility implementation. Full-service interface imports use the pure root service-contracts leaf; applications/domain never import it. Adapters still own every row/range/header/schema decision.

## Compatibility retirement gates

| Retained path | Reason / single owner |
| --- | --- |
| `services/{orders,shipments,employees,expenses,sales,movements,stock-counts,stock-adjustments,user-states,line}` and barrels | Supported callable/type/enum/error/header surfaces remain covered by runtime and compile-time consumers. They contain named forwards or identity bindings; actual wiring is in composition |
| `services/utils/createSortableId.ts` | Aliases the single stateful root ID module; no reset or duplicated sequence state |
| `scripts/line-rich-menu-client.ts` | Relative `.ts` compatibility forward to the original standalone client. Its RichMenuRequest declaration matches the app transport contract exactly and now shares that definition |

The consumer audit includes production static/erased/dynamic imports, barrels, script paths and inherited runtime/type tests. Issue #39 explicitly authorizes retirement of the external source paths. The package is private, has no package export map or publish workflow, and the audited repository/scripts/types/tests have no remaining live import. No known external compatibility blocker was found; undisclosed deep-import consumers would need to migrate. Other legacy paths remain supported. All legacy business function/class bodies have left service compatibility paths; the backend feature forwards are removed. Necessary typed aliases retain callable and enum namespaces, and movement identity bindings retain original CommonJS descriptors. No forwarding cycle or duplicate implementation is introduced.

## Retired external paths

Google auth/client/base/Drive imports now target root infrastructure; worksheet classes/headers target their feature owners; LINE DTOs/enums/messages target pure shared leaves; LINE/Loyverse clients target root external infrastructure; aggregate construction targets composition. No new mixed production barrel replaces the two removed Sheets indexes. `tests/fixtures/externals-retirement-before.json` records all removed sources, symbol destinations, import audit and exact source inverses. Earlier fixtures remain byte-identical; archived source is used only for original/history evidence, while current loaders and graphs use physical canonical files.

## Final graph and limitations

Runtime module edges: LINE workflows→Orders/Inventory, Inventory→HR/Sales, Shipments→Orders. Public erased contracts additionally permit HR→Expenses and Sales→Expenses. Cross-feature edges use only registered public leaves; allowed directions never authorize private infrastructure. Root transport/shared have no feature/composition dependency. Runtime/type file cycles and browser→server/provider reachability are forbidden.

Financial/stock formulas, quantities/coercion quirks, Bangkok dates, IDs, sorting, API routes, schemas, raw write modes, provider/auth configuration, retry/error phases and partial-write/concurrency limits are preserved. The exact route fixture remains 23 pages/35 APIs. Live permissions/delivery, production records, browser visuals and independent CI remain outside local evidence. See [verification](../refactoring/verification.md) and [deferred decisions](decisions.md#deferred-behavior-and-security-work).

## Private Loyverse account configuration

`infrastructure/configuration/google-sheets/loyverse-accounts.ts` owns the read-only `loyverse_accounts` schema/validation, outside the aggregate registry and `shops` schema. The tab resides in the existing GOOGLE_SHEETS_SPREADSHEET_ID workbook; there is no account-specific ID or alternate-workbook fallback. `composition/loyverse-accounts.ts` selects env/sheet sources and the effective workbook, reuses root Google service-account auth/client and supplies either pure `{id, shopName}` metadata or credential-free bound provider capabilities. `shared/types/loyverse-account.ts` is the erased public metadata DTO; credentials remain in server configuration/storage only. Sales sync accepts its existing structural ReceiptSource port, including existing concrete clients. Financial applications, worksheets and all historical account IDs remain unchanged.

All fourteen affected HTTP sources (Loyverse, Sales, Expenses masters, Inventory counts/adjustments and HR attendance) use the seam. The old synchronous transport factory remains compatible in env mode and explicitly rejects sheet mode, preventing silent misconfiguration. No root infrastructure→feature, feature→composition or private cross-feature edge is added. There is no credential endpoint/editor or second persistence path. [Owner migration and rollback instructions](../../README.md#loyverse-configuration) are canonical.

## Retired feature compatibility directory

The seven `src/features/backend/` forwards are removed. No business body moves: all other 414 production source/assets are byte-identical to main `2d2dc18a5c1112e9f6368599ad0d6d67defa79af` (merged PR43). The unused `@/feature/*` alias is removed; `@/*` continues targeting canonical source.

| Retired leaf under backend/ | Canonical owner / exports |
| --- | --- |
| line/enum/index.ts | line-workflows/contracts: MovementStartCommandEnum, EventKindEnum |
| line/services/reply.ts | line-workflows/server: replyText |
| line/services/movements/index.ts | line-workflows/server: handleMovementEvent; contracts: MovementImageUploadProgress |
| line/services/movements/utils.ts | inventory/quantity: parseQuantity, isValidMovementQuantity |
| line/utils/index.ts | line-workflows/server: isLineEvent, parseLineWebhookPayload, isMovementStartCommand, classifyLineEvent; LegacyMovementEventClassification and LegacyLineEventClassification retain the old local type names through import aliases |
| shared/utils.ts | shared/lib/is-record: isRecord |
| shipments/utils.ts | shipments/http: readJsonBody, isUpdatableStatus, isValidDeliveryFee, isValidPoNumber |

The audit covers runtime/erased/dynamic imports, mocks/loaders, scripts, aliases, docs and historical guards. There is no production importer or known external supported consumer of the removed leaves. The package is private with no export map/publish workflow; undisclosed external deep imports must migrate. Services and standalone script forwards remain supported and untouched.

`features-retirement-before.json` preserves all seven sources, 18 symbol destinations, pre-removal runtime identity keys, audited references and exact non-production inverses. Existing fixtures stay immutable. Current loaders use physical owners and reject removed paths; explicit historical readers alone resolve archived sources. No production compatibility directory or replacement barrel is introduced.

## Database migration preparation

The explicit database task adds a private, unwired `stock_migration` schema and
operator tooling under `tools/migration`; no module owner, application port or
runtime composition changes. The [migration runbook](../database-migration.md)
links the complete source worksheet/type/relationship/caller catalog, SQL,
reconciliation and recovery procedures. Hosted writes, live profiling and runtime
cutover remain pending separate approval/acceptance.


## Phase 2 operational PostgreSQL

All seven modules now have feature-owned PostgreSQL table bindings. Their existing
persistence-port mappers and application/domain code remain unchanged. Shared
server-only PostgreSQL transport owns pooling, explicit transactions, range
compatibility, command replay and effect attempts. Explicit composition owns the
aggregate and request authorization/transaction selection; LINE owns per-event
journaled execution. The operational migration creates 23 business tables plus
commands/audit/side_effects/environment, separate from the immutable 23-table
business archive plus import_batches. `tools/migration` owns exact promotion,
offline profiling and disposable PostgreSQL acceptance. See the
[operational runbook](../database-migration.md#phase-2-operational-storage-opt-in-isolated-testing).
Production storage is still Google Sheets; hosted promotion/cutover are not done.
