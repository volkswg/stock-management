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
- Expenses contracts own Expense, ExpenseShop, ExpenseCategory and ExpenseInput. Its named server entrypoint composes its own application with its own Sheets adapter. HR SalaryAdvanceShops consumes only the public ExpenseShop identity/active projection; legacy/app composition injects its reader. Sales consumes the public Expense type and receives expense/shop data in route composition. LINE workflows consume Orders/Inventory; move pure quantity parsing out of LINE before creating a reverse module edge. These are pending contracts, not permission to import legacy private code.

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
| [HR workforce](../../eslint/hr-workforce-boundaries.mjs) | Exact employee/attendance applications, semantic snapshot/reference ports, compensation/date rules, workforce adapter/runtime, HTTP imports and typed compatibility aliases |
| [HR financial](../../eslint/hr-payroll-boundaries.mjs) | Exact payroll/salary domain, application/ports, salary store, revision adapter, named server and explicit legacy reader composition; browser/HTTP exclusions |
| [Expenses business](../../eslint/expenses-boundaries.mjs) | Exact contracts/rules/ports/application/adapter/server/HR-reader scopes, browser imports and HR/Sales legacy/private import exclusions |
| [Employee directory](../../eslint/employee-directory-boundaries.mjs) | Exact Inventory/HR contracts/application/reader/query/composition; legacy adjustment/count/movement scopes reject mixed Sheets/private HR header paths |

Tests execute real flat-config positive/negative cases for alias, relative, erased, re-export, dynamic/require/import-equals/import-type bypasses, forbidden Node/framework/provider/config imports, direct global IO/time/random and exact public shapes. Required `server-only` markers protect new server compositions/adapters. Existing moved providers/worksheets do not gain markers that would alter original evaluation; browser reachability is tested instead.

ESLint direct-import rules do not prove transitive safety or cycles. TypeScript-resolved graph tests supplement them in runtime and runtime-plus-type modes, resolve re-exports, collapse intermediary paths for ownership, reject module/file cycles and inspect client reachability. Use [browser ownership helper](../../tests/helpers/browser-ownership.mjs) and relevant seam tests; do not silently expand closed offline loaders or global allowlists to make new code pass. Add tools/dependencies only in a separately justified tooling change.

## Known legacy limits

Migrated Orders/Shipment browser graphs are server/provider-free in both modes. The previously registered legacy client provider paths are closed in source: the two salary advance/payroll erased paths are now removed through pure HR contracts, following the two Expenses removals in PR31. PR23 removed two old movement-page paths; the original PR22 audit stays authoritative with that exact source-backed delta. Runtime client safety and these known erased debts are checked separately. Do not claim that passing scoped lint audits every third-party package or all unextracted legacy public-query aggregation.

Aggregate IGoogleSheetsService/registry and supported legacy compatibility composition remain server-side debt; Sales and HR queries are feature-owned. Expenses application and adapter no longer depend on those mixed legacy types. Root Drive's erased AppConfig path still reaches the existing pure legacy parser in the type graph; it does not evaluate config on import. Resolve these in scoped work without adding new violations or repository-wide exemptions.


Inventory worksheet scopes admit root BaseGoogleSheet or the existing generic RecordsSheet superclass and erased generic types; StockCountsSheet additionally admits root lastColumnLetter and its own header. MovementSheet admits neither a header nor a range helper. Actual runtime/type graphs preserve only Shipments→Orders and reject new Inventory→LINE/private feature edges, including legacy-service and mixed-Sheets-barrel intermediaries. The existing legacy movement service's LINE quantity-helper dependency is not migrated into the new worksheet graph; business/use-case ownership cleanup remains separate.


The movement business service must not import `services/movements/state.ts`, including alias/relative/type/re-export/dynamic bypasses. It consumes the schema leaf, which permits only erased root IGoogleRowsSheet and no runtime dependencies. Existing employee-directory restrictions remain in force. Tests demonstrate the original forbidden future-LINE path, its removal from movement operations/client erased graphs, and unchanged protected module runtime/type DAGs. PR28 subsequently removed the stock-counts → Sales → mixed Sheets registry path using the direct query and pure erased types; its negative regression remains active.


The PR28 direct Sales-query prerequisite is preserved as a historical source-backed negative. Current Inventory reconciliation composes the public Sales dashboard reader, whose implementation owns receipt projections behind semantic ports. The old direct query is a named compatibility forward. Sales contracts expose the original report DTOs and the erased public Expense projection; they contain no runtime values. No value/type path through a legacy barrel is accepted as an application boundary.


## LINE user-state worksheet boundary

The two LINE worksheet owners use the same exact worksheet ESLint scopes as existing migrated classes: only root BaseGoogleSheet, erased generic Sheet interfaces, root lastColumnLetter and local headers. No mixed registry, private feature, config/provider, dynamic/require/import-type forwarding or IO globals are permitted. Compatibility leaves are traversed by the graph; they are not ownership firewalls.

PR29 checks actual runtime and type-inclusive consumers after relocation. Inventory movement/count/adjustment operations and the Sales query have no LINE-private worksheet path; both prerequisites retain exact source bytes. Module closure graphs remain file-acyclic with only Shipments→Orders. All client closure sets are identical after canonicalizing just the two moved paths; the four inherited erased debts remain unchanged. That historical audit recorded the erased `calculateEmployeePayroll.ts ↔ manageSalaryAdvances.ts` cycle. The HR financial milestone now removes it; a restored-original overlay still reproduces its exact historical path, while current full-source cycles are empty in both modes.


The remaining record worksheets use root RecordsSheet, whose original behavior is only generic row transport. Inventory and HR import that root class directly, never Expenses infrastructure. Expenses names the same constructor through a single explicit alias; the legacy path forwards through Expenses. Header leaves import nothing. Inventory public contracts now include the existing adjustment reasons and DTOs, consumed by StockAdjustmentsPanel; no browser reaches the new worksheet classes at runtime. Exact worksheet/root lint scopes and the remaining-worksheets graph tests enforce these directions in runtime and type-inclusive modes. Legacy service header forwards remain compatibility surfaces, not public module contracts.


Expenses application imports only its own public types, deterministic rules and consumer-owned ports. Runtime time/ID generation is injected; only the server composition uses current Date/randomUUID. The adapter uses root generic Sheet interfaces and its own header leaves, with no aggregate registry import even when erased. It keeps raw cell coercion and storage locations private. HR→Expenses is allowed only as an erased ExpenseShop contract edge in SalaryAdvanceShops; the complete migrated module graph retains Shipments→Orders plus that explicit type-only edge. Browser clients reach neither Expenses server nor adapter at runtime, and both Expenses pages are clean in both graph modes. Historical graph tests retain precise old baselines and remove only those two source-backed debts; restored-original negative graphs continue proving the old forbidden mixed-registry paths.


HR payroll/advance/settlement core imports only HR contracts, deterministic domain functions and its own consumer ports. Salary storage imports only root generic Sheet types, own headers/contracts/rules and its port. Revision hashing is isolated in HR infrastructure; implicit clocks belong only to payroll-server. The public server requires explicit employee/compensation/attendance/Sales readers and never imports their legacy composition. The legacy bridge is outside modules and uses the direct existing Sales query. Workforce readers now come from HR’s public createHRPayrollReaders factory, preserving function identity/read behavior without a private HR→Sales edge. Apps compose the named payroll server with these readers and the existing SalaryAdvanceShops seam. The two fixed browser consumers reach no legacy service, infrastructure or server path in either graph mode. All current source file cycles are rejected; no inherited cycle exemption remains.


HR workforce application code imports only own contracts/ports and deterministic rules; compensation selection receives a supplied date value. The workforce adapter owns headers, parsers, ranges and record locations. Snapshots preserve deferred parsing and short-circuiting required by the original operations. Only workforce-runtime constructs the current time/UUIDs. The public server composes these layers and keeps the existing directory query; its precise allowlist gains only named HR owners. No new blanket or cross-feature private allowance is introduced.

Legacy employee/attendance files contain typed identity aliases, not implementations. Exact legacy scopes forbid functions/classes/provider imports and dynamic bypasses. The sole internal enum alias is restricted to EmployeeTimesheetStatus = CanonicalStatus, preserving its type namespace and runtime key order; application/domain import-equals remain forbidden. The payroll bridge imports the HR public reader factory rather than either legacy workforce service. All HR browser graphs remain server/provider-free in both modes, and complete source file cycles remain empty.

## Sales and Inventory business boundaries

Sales application/domain accepts only own consumer ports/contracts and the erased public Expense projection. Inventory application/domain accepts only own semantic ports/contracts/rules. Exact scoped ESLint guards cover the new physical owners and reject legacy, provider/config, private-feature, dynamic/import-type and implicit-clock bypasses. Worksheet scopes remain independent and unchanged. Inventory server alone composes HR directory and Sales dashboard public readers. Sales server alone composes Sheets adapters and the unchanged Loyverse account interface.

The complete current module DAG is LINE workflows→Orders, LINE workflows→Inventory, Inventory→HR, Inventory→Sales and Shipments→Orders at runtime, adding HR→Expenses and Sales→Expenses only for public types. Full-source file cycles remain forbidden in both modes. Direct and intermediary cross-feature edges may reach only the named public leaves (plus the existing specifically registered Orders projection/gallery). An already allowed module direction does not authorize a private adapter import. All browser graphs remain provider/server-free in both modes.

Historical graph/count assertions use exact verified source overlays for subsequent reviewed moves; immutable original fixtures and restored forbidden-path negatives remain authoritative. Separate full-current graph/lint tests enforce current owners and public composition without allowing historical overlays to hide new violations.

## Orders and LINE composition

Orders application/domain import only owned contracts/ports/rules; LINE core additionally uses public Orders contracts/rules and Inventory contracts/quantity decisions, plus pure shared protocol/message leaves. LINE server alone composes public Orders/Inventory entrypoints; no reverse Orders→LINE or Orders→Shipments dependency. Orders rules.ts is a specifically registered public pure leaf. Existing Shipments projection/gallery exceptions stay exact. Session worksheet leaves may not import feature composition even along an allowed module direction.

Shared protocol helpers import no feature/server/provider. Root batch/header repair uses root generic persistence interfaces only. New scoped lint retains inherited provider-type restrictions and blocks legacy/private/dynamic/implicit-clock bypasses. Full-current graph checks cover every runtime/type file and browser root independently of historical source overlays.

## External provider transport

LINE/Loyverse HTTP/authentication, pagination and response/error mapping live under root `infrastructure/external/`. Their exact scopes permit local protocol files, pure shared LINE helpers, Node crypto and the erased AppConfig type for the existing account factory. Configuration values are supplied by composition; transport imports no feature/legacy implementation. Sales and LINE server scopes use the canonical external types; browser contracts remain independent. Old external leaves/indexes are named compatibility surfaces with strict constructor identity.
