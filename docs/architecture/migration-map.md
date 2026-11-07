# Current ownership and remaining legacy

Base verified at merged PR32, main `f90e7bdeb3d7c9815148c3011d217e07b1a80b19`. The requested PR31 baseline was superseded by that merge; its tree exactly matched the reviewed financial implementation and no conflicting PR was open. This completion adds employee/compensation/attendance ownership without repeating the merged contracts, payroll, advances, settlement or browser/cycle work.

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
| Inventory | Two pure DTOs, employee-directory port/application, StockCountsSheet/header, MovementSheet, StockAdjustmentsSheet/header and browser-safe adjustment contracts | Stock counts/adjustments/movements algorithms, UI and most services remain legacy |
| HR | Pure employee/compensation/attendance/payroll/advance contracts, original attendance enum, salary/commission/deduction rules, financial applications/ports, salary store and payroll-server entrypoint, plus existing directory/worksheet owners | Employee/compensation/attendance applications, semantic ports and workforce adapter are now owned; supported legacy aliases and concrete Sales composition remain pending the PR36 compatibility audit |
| LINE workflows | UserStateSheet and its mutable header under own infrastructure | Session/journey/webhook business implementations remain legacy |
| Expenses | Public Expense/ExpenseShop/ExpenseCategory/ExpenseInput contracts, application operations/ports/rules, Sheets adapter, named server composition and existing worksheets/headers | Old services are named compatibility forwards; aggregate registry remains legacy composition |
| Workspace | Target ownership defined | App shell remains until scoped work |

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

## Completed worksheet ownership and remaining composition

No physical worksheet implementation remains in legacy externals. StockAdjustmentsSheet and PayrollRecordsSheet inherit root RecordsSheet directly. The original RecordsSheet body has no Expense policy: it delegates readRows (default A:Z), appendRows and updateRows to BaseGoogleSheet. Expenses and its old path alias that exact constructor instead of adding a wrapper subclass. This preserves constructor names, instanceof, prototype chains and registry-created instance identity without cross-feature private inheritance. RAW overrides remain only in the two original subclasses.

Headers remain separate mutable arrays; default ranges, schemas and persistence paths do not change. Old service type/header exports alias their physical owner. Inventory's existing adjustment reasons/DTOs move verbatim into its public contracts so StockAdjustmentsPanel reaches no worksheet implementation or header leaf. Aggregate GoogleSheetsService, factory and indexes remain legacy server composition, with original construction/check order and export surfaces.

The HR directory reader still resolves its old employee-header path to HR's owner. Payroll/advance/settlement use cases and their contract-cycle/browser prerequisites are now owned as described below; employee/compensation/attendance ownership is completed below.

## Expenses business ownership and consumers

`modules/expenses/contracts.ts` owns the four original DTO aliases verbatim and has no runtime dependencies. Expenses pages import only this leaf. Old `services/expenses/types.ts` retains header aliases plus named type forwards; the old direct implementation and barrel retain callable/error/helper compatibility. `readTable` remains available from its old direct path and now lives in the feature adapter.

`application/manage-expenses.ts` owns listing/filtering/reference projection, validation, idempotency, save/remove and master decisions. Its ports expose semantic uncoerced entries, master/expense writes, deletion and injected time/ID functions; they expose no Sheets types, columns or ranges. `infrastructure/google-sheets/expense-store.ts` owns header checks, deferred field access and private location metadata. This preserves coercion/error phases, read order, master sheet selection, full-row soft deletion and exact persistence payloads. The public server accepts the existing service shape without importing the mixed aggregate registry type. Every operation constructs one adapter; no alternate storage or shared mutable request state.

Expenses routes and Sales profit composition call the named Expenses server entrypoint. Sales' query consumes only the public Expense type and receives Expenses data through its existing input; profit/refund algorithms are untouched. HR's SalaryAdvanceShops port consumes only the public ExpenseShop identity/active fields. The advance POST route injects its reader; the old two-argument callable retains a default adapter in explicit legacy composition outside both feature cores. No HR/Sales implementation imports legacy Expenses services or private Expenses infrastructure.

Two old erased browser debts (Expenses and ExpenseMasterPage) are closed. This HR milestone subsequently removes salary advances/payroll’s two erased paths and their type cycle. Broader HR/Sales service extraction and aggregate retirement remain pending.

## HR financial ownership and reader composition

`modules/hr/contracts.ts` owns SalaryAdvance, AdvanceDeduction, PayrollSettlement, EmployeePayroll, EmployeePayrollDailyCommission and their existing employee/compensation/attendance DTO dependencies verbatim. The original EmployeeTimesheetStatus enum has one canonical object here; legacy paths retain named type/value forwards. SalaryAdvancesPage and payrollPdf use this pure leaf, removing both old HR browser paths. The mutual legacy Payroll/Advance file dependency is gone.

`domain/salary-rules.ts` owns original validation/error/money/recovery/deduction functions. `domain/payroll-calculation.ts` contains the original numerical body and deterministic supplied-date helpers. Applications orchestrate payroll, salary reads/mutations and immutable settlements through narrow salary, employee, compensation, attendance and Sales projection ports. `infrastructure/google-sheets/salary-store.ts` uses existing HR worksheets/headers, retains exact salary header recovery/initialization and serializes the original RAW writes; revision hashing is an HR adapter. No rows/ranges/providers/config enter application/domain.

`payroll-server.ts` exposes named operations and injects the clock/hash/store. It is separate from the existing directory server entrypoint. `services/employees/payroll-composition.ts` is explicit, lazy compatibility composition outside the feature core: it now supplies HR’s owned workforce-reader factory with the direct Sales dashboard port. APIs inject those readers; legacy callables preserve original signatures, including PR31's optional SalaryAdvanceShops reader. This bridge is not a feature ownership firewall and is never imported by HR core. Original read initialization/order and financial behavior remain intact.

Salary mapping and settlement views retain coercion/error phases. Duplicate advance updates remain sequential and nontransactional. Settlement fields are evaluated after preparation and sheet/method lookup as before; snapshots remain immutable and size/revision/idempotency checks are unchanged. Aggregate registry and legacy employee/attendance business operations remain for a separately audited milestone. Current full-source runtime/type graphs have no file cycles; protected module directions remain Shipments→Orders plus the existing erased HR→Expenses public contract edge.

## Complete current HR business ownership

`application/employees.ts` owns employee list/create/update, status transitions, compensation list/history append and effective-date decisions through `domain/compensation.ts`. `application/attendance.ts` owns daily/monthly listing, clock-in/out, leave and detail updates. The original date/conflict rules and two error classes live in `domain/attendance-rules.ts`; current clock/UUID/Bangkok timestamp construction lives in `infrastructure/workforce-runtime.ts`. All existing contracts and the one attendance enum remain unchanged.

`infrastructure/google-sheets/workforce-store.ts` owns row parsing, headers, ranges and private locations. Consumer-shaped snapshots defer parsing, preserve compensation iteration and conflict short-circuiting, and return semantic record references; no worksheet rows or indices cross application ports. `server.ts` exposes named operations and `createHRPayrollReaders`. Payroll now uses these owned workforce operations; the legacy payroll bridge retains only concrete Sales query wiring and original callable signatures. All eight HTTP route bodies/validation remain unchanged apart from named-import composition.

Legacy employee/attendance files are typed aliases to the same function/constructor objects. They preserve the original full-service callable types, runtime export-key order and enum type namespace. The exact enum alias is a compatibility binding, not a second enum. The index, salary/settlement/PDF compatibility and SalaryAdvanceShops seam stay supported. Retain these for the PR36 consumer audit. All current HR business implementations are feature-owned; concrete Sales/Expenses composition and the aggregate registry remain outside pure HR core. Existing concurrency, partial-write and validation limits are preserved.

## Compatibility retirement gates

Keep original paths until direct/aggregate callers, erased types, scripts, public export keys and error-class identity have been audited. Shipment barrel has no current production consumer after PR18, but old facades/exports still have compatibility tests. Legacy Orders detail composition is outside both feature cores to avoid reverse imports. Retire neither merely because new entrypoints exist. Preserve [historical source witnesses](../refactoring/progress.md#historical-evidence) and [workflow invariants](decisions.md) for any next move.


PR26 moves exactly three Inventory files with three explicit named old-path forwards. Stock Counts retains its nine mutable headers and call-time A:I range; Movement retains literal A:N, read/append/update/deleteRow and original one-based row-number delegation. No Movement const.ts is created. StockCountsSheet stays exported by both legacy indexes; MovementSheet was not exported by either index and that absence stays unchanged. Both real service movement instances share the single physical class. Existing readMovementRanges, legacy movement master/detail schemas, all business services and consumers remain byte-identical.


## Movement schema prerequisite

On base `4952644f06fcfc216c9351c347dcc806d887bb09` (merged PR26), PR27 separated MASTER_HEADERS, DETAIL_HEADERS and ensureHeader into the legacy-local Inventory leaf `services/movements/worksheet-schema.ts`. `manageMovements.ts` imports that leaf; `state.ts` retains aliases to the exact same arrays/function. This removes Inventory movement business → mixed session state → future LINE-private user-state header and the two movement-page erased paths. No worksheet moves, public DTO migration, state/context algorithm or provider changes occur.

At the PR27 stage, user-state remained legacy and stock counts still reached the mixed registry. PR28 removed that precise path; PR29 then passed a fresh consumer audit and moved only the two worksheet leaves. This milestone subsequently relocates RecordsSheet and its payroll/stock-adjustment subclasses as described above. Broader LINE/Inventory use-case, quantity-helper, compatibility and registry cleanup are deferred.


## Inventory Sales-query dependency prerequisite

PR28's mandatory preflight confirms stock-counts → legacy Sales barrel → daily/dashboard query → mixed Sheets registry → future LINE-private UserStateSheet. The direct movement schema path was already fixed in PR27 and stays intact. PR28 changed the stock-count import to the direct existing Sales query and replaces that query's mixed Sheets imports with four explicit Sales header leaves and erased pure Sheet types.

The query also replaces erased Expense-barrel and override-implementation dependencies with the existing pure Expense types leaf and a new browser-safe Sales contracts leaf. Only the existing SalesProfitCostOverride alias moves verbatim there; its old implementation file/barrel retain erased compatibility exports. This type move is necessary to close the type-inclusive registry path, not a broader Sales DTO/use-case migration. Every function body, worksheet and other consumer stays unchanged. That prerequisite deferred the physical move to PR29; the fresh audit now passes and PR29 implemented only those two moves.

The original `user-state` leaves forward the same UserStateSheet constructor/header objects. Only three external class import strings change; class methods and the header declaration restore byte-for-byte. Both aggregate indexes retain their original exports/order: UserStateSheet appears in both; USER_STATE_SHEET_HEADERS was and remains exported only by the outer Sheet index and its own leaf, not the inner worksheets index. No registry/factory/service/consumer changes.
