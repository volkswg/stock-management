# Folder ownership

Apply these rules to new and migrated code. `services` and standalone script leaves retain reviewed compatibility surfaces. `src/externals/` and `src/features/` are retired and must not be recreated. Do not scaffold empty layers or blindly move mixed files.

| Location under `src/` | Owns | Excludes |
| --- | --- | --- |
| `app/**/{page,layout,loading}.tsx` | Next routing, metadata, params, composition and required boundaries | Feature algorithms, reusable feature UI or browser clients |
| `app/api/**/route.ts` | Parsing, transport validation, response/error mapping and dependency construction/injection | Worksheet mapping and duplicate business rules |
| `app/globals.css`, route assets | Global reset/style, Next special assets | Movable feature CSS |
| `modules/<feature>/contracts.ts` | Named browser-safe public DTOs and runtime values with real consumers | Providers, server code, mixed barrels |
| `modules/<feature>/domain` | Framework-independent models and deterministic rules, only when needed | React/Next, config, IO, storage formats, implicit clock/random |
| `modules/<feature>/application` | Use cases and narrow consumer-owned ports | Concrete adapters, provider fetch, JSX, worksheet rows/ranges |
| `modules/<feature>/infrastructure` | Port implementations, feature worksheets/headers and row/response mapping | Duplicated generic transports or other features' private adapters |
| `modules/<feature>/server.ts` | Guarded, explicit named server composition | Browser exports or broad all-layer barrels |
| `modules/<feature>/ui` | Components/hooks, co-located CSS, formatters/PDFs and same-origin HTTP clients | Config, credentials, SDK/provider IO, server/application implementation imports |
| `infrastructure/persistence/postgres` | Server-only pooled transactions, durable command/effect transport and compatibility record projections supplied by feature bindings | Feature registries, business calculations, browser access or runtime fallback |
| `infrastructure/persistence/google-sheets` | Shared Sheets client/base/row delegates/constants/types and Google auth/JWT plumbing | Feature rules, worksheet schema or aggregate feature registry |
| `infrastructure/files/google-drive` | Drive provider/factory/protocol types, using shared Google auth | Order/movement policy |
| `infrastructure/external/{line,loyverse}` | Existing provider HTTP/signature/protocol/factory clients, including standalone operational LINE client | Feature journeys, worksheet reports and new providers |
| `infrastructure/configuration/google-sheets` | Read-only private integration-account row validation | Operational registry, public credential APIs, business rules or credential writes |
| `infrastructure/runtime` | Existing stateful sortable identifier implementation | Feature rules or duplicated sequence state |
| `composition` | Concrete aggregate construction and compatibility consumer wiring outside feature cores | Business algorithms, browser contracts, generic DI frameworks |
| `shared/{ui,lib,types}` | Proven generic reuse, small explicit utilities/value contracts | Feature dumping ground, config/infrastructure/module/legacy dependencies |
| `config` | Server configuration parsing/types | Feature rules, UI access, env renaming during moves |
| `scripts` | Explicit opt-in operational entrypoints | Automatic execution during verification |
| Root `tests` | Offline synthetic characterization, authoritative historical fixtures | Credentials, production records or automatic snapshot approval |

Root configuration/dependency files, `public` assets and existing operational guides keep their owners. Generic-looking employee, quantity, home and navigation components are not automatically shared. Keep feature contracts with their owner, not in `shared/types` just because another feature consumes them.

## Feature responsibility

| Module | Responsibility as migrations proceed |
| --- | --- |
| Orders | Draft/create/update/list/detail, bills, quantities, product codes/images; LINE journey state belongs to LINE workflows |
| Shipments | Shipment reads/creation/status, order links and bill coordination; consumes Orders contracts, does not own Order persistence |
| Inventory | Movements/delivery, monthly counts, reversals and adjustments; pure quantity parsing belongs here rather than LINE |
| Sales | Loyverse sync, receipts/refunds/reports and profit overrides; protocol client is root infrastructure |
| Expenses | Ledger/categories and current shop master; do not speculatively transfer shops to workspace |
| HR | Employee lifecycle, compensation, attendance, advances and settlement; consumes public sales/shop contracts when extracted |
| LINE workflows | Commands/replies/session/journeys; calls business use cases, never exports tokens or persistence details |
| Workspace | Home/breadcrumb/navigation; Sales owns its menu shell; global Next layout remains app-owned |

[Migration map](migration-map.md) records actual completed ownership and intentionally retained compatibility. Workspace/Next shell remains app-owned. Legacy business paths contain named forwards or identity bindings; concrete bridge functions now live in composition. Inventory owns movement schemas/quantity decisions, LINE owns sessions/journeys and external transport has root owners. All canonical adapters keep row/range mapping out of application ports.

The aggregate Sheets service remains a single composition object with its original constructor/health-check behavior. Its pure full-service declarations live in root `infrastructure/persistence/google-sheets/service-contracts.ts`; generic row types remain in `types.ts`. The former external indexes have no production replacements mixing transport and worksheets. Import concrete owners or named composition entrypoints. Do not move feature registry construction into root infrastructure.


## PostgreSQL migration ownership

`modules/<feature>/infrastructure/postgres/tables.ts` binds only that feature's
operational tables and existing headers to shared PostgreSQL transport. Existing
feature-owned port mappers remain the single mapping/calculation implementation.
The range-compatible projection stays in infrastructure; it is not a new domain
port or a parallel business service. `composition/postgres` owns the aggregate and
request transaction/auth/idempotency wrapper. The LINE module owns per-event
workflow execution/reply capture; shared transport only records/sends an effect
attempt. Operational schemas and offline promotion/profile tools live under
`supabase/migrations` and `tools/migration`. Immutable staging and mutable business
state have separate schemas and privileges. Runtime selection is opt-in staging;
Google Sheets production defaults and Drive image ownership remain.

`tools/migration` also owns explicit operator-only staging plans, private acceptance
reports, offline invocation of existing business readers, consistent logical backup
and restore evidence. These tools do not become runtime services or application
ports. Database tools require private PGSERVICE configuration; plugin identity is
not borrowed. Only synthetic fixture wrappers select disposable local databases.
