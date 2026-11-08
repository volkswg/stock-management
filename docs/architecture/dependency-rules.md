# Dependency rules

Rules cover static/relative/alias imports, re-exports, erased types, import-type, dynamic import and require. An erased import can violate ownership; a legacy intermediary does not make private cross-feature access public.

| Importer | Allowed | Forbidden |
| --- | --- | --- |
| App server/explicit composition | Named public modules, config, root transport, concrete adapters required for wiring | Feature/storage algorithms in HTTP routes; active legacy runtime imports |
| Domain/application | Own contracts/rules/consumer ports, pure shared utilities, registered public consumer contracts/rules | Providers, concrete infrastructure/composition, legacy implementations, config/framework IO, implicit time/random |
| Feature infrastructure | Own ports/headers/mapping, root transport, registered public consumer contracts, erased root service interfaces | Another feature's private adapters, app/UI, mixed runtime barrels |
| Module UI/public browser contracts | Own/browser-safe registered contracts/UI, React/Next browser APIs and same-origin HTTP | Server/application/infrastructure/composition/config, Node/provider or legacy reachability, including erased paths |
| Root infrastructure | Generic transport/auth/protocol/runtime and supplied erased configuration types | Feature/schema/aggregate registry implementations or composition |
| Shared | Proven pure generic helpers/contracts | Features/app/config/infrastructure/composition/legacy dependencies |
| Config | Existing parsing/types using shared isRecord | Feature rules, provider execution or UI access |
| Compatibility | Exact named forwards/type/value identity bindings to canonical owners | Physical business functions/classes, duplicate state, broad barrels or forwarding cycles |

## Actual public surfaces and directions

- Orders contracts/rules/server own all order business surfaces; detail requires its own Shipment projection port. No Orders→Shipments or Orders→LINE module dependency. Shipments may use Orders contracts, the registered projection port and OrderImageGallery.
- Shipments has a single status enum, eight public DTOs, named server operations/error and public HTTP validation. Its browser client stays same-origin. Composition supplies the concrete Shipment detail projection outside Orders core.
- Inventory server alone composes public HR directory and Sales dashboard readers. Inventory application/domain receives semantic own ports. Its quantity public leaf exposes pure original rules to LINE; LINE never reads Inventory private worksheets directly.
- HR owns workforce/financial contracts and operations. Payroll receives HR-owned readers with public Sales data; SalaryAdvanceShops consumes the public Expenses shop projection. Concrete Sales/Expenses reader wiring lives in composition, not HR core.
- Sales receives Expenses data/public types and owns reports/receipt persistence. LINE core uses public Orders contracts/rules and Inventory contracts/quantity plus shared protocol DTOs/messages. Config/providers/aggregate service are injected at server/HTTP composition.
- Runtime module DAG: LINE workflows→Orders/Inventory, Inventory→HR/Sales, Shipments→Orders. Types add HR→Expenses and Sales→Expenses. Registered public leaves are contracts/server/status/quantity, LINE's specifically consumed Orders rules leaf, and the existing Shipment→Orders projection/gallery exceptions.

No module imports app/root composition. A public feature entrypoint may reach its own implementation; private dependencies across feature edges remain forbidden. Shared transport imports no feature even through erased declarations.

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

Final scopes supplement the earlier exact guards: [Sales](../../eslint/sales-application-boundaries.mjs), [Inventory](../../eslint/inventory-application-boundaries.mjs), [Orders/LINE](../../eslint/orders-line-workflows-boundaries.mjs), [external transport](../../eslint/external-infrastructure-boundaries.mjs) and [final composition/compatibility](../../eslint/final-architecture-boundaries.mjs). The final independent rules reject active legacy imports and physical implementations in compatibility paths without overriding earlier application clock/dynamic/enum safeguards. Relocated physical composition retains its own explicit import/forwarding restrictions; remaining compatibility leaves allow only their named canonical owner. [External retirement](../../eslint/externals-retirement-boundaries.mjs) rejects retired imports in production and active tests, including erased, re-export, CommonJS, import-equals and statically folded dynamic paths. It also forbids recreating the directory and runtime/provider code in the pure root service-contracts leaf.

## Known legacy limits

All current browser graphs are clean in both modes; the inherited payroll type cycle is removed. Historical fixtures and restored-original negative graphs retain evidence of the old cycle/registry/browser paths. Exact source/hash inverses reconcile later moves before earlier guards run; independent current graphs inspect actual source, not those overlays.

The aggregate service/config interfaces live in the pure root `infrastructure/persistence/google-sheets/service-contracts.ts` leaf with identical declarations. Concrete construction lives only in explicit composition. Merged PR #40 removed all external indexes/forwards after the consumer audit; current tests load canonical owners and use test-only export projections for archived mixed-barrel identity evidence. Historical resolution is explicit and separate from strict physical current graphs. No generic repository, provider replacement, transaction/lock/retry/reconciliation policy or speculative Workspace redesign is introduced. Existing concurrency/partial-failure limitations remain; local graph/lint/fake-provider tests do not establish real provider availability, UI visuals, independent CI or authentication security.

## Loyverse account source boundary

[Scoped account guards](../../eslint/loyverse-accounts-boundaries.mjs) require server-only storage/composition, exact dependencies and a two-field pure metadata DTO. Consumers cannot read raw credential configuration, import the synchronous env-only factory or reach the private reader via alias, relative, erased or dynamic paths. HTTP composition receives metadata; Sales receives its existing ReceiptSource capability. No application/domain imports the new storage/composition implementation. Private Google failures discard provider bodies and client failures redact known tokens before HTTP/log handling. The actual current runtime/type/browser graphs remain independent of historical source inverses.

## Retired feature namespace

[Feature retirement guards](../../eslint/features-retirement-boundaries.mjs) reject live `@/features`, `@/feature` and relative feature-path imports in production and active tests, including erased, re-export, dynamic, CommonJS, import-equals and import-type forms. Recreating `src/features/` is forbidden. These independent rules supplement existing feature/Google/external/account safeguards without widening exceptions. The obsolete forwarding scope and singular alias are removed.

Historical graph hosts may resolve the seven archived paths for original/negative evidence only. Actual graph roots are physical current files; current import resolution, browser reachability, cycles, public module directions and canonical enum/function identities are verified separately. No application/domain or feature infrastructure dependency is added. Remaining service/script compatibility still requires its own consumer audit before retirement.

## Product Master integration

Products owns browser-safe contracts, duplicate/validation rules, semantic application ports and its own Sheets row mapping. Orders owns a separate link contract/store and a minimal LinkableProducts reader; composition injects Products.findById. The app client injects ProductSelector through an Orders-owned ReactNode picker interface. No new runtime or erased cross-module edge/private import is permitted; the existing feature DAG stays unchanged. Product search/creation never enters Order uploads or LINE journeys.

[Product Master scopes](../../eslint/product-master-boundaries.mjs) protect contracts, rules, applications/ports, adapters, composition, staff security/config, new HTTP routes and identification UI. Provider rows/ranges, config, legacy services and implicit clocks stay outside core; browser graphs must exclude even erased server dependencies. Existing Orders/HR/Sales/Inventory/Google/history guards stay active. Historical inverses cover only six exact reviewed source/lint/template changes; the independent graph and new executable/UI tests inspect physical current source. The original 23-page/35-API fixture stays immutable; seven explicitly authorized new APIs are checked separately.

New writes require configured staff keys, signed host-bound HTTP-only sessions and same-origin HTTPS. Existing authentication policies remain; new metadata reads follow existing app reads. Root security receives erased settings and never reads config itself; HTTP composition validates access before constructing provider services. All staff can edit/link across the catalog. Owner setup, revocation limits and review of sign-in abuse protection are in [README](../../README.md#product-master-and-order-item-identification). This scoped feature does not close issue #38 for other domains.

Product write coordination is blocked on an approved durable executor/journal design; see [the review decision](decisions.md#product-write-coordination-review-blocker). No new provider/store, speculative coordinator port or bounded-CAS production implementation is added. Existing application/domain interfaces, server/browser graphs and K-only adapter ownership remain intact. Future executor wiring belongs in explicit server/root technical infrastructure composition; business validation/mapping must stay with Products/Orders. A lock/lease or an unverified metadata CAS cannot silently substitute for the required durable semantics.
