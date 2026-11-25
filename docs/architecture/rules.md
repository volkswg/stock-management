# Architecture rules

## Folder ownership

Apply these rules to new and migrated code. `src/services/`, `src/externals/` and `src/features/` are retired and must not be recreated. Standalone script entrypoints retain their reviewed interfaces. Do not scaffold empty layers or blindly move mixed files.

| Location under `src/` | Owns | Excludes |
| --- | --- | --- |
| `app/**/{page,layout,loading}.tsx` | Next routing, metadata, params, composition and required boundaries | Feature algorithms, reusable feature UI or browser clients |
| `app/api/**/route.ts` | Parsing, transport validation, response/error mapping and dependency construction/injection | Worksheet mapping and duplicate business rules |
| `app/globals.css`, route assets | Global reset/style, Next special assets | Movable feature CSS |
| `modules/<feature>/contracts.ts` | Named browser-safe public DTOs and runtime values with real consumers | Providers, server code, mixed barrels |
| `modules/<feature>/domain` | Framework-independent models and deterministic rules, only when needed | React/Next, config, IO, storage formats, implicit clock/random |
| `modules/<feature>/application` | Use cases and narrow consumer-owned ports | Concrete adapters, provider fetch, JSX, worksheet rows/ranges |
| `modules/<feature>/infrastructure` | Port implementations, named PostgreSQL maps, provider adapters and response mapping | Duplicated generic transports or other features' private adapters |
| `modules/<feature>/server.ts` | Guarded, explicit named server composition | Browser exports or broad all-layer barrels |
| `modules/<feature>/ui` | Components/hooks, co-located CSS, formatters/PDFs and same-origin HTTP clients | Config, credentials, SDK/provider IO, server/application implementation imports |
| `infrastructure/persistence/postgres` | Server-only pooled transactions, durable command/effect transport and named record projections supplied by feature bindings | Feature registries, business calculations, browser access or runtime fallback |
| `infrastructure/external/google-auth` | Shared Google OAuth/service-account token and JWT plumbing retained for Drive | Feature rules, worksheet schema or aggregate feature registry |
| `infrastructure/files/google-drive` | Drive provider/factory/protocol types, using shared Google auth | Order/movement policy |
| `infrastructure/external/{line,loyverse}` | Existing provider HTTP/signature/protocol/factory clients, including standalone operational LINE client | Feature journeys, worksheet reports and new providers |
| `infrastructure/configuration/postgres` | Read-only private integration-account metadata/credential SQL | Operational registry, public credential APIs, business rules or credential writes |
| `infrastructure/runtime` | Existing stateful sortable identifier implementation | Feature rules or duplicated sequence state |
| `composition` | Concrete aggregate construction and named consumer wiring outside feature cores | Business algorithms, browser contracts, generic DI frameworks |
| `shared/{ui,lib,types}` | Proven generic reuse, small explicit utilities/value contracts | Feature dumping ground, config/infrastructure/module/legacy dependencies |
| `config` | Server configuration parsing/types | Feature rules, UI access, env renaming during moves |
| `scripts` | Explicit opt-in operational entrypoints | Automatic execution during verification |
| Root `tests` | Offline synthetic characterization, authoritative historical fixtures | Credentials, production records or automatic snapshot approval |

Root configuration/dependency files, `public` assets and existing operational guides keep their owners. Generic-looking employee, quantity, home and navigation components are not automatically shared. Keep feature contracts with their owner, not in `shared/types` just because another feature consumes them.

## Feature responsibility

| Module | Responsibility as migrations proceed |
| --- | --- |
| Orders | Draft/create/update/list/detail, bills, quantities, product codes/images, item-to-product linking; LINE journey state belongs to LINE workflows |
| Products | PostgreSQL product catalogue, reference media, duplicate review, product lifecycle; Orders consumes its public DTOs through an item-specific seam |
| Shipments | Shipment reads/creation/status, order links and bill coordination; consumes Orders contracts, does not own Order persistence |
| Inventory | Movements/delivery, monthly counts, reversals and adjustments; pure quantity parsing belongs here rather than LINE |
| Sales | Loyverse sync, receipts/refunds/reports and profit overrides; protocol client is root infrastructure |
| Expenses | Ledger/categories and current shop master; do not speculatively transfer shops to workspace |
| HR | Employee lifecycle, compensation, attendance, advances and settlement; consumes public sales/shop contracts when extracted |
| LINE workflows | Commands/replies/session/journeys; calls business use cases, never exports tokens or persistence details |
| Workspace | Home/breadcrumb/navigation; Sales owns its menu shell; global Next layout remains app-owned |

[Migration map](migration-map.md) records actual completed ownership and intentionally retained compatibility. Workspace/Next shell remains app-owned. Current business callers use canonical module owners; the obsolete service forwards are retired. Concrete composition functions live in composition. Inventory owns movement schemas/quantity decisions, LINE owns sessions/journeys and external transport has root owners. All canonical adapters keep row/range mapping out of application ports.

The Sheets business aggregate, worksheet implementations and fixed account
configuration reader are retired from runtime source. Import concrete feature
owners or named composition entrypoints. Google auth remains under shared
infrastructure for Drive. Do not introduce a feature registry in root transport.
Historical guards and predecessor sources remain part of verification only.


## PostgreSQL migration ownership

`modules/<feature>/infrastructure/postgres/tables.ts` binds only that feature's
operational tables and named column maps to shared PostgreSQL transport. Existing
feature-owned port mappers remain the single mapping/calculation implementation.
Named record projections stay in infrastructure; they do not expose SQL handles
to business ports or recreate a parallel persistence service. `composition/postgres` owns the aggregate and
request transaction/auth/idempotency wrapper. The LINE module owns per-event
workflow execution/reply capture; shared transport only records/sends an effect
attempt. Operational schemas and offline promotion/profile tools live under
`supabase/migrations` and `tools/migration`. Immutable staging and mutable business
state have separate schemas and privileges. Current production selects PostgreSQL
through the approved release binding; isolated staging guards remain supported.
Former business Sheets are read-only, and Drive image ownership is unchanged.

`tools/migration` also owns explicit operator-only staging plans, private acceptance
reports, offline invocation of existing business readers, consistent logical backup
and restore evidence. These tools do not become runtime services or application
ports. Database tools require private PGSERVICE configuration; plugin identity is
not borrowed. Only synthetic fixture wrappers select disposable local databases.

## Dependency rules

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

Products exposes browser-safe `contracts.ts` to Orders catalogue contracts, its
consumer port and catalogue UI only. `composition/order-products.ts` wires the two
public server entrypoints. Products never imports Orders. The item-link use case
and product creation share the existing durable command transaction.

## Scoped enforcement

[Root ESLint config](../../eslint.config.mjs) registers the following existing rule sets. Their exact-path allowlists and shape checks are authoritative; this guide grants no broad module allowance. Rules for retired worksheet/client scopes remain historical test safeguards, not live owners to recreate.

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

Final scopes supplement the earlier exact guards: [Sales](../../eslint/sales-application-boundaries.mjs), [Inventory](../../eslint/inventory-application-boundaries.mjs), [Orders/LINE](../../eslint/orders-line-workflows-boundaries.mjs), [external transport](../../eslint/external-infrastructure-boundaries.mjs) and [final composition/compatibility](../../eslint/final-architecture-boundaries.mjs). The final independent rules reject active legacy imports and physical implementations in compatibility paths without overriding earlier application clock/dynamic/enum safeguards. Relocated physical composition retains its own explicit import/forwarding restrictions; historical compatibility leaves in pinned predecessor copies allow only their named canonical owner. Current source has no service-forward directory. [External retirement](../../eslint/externals-retirement-boundaries.mjs) rejects retired imports in production and active tests, including erased, re-export, CommonJS, import-equals and statically folded dynamic paths. It also forbids recreating the directory and runtime/provider code in the pure root service-contracts leaf.

## Known legacy limits

Current runtime/type browser graphs inspect physical canonical source; historical
graphs restore exact predecessor bytes for old positive/negative evidence. Do not
expand allowlists or recreate retired Sheets/service/feature paths to satisfy them.
Root configuration/transport has no feature registry; concrete construction stays
in composition. Current concurrency/retry/provider behavior is described in
[decisions](decisions.md), not by historical nontransactional Sheets examples.
Local lint/graph/fake-provider results do not certify hosted capacity, real provider
availability, browser visuals or authentication security.

## Loyverse account source boundary

[Scoped account guards](../../eslint/loyverse-accounts-boundaries.mjs) require server-only storage/composition, exact dependencies and a two-field pure metadata DTO. Consumers cannot read raw credential configuration, import the synchronous env-only factory or reach the private reader via alias, relative, erased or dynamic paths. HTTP composition receives metadata; Sales receives its existing ReceiptSource capability. No application/domain imports the new storage/composition implementation. Private Google failures discard provider bodies and client failures redact known tokens before HTTP/log handling. The actual current runtime/type/browser graphs remain independent of historical source inverses.

## Retired feature namespace

[Feature retirement guards](../../eslint/features-retirement-boundaries.mjs) reject live `@/features`, `@/feature` and relative feature-path imports in production and active tests, including erased, re-export, dynamic, CommonJS, import-equals and import-type forms. Recreating `src/features/` is forbidden. These independent rules supplement existing feature/Google/external/account safeguards without widening exceptions. The obsolete forwarding scope and singular alias are removed.

Historical graph hosts may resolve the seven archived paths for original/negative evidence only. Actual graph roots are physical current files; current import resolution, browser reachability, cycles, public module directions and canonical enum/function identities are verified separately. No application/domain or feature infrastructure dependency is added. Retained script interfaces and active retry/rollback compatibility still require consumer audits before retirement.


## PostgreSQL persistence boundaries

Feature-owned bindings supply explicit named column/type maps to shared server-only
record transport. Root infrastructure imports no feature registry. Composition
supplies the request-wide transaction; LINE owns per-event workflow coordination.
No browser graph may reach pg, private SQL or credentials. The shared operation
script contains no credentials and is active in production despite its historical
staging label. Isolated staging retains its separate bearer/target/read-only guards.

The Sheets record-reference bridge and business backend are retired. Current
acceptance executes actual physical source; only explicit hash-bound historical
copies run old range/header/adapter contracts. Preserve original fixture hashes
and negative assertions when adding a bounded inverse for a later source/doc move.
Historical success never substitutes for current SQL/transaction acceptance.

The pure `shared/lib/utc-timestamp.ts` comparison key has named HR compensation,
attendance/advance and Inventory adjustment/count consumers. Their closed import
scopes permit only this exact leaf. It pads fractional precision for comparisons
without clocks, provider IO, DTO mutation or changes to business-date priorities;
this is not a general shared import exception. Current executable source loaders
read the actual leaf, while bounded timestamp inverses preserve earlier historical
fixtures and file inventories separately.

Products exposes `browser.ts` as a named browser-safe client to its Product Master
page and the Orders catalogue client. It owns the existing durable product-request
identity/journal protocol. Orders retains its item-specific endpoint and DTOs;
Products never imports Orders. The workspace links to `/products`, whose page
composition renders Products-owned UI. No server dependency enters this browser leaf.

The movement destination stage adds two exact server-reader edges: LINE and
Inventory server composition consume Expenses' public `readMovementShopDirectory`.
Expenses owns the fixed-column, read-only shop projection (including inactive/deleted
masters for historical attribution); Inventory owns retained movement-label aliases.
LINE core receives only its semantic shop port and never reads shop SQL or tokens.
The native lint scopes name only these entrypoints/adapters; browser/core SQL and
cross-feature private imports remain forbidden. Historical source inverses are
test-only, hash bounded, and separate from actual current-source acceptance.
