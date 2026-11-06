# Inventory employee-directory prerequisite

Base: `d59ea160309f92feed88878cc3f05811222db21d` (merged PR22), verified exact main and clean tree. Branch `refactor/inventory-employee-directory`. This is the prerequisite for the blocked HR worksheet move; **no HR/payroll/expense worksheet or header is relocated**.

## Original caller and coupling

`services/stock-adjustments/manageStockAdjustments.ts:listAdjustmentEmployees` previously read employees directly, validated EMPLOYEE_HEADERS through the mixed Sheets index and mapped five columns. The same helper is called by stock-adjustment GET and conditionally by createStockAdjustment after original record/idempotency/account checks. Moving the header into HR infrastructure would make that an Inventory → HR private implementation dependency.

The new Inventory-owned `application/ports/employee-directory.ts` contains only `listEmployees(): Promise<AdjustmentEmployee[]>`. It exposes no rows, headers, ranges, service/config/HTTP types, clock or error classes. Pure Inventory `application/list-adjustment-employees.ts` consumes the required port and returns its promise without adding awaits/retries/caching.

## Ownership and composition

| File | Responsibility |
| --- | --- |
| `modules/inventory/contracts.ts` | Exact original AdjustmentEmployee five-field type and StockCountAccount two-field type; erased business DTOs only |
| `modules/inventory/application/ports/employee-directory.ts` | Consumer-owned directory capability |
| `modules/inventory/application/list-adjustment-employees.ts` | Injected port invocation, promise identity preserved |
| `modules/hr/contracts.ts` | HR-owned five-field EmployeeDirectoryEntry, structurally compatible without importing Inventory |
| `modules/hr/infrastructure/google-sheets/employee-directory-reader.ts` | Original read/header-prefix/row projection and converter, constructor-lazy |
| `modules/hr/server.ts` | Guarded named readEmployeeDirectory, supplied original Sheets service; no config/transport creation |
| `services/stock-adjustments/employee-directory.ts` | Guarded server/legacy compatibility composition: Inventory port plus HR public query |

The existing legacy employee function retains its original service input and Promise<AdjustmentEmployee[]> result, composes that port, then invokes the Inventory application function. Every existing caller remains unchanged. createStockAdjustment calls it in the same phase; its body, validation/eligibility/clock/idempotency/write/reversal logic is unchanged. The HTTP route remains byte-identical for GET/POST/PATCH, config/factory order, errors, statuses and response keys. No function-valued port crosses a React serialization boundary.

HR imports no Inventory module or StockAdjustmentError. Only composition depends on both features, through Inventory's erased port and HR's explicit named public server query. Inventory application/port/contracts import no HR/private/provider implementation. The original StockAdjustmentError class remains physically unchanged in its legacy file and remains the route's instanceof identity.

## Exact failure timing

The HR query receives a required `unavailableError: () => Error` **at server composition**. Inventory's legacy facade supplies the original `new StockAdjustmentError("Employee storage headers do not match.", 503)`. The HR reader invokes it only after the original read and failed prefix check. This creates the original error at the original phase without making HR import Inventory, wrapping a rejected error, or adding an HR error hierarchy.

There is exactly one async row await, in the reader. Public HR composition, the compatibility adapter, Inventory application and legacy employee facade return that original promise directly. The facade intentionally becomes a plain Promise-returning function rather than adding async promise adoption; its TypeScript call signature is unchanged. Adding an extra async wrapper would change simultaneous error settlement precedence. Actual old/new GET and parallel-header/network-failure tests prove the original winning response and call sequence.

Constructor/composition performs no employee getter access, Sheet IO, clock or error construction. A synchronous employee getter/read-call failure still becomes the original rejected promise through the reader's async boundary. Unknown read failures propagate the original error object with no retry. Pending reads/writes remain awaited by original consumers.

## Projection and policy parity

The HR reader preserves original helper statements after only substituting its stored service and injected error factory; AST tests reconstruct the original body. Its local `text` arrow declaration is exactly the original `String(v ?? "")` converter. No existing HR employee mapper is reused because it could normalize/filter differently.

- One `employees.readRows()` with no explicit range.
- Empty rows return []; header validation compares only the original prefix and accepts extra columns.
- Filter only truthy raw IDs; preserve row order and original malformed-row/getter failure phases.
- Return exactly id, name, status, hiredDate, terminatedDate, in that order; no trimming or status validation/active-only filter.
- Preserve odd original coercion behavior, including numeric/boolean cells and a malformed object with no length returning []; no stricter array validation is added.
- Header mismatch remains the exact StockAdjustmentError / 503 / message.
- Existing employment-date eligibility stays in Inventory; even a terminated status with the original valid date fields retains old behavior.
- No employee writes, extra reads, clock/ID generation, provider/config creation or new transaction/retry semantics.

## Supporting type/import cleanup

The original two small business DTO declarations move verbatim to Inventory contracts. Legacy stock-adjustment types forwards AdjustmentEmployee; legacy stock-count implementation imports/forwards StockCountAccount and its existing barrel stays unchanged. This removes the employee helper's erased dependency on the entire stock-count implementation and its old type-cycle path without duplicating declarations.

Direct mixed Sheets imports are removed from the three legacy Inventory services: adjustments uses pure interface types; stock counts uses pure types plus its explicit own STOCK_COUNT_HEADERS leaf; movements changes only its erased interface import to the pure types leaf. No other business function body changes. Existing legacy public Sales/Expense/other query aggregation is not extracted or declared globally clean; it remains separately scoped.

This also removes two previously recorded legacy movement-page erased paths into the mixed Sheets/Sales registry. PR22's original fixture is retained; its audit assertion recognizes exactly the two named removed roots after verifying the original/new movement source witness. Four pre-existing legacy client type-only traces remain. No browser gains the new employee server/application/reader/composition code in either runtime or type-inclusive graphs.

## Historical witness and exact changes

`tests/fixtures/inventory-employee-directory-before.json` captures original full sources/raw hashes/declarations and the unchanged route before production edits. Two original characterization tests pass before extraction. Exact inverse substitutions restore every modified complete source; all other production bytes remain identical.

| Existing changed production file | Original SHA-256 |
| --- | --- |
| `src/services/stock-adjustments/manageStockAdjustments.ts` | `53a0a5dc6938d574bdb611d8286771b268db21376bca6fcab8f93099b1e331e2` |
| `src/services/stock-adjustments/types.ts` | `8e3dfadb9899650b0005b2849c93d5323d7600e86dfc9b209787f1f5fd754976` |
| `src/services/stock-counts/manageStockCounts.ts` | `c03233344db279ec409d9961d61e43760ca2abe1a24630098b11076b85a725f3` |
| `src/services/movements/manageMovements.ts` | `3f172923c0a60c56f824169abcd77a32c7aaf30b8b06e56f7eb0c632c0a03088` |

Only the reviewed employee orchestration changes; every other function/class declaration remains exact. The two moved DTO declaration ASTs remain exact in their new owner. PR15–22 complete source inventories recognize only the four modified old files and seven named new files. Earlier fixtures and their hashes remain authoritative; no blanket exemption/regeneration/skip. Existing closed loaders are unchanged. The new offline directory harness admits only exact new seam files, the two legacy directory files, selected header constants and the actual route, with server-only stubbed only there and explicit fake config/Sheets. It rejects other dependencies.

## Enforcement and verification

Exact new lint scopes protect pure Inventory/HR contracts, the port/use case, the erased interfaces and HR-owned adapter/public query/composition. They reject alias/relative/private/provider/config/framework/Node/dynamic/require/import-type bypasses; the three legacy services reject their old mixed Sheet/header patterns. Existing feature/root/worksheet scopes stay intact.

Actual and virtual-six-HR-worksheet runtime/type module DAG tests preserve only the established Shipments → Orders module edge; HR and Inventory share no private imports, composition alone consumes both public surfaces. The negative legacy header imports are rejected. These tests cover the migrated directory boundary and future HR worksheet sources, not a claim that every unextracted legacy public-query aggregation has been retired. The future worksheet PR must fetch a new merge base and rerun its complete consumer audit.

[Executed baseline/final evidence](verification.md#inventory-employee-directory-prerequisite): 419 inherited baseline tests; final 429 = 419 inherited + 10 new. Typecheck and credential-free isolated build pass. Lint retains only the inherited unused shipmentRow warning. All routes remain 23 pages / 35 APIs; Next app-paths manifest stays byte-identical with SHA-256 `32f92c7a1ef17213d7a8642ca89e3e71218984982bf1bdce66b560ef35893e1e`.

The ten new tests cover original projection/failures, pending and synchronous/network identity, saved-original/current row/getter parity, actual HTTP GET error precedence, actual POST eligibility/idempotency/conflict/writes, pure port/lazy composition, exact source/DTO/mapping/route history, exact lint restrictions and two actual/proposed graph/browser modes. All inherited regressions remain active. Compile-time fixtures preserve direct/barrel DTO and legacy parameter/result types.

No worksheet/header, payroll/HR lifecycle/timesheet/settlement/advance/financial logic, route/UI, provider/auth/config, package/lockfile/env/schema/data changes. No live integrations, credentials/records, operational scripts, concurrency/real-browser/Google permission verification, approve/merge/deploy. Results are Codex-local, not independent GitHub/Vercel CI. The HR six-file migration, broader Inventory/HR use-case cleanup, four remaining legacy browser type-only debts, aggregate/barrel retirement, provider/SaaS and concurrency work remain future scopes.
