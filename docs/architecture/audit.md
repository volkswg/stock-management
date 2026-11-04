# Current structure and dependency audit

Audited base: `383cf5956b7e8a0705586936c78b7efd29ec6102`. 269 files under src, 244 TypeScript/TSX files. There are 23 page entrypoints and 35 API route files. No existing test suite, CI workflow, module-boundary lint configuration, or AGENTS.md was present. ESLint and TypeScript passed before changes; the isolated baseline build also passed.

## Method and limitations

Parsed import/export declarations and literal dynamic imports with the installed TypeScript compiler, resolving both aliases and relative paths against tsconfig. The table counts import statements across ownership groups, distinguishing wholly type-only declarations from value/mixed declarations. It includes src/scripts even though root typecheck excludes that directory. CSS/assets, nonliteral imports, runtime HTTP dependencies, and implicit business relationships are not graph edges. This is a base snapshot, not an ongoing enforcement tool or a proof of browser bundle safety. Re-run a resolved graph analysis when migrating code.

## Findings

- app contains route glue alongside large feature components, CSS, browser fetch clients, formatting and PDF generation. Keep Next entrypoints in place and move UI only in subsequent scoped PRs.
- services is organized by feature but orchestrators depend on broad IGoogleSheetsService interfaces and physical worksheet headers/rows. Interfaces exist today, but they describe storage rather than use-case operations. Narrow ports must be extracted incrementally.
- externals/google combines transport/auth, aggregate service composition, and feature schemas. Root infrastructure should own transport; module infrastructure should own feature mapping/repositories.
- features/frontend/orders/components/OrderListPage.tsx imports OrderStatus and DTOs from services/orders, a barrel re-exporting writes and provider-backed code; it also imports app/orders/api. Other feature UIs use similar service-owned types. Browser-safe contracts are the first seam to establish.
- config/index.ts imports isRecord from features/backend/shared/utils.ts. That generic parser is a candidate for shared/lib, but moving it is deferred.
- services/employees/calculateEmployeePayroll.ts consumes sales reports; manageSalaryAdvances.ts consumes expense shops; stock-counts consumes movements, sales and stock adjustments. Sales consumes expense types. These become documented public contracts, not arbitrary internal imports.
- services/orders/createDraftOrder.ts mixes order models, runtime status enums, workflow state and Sheets writes. services/movements/state.ts mixes workflow session state with inventory master/item storage. Split ownership before moving these files wholesale.
- Webhook orchestration is split between app/api/line/webhook, services/line and features/backend/line. It needs a single workflow owner while keeping the signature HTTP boundary and existing response behavior.
- Feature-level bidirectional relationships exist even without runtime file cycles: orders/listOrders imports shipment models/status and maps shipment rows, while shipments reads orders; movements imports pure quantity helpers from the LINE workflow tree, while that workflow calls movements. Resolve these through consumer-owned query ports/composition and inventory-owned quantity contracts before enforcing acyclic modules.
- Known operational risks remain unchanged: no application-level authentication on sensitive web routes, Sheets read/check/append operations are not cross-instance transactions, and some non-movement LINE handler errors are logged before a success response. Separate tasks are needed for behavior/security fixes.

## Resolved cross-group imports

| Importer | Dependency | Value/mixed | Type-only |
| --- | --- | ---: | ---: |
| `app` | `config` | 35 | 0 |
| `app` | `externals/google/drive` | 6 | 0 |
| `app` | `externals/google/sheet` | 33 | 0 |
| `app` | `externals/line` | 1 | 0 |
| `app` | `externals/loyverse` | 2 | 0 |
| `app` | `features/backend/line` | 3 | 0 |
| `app` | `features/backend/shared` | 10 | 0 |
| `app` | `features/backend/shipments` | 1 | 0 |
| `app` | `features/frontend/orders` | 8 | 0 |
| `app` | `services/employees` | 11 | 2 |
| `app` | `services/expenses` | 4 | 3 |
| `app` | `services/line` | 1 | 0 |
| `app` | `services/movements` | 4 | 3 |
| `app` | `services/orders` | 11 | 1 |
| `app` | `services/sales` | 7 | 0 |
| `app` | `services/shipments` | 7 | 2 |
| `app` | `services/stock-adjustments` | 2 | 0 |
| `app` | `services/stock-counts` | 1 | 0 |
| `app` | `services/user-states` | 0 | 1 |
| `config` | `features/backend/shared` | 1 | 0 |
| `externals/google/auth` | `externals/google/utils` | 1 | 0 |
| `externals/google/drive` | `config` | 0 | 1 |
| `externals/google/drive` | `externals/google/auth` | 2 | 2 |
| `externals/google/sheet` | `config` | 0 | 1 |
| `externals/google/sheet` | `externals/google/auth` | 1 | 1 |
| `externals/loyverse` | `config` | 0 | 1 |
| `features/backend/line` | `config` | 0 | 1 |
| `features/backend/line` | `externals/google/drive` | 0 | 1 |
| `features/backend/line` | `externals/google/sheet` | 0 | 2 |
| `features/backend/line` | `externals/line` | 3 | 1 |
| `features/backend/line` | `features/backend/shared` | 1 | 0 |
| `features/backend/line` | `services/movements` | 2 | 0 |
| `features/backend/line` | `services/orders` | 1 | 0 |
| `features/backend/line` | `services/user-states` | 1 | 0 |
| `features/backend/line` | `services/utils` | 1 | 0 |
| `features/backend/shipments` | `services/shipments` | 1 | 0 |
| `features/frontend/orders` | `app` | 2 | 0 |
| `features/frontend/orders` | `services/orders` | 2 | 2 |
| `services/employees` | `externals/google/sheet` | 2 | 3 |
| `services/employees` | `services/expenses` | 1 | 0 |
| `services/employees` | `services/sales` | 1 | 0 |
| `services/expenses` | `externals/google/sheet` | 0 | 1 |
| `services/line` | `externals/google/drive` | 0 | 3 |
| `services/line` | `externals/google/sheet` | 0 | 8 |
| `services/line` | `externals/line` | 7 | 1 |
| `services/line` | `services/orders` | 7 | 1 |
| `services/line` | `services/user-states` | 1 | 7 |
| `services/movements` | `externals/google/sheet` | 1 | 2 |
| `services/movements` | `features/backend/line` | 1 | 0 |
| `services/movements` | `services/utils` | 1 | 0 |
| `services/orders` | `externals/google/drive` | 0 | 2 |
| `services/orders` | `externals/google/sheet` | 6 | 14 |
| `services/orders` | `services/shipments` | 1 | 0 |
| `services/orders` | `services/utils` | 4 | 0 |
| `services/sales` | `externals/google/sheet` | 3 | 2 |
| `services/sales` | `externals/loyverse` | 0 | 3 |
| `services/sales` | `services/expenses` | 0 | 1 |
| `services/shipments` | `externals/google/sheet` | 2 | 2 |
| `services/shipments` | `services/orders` | 1 | 1 |
| `services/shipments` | `services/utils` | 2 | 0 |
| `services/stock-adjustments` | `externals/google/sheet` | 1 | 0 |
| `services/stock-adjustments` | `services/stock-counts` | 0 | 1 |
| `services/stock-counts` | `externals/google/sheet` | 1 | 0 |
| `services/stock-counts` | `services/movements` | 1 | 0 |
| `services/stock-counts` | `services/sales` | 1 | 0 |
| `services/stock-counts` | `services/stock-adjustments` | 1 | 0 |
| `services/user-states` | `externals/google/sheet` | 0 | 1 |
| `services/user-states` | `services/orders` | 1 | 0 |

## Existing cycles

### Value/mixed edges

0 strongly connected component(s). A mixed declaration is conservatively treated as a value edge; this is source-level analysis, not an emitted bundle graph.

### All edges including type-only

2 strongly connected component(s). A mixed declaration is conservatively treated as a value edge; this is source-level analysis, not an emitted bundle graph.

- `src/services/employees/calculateEmployeePayroll.ts`
- `src/services/employees/manageSalaryAdvances.ts`

- `src/services/stock-adjustments/manageStockAdjustments.ts`
- `src/services/stock-counts/index.ts`
- `src/services/stock-counts/manageStockCounts.ts`

Do not introduce new cycles. Existing components above are migration debt; extract pure contracts and consumer-owned ports before removing compatibility barrels. In particular, type references from salary advances back to payroll do not justify moving both into a broad public index.

## PR 2 follow-up

Orders UI/API and the three Shipments UI consumers of OrderStatus now use `modules/orders/contracts.ts`. Order detail no longer imports a runtime mixed service barrel; its sole legacy runtime bridge is the pure shipment enum/DTO file. That file imports OrderStatus as a type from the contract leaf, not the draft writer. Orders read DTOs use an owned shipment projection without a dependency back to Shipments. Legacy order services retain compatibility re-exports; existing server orchestration, Sheets/Drive mapping, LINE logic and the two unrelated type-cycle components above remain unchanged. The checked transitive Orders project-runtime graph has no server implementation paths or cycles. See [scope and limitations](orders-contracts.md); the original table remains the Phase 1 snapshot, not post-migration counts.

## PR 3 follow-up

All 15 Orders frontend/client/style files are consolidated in `modules/orders/ui`, with no implementation duplicates at their former locations. The pre-move consumer audit identified four app routing/loading files and three Shipments gallery consumers; only their imports changed. Module UI now uses its own browser client. Existing shipment enum/browser-client compatibility dependencies remain through PR 5. Resolved module runtime imports reach no server implementations, and the reachable type/value graph is acyclic; unrelated legacy cycles recorded above remain out of scope. See [migration audit](orders-ui-migration.md) and [verification](verification.md).
