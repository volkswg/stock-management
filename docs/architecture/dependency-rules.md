# Dependency rules

Rules apply to new/migrated slices, including aliases, relatives, re-exports, erased imports, `import(...)` types, dynamic import and require. A type-only import can still violate ownership. Examine transitive graphs; an app/legacy forwarding shim is not a feature ownership firewall.

| Importer | Allowed | Forbidden |
| --- | --- | --- |
| App server composition | Named module server/UI entrypoints, config, concrete adapters for wiring | Implementing feature/storage algorithms in routes |
| Domain | Own pure models, proven generic pure utilities, documented pure public contracts | App, application, UI, concrete infrastructure, legacy services, frameworks/config/IO |
| Application | Own contracts/ports and approved pure helpers; other public contracts only for named consumers | Concrete infrastructure, app/UI, config/env, SDK/provider/HTTP/Node IO, direct clock/random |
| Feature infrastructure | Own ports, root transport, explicit public consumer contracts, approved erased interface/config types | App/UI, another feature's private adapters, mixed service barrels |
| Module UI | Own UI/public browser contracts, approved public UI entrypoints, React/Next browser APIs, same-origin HTTP | Server/application/infrastructure, config, Node, providers, legacy services |
| Root infrastructure | Own generic transport/protocol/auth, approved erased config types | Feature implementation/schema, app/UI or legacy aggregate registry |
| Shared | Generic shared code and compatible platform libraries | Modules/app/config/infrastructure and legacy feature code |
| Config | Pure generic parsers/types | New feature/app/adapter dependencies; its existing legacy `isRecord` parser dependency needs a separate cleanup |

## Actual public surfaces and directions

- Orders `contracts.ts` is self-contained: OrderStatus, OrderItemQuantityType and existing DTOs (including the Orders-owned OrderShipment wire-status union). `server.ts` names listOrders, createOrder and getOrderDetail; detail requires an injected Orders-owned projection. Shipments may consume Orders contracts, the specific detail projection port and `ui/OrderImageGallery.tsx`.
- Shipments `status.ts` defines the single five-member enum and imports nothing. `contracts.ts` owns the eight DTO aliases, imports only erased Orders OrderStatus and its own status leaf, and exports **only ShipmentStatus at runtime**. The legacy types leaf forwards public values/types. It no longer owns DTOs and public contracts do not reach legacy services.
- Shipment `server.ts` names createShipment, listShipments, getShipmentDetail, linkOrderToShipment, updateShipmentStatus, advanceShipmentStatusWithBill and the original LinkOrderToShipmentError. Three Shipment HTTP routes and backend validation consume module public entrypoints, not the mixed legacy Shipment barrel. Direct/barrel compatibility functions and the error class remain strictly identical.
- **No Orders module → Shipments module edge**, runtime or type-only. Shipments → Orders is allowed only through the explicit public contracts/port/gallery above. Both the Orders browser picker and detail projection ports are Orders-owned; app or explicit legacy compatibility composition supplies concrete Shipment implementations outside Orders core.
- Inventory contracts expose the existing StockCountAccount, AdjustmentEmployee and StockAdjustment DTOs, AdjustmentReason and ADJUSTMENT_REASONS. Its employee-directory port/application imports no HR implementation. HR's contracts/public readEmployeeDirectory query remain independent of Inventory. Guarded legacy composition wires them together. No Inventory → HR private header/worksheet dependency and no reverse HR → Inventory error dependency.
- Future Sales queries serve Inventory/HR; Expenses owns shop contracts consumed by HR/Sales. Extract only real consumer contracts. LINE workflows consume Orders/Inventory; move pure quantity parsing out of LINE before creating a reverse module edge. These are pending contracts, not permission to import legacy private code.

Public files are named, narrow and consumer-driven. No broad index mixing UI/contracts/server layers. Compatibility paths remain until a complete consumer audit proves retirement safe, including tests, type imports, scripts and external consumers. No module imports app composition.

## Scoped enforcement

[Root ESLint config](../../eslint.config.mjs) registers the following existing rule sets. Their actual exact-path allowlists and shape checks are authoritative; this guide does not grant a broad module allowance.

| Rules | Protected boundary |
| --- | --- |
| [Orders browser](../../eslint/orders-boundaries.mjs) | Module UI rejects Shipment/app/legacy imports; picker port permits only Orders contracts. App OrderDetailClient allows exact detail/port, Shipment client and public enum imports, with no direct fetch/server/provider IO |
| [Shipment browser/contracts](../../eslint/shipments-boundaries.mjs) | All module UI forbids app/server/provider code; HTTP client allows erased own contracts plus browser fetch. Pure enum allows only exact enum declaration; contracts/legacy leaf require exact runtime/type export shapes |
| [Orders server](../../eslint/orders-server-boundaries.mjs) | Exact list/create/detail application/port/adapter/server imports; no concrete IO, direct Date/random/env in application, erased provider interfaces only where approved |
| [Shipment server](../../eslint/shipments-server-boundaries.mjs) | Separate exact creation/read/link/status/bill/projection scopes; no private Orders mapper. Only bill adapter permits original File/Buffer/Date conversion. Port/application exposes no transport types |
| [Shared Google](../../eslint/google-infrastructure-boundaries.mjs) | Exact seventeen root files, no feature/legacy implementation edges; Drive factory permits existing AppConfig as erased input only |
| [Orders pure Sheet prerequisite](../../eslint/orders-sheet-type-boundaries.mjs) | Orders worksheet/mapper avoid mixed aggregate Sheets type imports, including erased/relative bypasses |
| [Feature worksheets](../../eslint/worksheet-boundaries.mjs) | Exact Orders/Shipment/Sales/HR/Inventory class/header paths admit root BaseGoogleSheet, erased generic types, range utility and local headers only |
| [Employee directory](../../eslint/employee-directory-boundaries.mjs) | Exact Inventory/HR contracts/application/reader/query/composition; legacy adjustment/count/movement scopes reject mixed Sheets/private HR header paths |

Tests execute real flat-config positive/negative cases for alias, relative, erased, re-export, dynamic/require/import-equals/import-type bypasses, forbidden Node/framework/provider/config imports, direct global IO/time/random and exact public shapes. Required `server-only` markers protect new server compositions/adapters. Existing moved providers/worksheets do not gain markers that would alter original evaluation; browser reachability is tested instead.

ESLint direct-import rules do not prove transitive safety or cycles. TypeScript-resolved graph tests supplement them in runtime and runtime-plus-type modes, resolve re-exports, collapse intermediary paths for ownership, reject module/file cycles and inspect client reachability. Use [browser ownership helper](../../tests/helpers/browser-ownership.mjs) and relevant seam tests; do not silently expand closed offline loaders or global allowlists to make new code pass. Add tools/dependencies only in a separately justified tooling change.

## Known legacy limits

Migrated Orders/Shipment browser graphs are server/provider-free in both modes. The whole repository is **not** type-graph-clean: four inherited legacy client erased paths remain for salary advances, payroll, expense master and expenses. PR23 removed two old movement-page paths; the original PR22 audit stays authoritative with that exact source-backed delta. Runtime client safety and these known erased debts are checked separately. Do not claim that passing scoped lint audits every third-party package or all unextracted legacy public-query aggregation.

Aggregate IGoogleSheetsService/registry and legacy Sales/Expense/HR queries remain server-side debt. Root Drive's erased AppConfig path still reaches the existing pure legacy parser in the type graph; it does not evaluate config on import. Resolve these in scoped work without adding new violations or repository-wide exemptions.


Inventory worksheet scopes admit root BaseGoogleSheet or the existing generic RecordsSheet superclass and erased generic types; StockCountsSheet additionally admits root lastColumnLetter and its own header. MovementSheet admits neither a header nor a range helper. Actual runtime/type graphs preserve only Shipments→Orders and reject new Inventory→LINE/private feature edges, including legacy-service and mixed-Sheets-barrel intermediaries. The existing legacy movement service's LINE quantity-helper dependency is not migrated into the new worksheet graph; business/use-case ownership cleanup remains separate.


The movement business service must not import `services/movements/state.ts`, including alias/relative/type/re-export/dynamic bypasses. It consumes the schema leaf, which permits only erased root IGoogleRowsSheet and no runtime dependencies. Existing employee-directory restrictions remain in force. Tests demonstrate the original forbidden future-LINE path, its removal from movement operations/client erased graphs, and unchanged protected module runtime/type DAGs. PR28 subsequently removed the stock-counts → Sales → mixed Sheets registry path using the direct query and pure erased types; its negative regression remains active.


Inventory stock counts must consume the direct existing Sales read query, not services/sales or its index. That query permits only the four exact Sales receipt/item/payment/sync header leaves, erased pure Sheet types, Expense types and Sales contracts. Value or erased mixed registries, Expense barrels and override implementation imports are forbidden. The Sales contracts leaf exports only the original erased SalesProfitCostOverride alias and has no imports/runtime values. Query/private-implementation separation is checked in runtime and type-inclusive graphs, including restored-import negative cases. This closes the specific stock-count/Sales/registry path recorded in PR27 without widening its guards or migrating legacy Sales consumers generally.


## LINE user-state worksheet boundary

The two LINE worksheet owners use the same exact worksheet ESLint scopes as existing migrated classes: only root BaseGoogleSheet, erased generic Sheet interfaces, root lastColumnLetter and local headers. No mixed registry, private feature, config/provider, dynamic/require/import-type forwarding or IO globals are permitted. Compatibility leaves are traversed by the graph; they are not ownership firewalls.

PR29 checks actual runtime and type-inclusive consumers after relocation. Inventory movement/count/adjustment operations and the Sales query have no LINE-private worksheet path; both prerequisites retain exact source bytes. Module closure graphs remain file-acyclic with only Shipments→Orders. All client closure sets are identical after canonicalizing just the two moved paths; the four inherited erased debts remain unchanged. A full-source audit also records the **pre-existing** erased `calculateEmployeePayroll.ts ↔ manageSalaryAdvances.ts` cycle; no cycle is added and no exception permits a new one. That legacy cleanup is outside this worksheet move.


The remaining record worksheets use root RecordsSheet, whose original behavior is only generic row transport. Inventory and HR import that root class directly, never Expenses infrastructure. Expenses names the same constructor through a single explicit alias; the legacy path forwards through Expenses. Header leaves import nothing. Inventory public contracts now include the existing adjustment reasons and DTOs, consumed by StockAdjustmentsPanel; no browser reaches the new worksheet classes at runtime. Exact worksheet/root lint scopes and the remaining-worksheets graph tests enforce these directions in runtime and type-inclusive modes. Legacy service header forwards remain compatibility surfaces, not public module contracts.
