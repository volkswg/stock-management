# Folder ownership

Apply these rules to new and migrated code. `services`, `externals` and `features` remain legacy until individually reviewed migrations. Do not scaffold empty layers or blindly move mixed files.

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
| `infrastructure/persistence/google-sheets` | Shared Sheets client/base/row delegates/constants/types and Google auth/JWT plumbing | Feature rules, worksheet schema or aggregate feature registry |
| `infrastructure/files/google-drive` | Drive provider/factory/protocol types, using shared Google auth | Order/movement policy |
| Future `infrastructure/external/{line,loyverse}` | Provider HTTP/signature protocols after scoped migration | Journey decisions and business calculations |
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

These are responsibilities, not claims all implementation is already in modules. [Migration map](migration-map.md) records actual files. Mixed payroll, LINE session and aggregate Sheets code needs split/characterization before physical relocation. No generic repository, DI container, speculative tenant model, parallel persistence or domain scaffolding.


The movement schema prerequisite originally separated master/detail headers from LINE session state. Its physical owner is now Inventory `infrastructure/google-sheets/movement-schema.ts`; the old schema path is an identity forward. Legacy session persistence remains in `services/movements/state.ts` until the workflow extraction replaces its Inventory table access with public operations. Inventory use cases never import that session implementation.


Sales owns report contracts, applications/ports, receipt identifiers/projections, persistence adapters and named server composition. Inventory owns count, adjustment/reversal and movement use cases plus their semantic adapters. HR payroll and Inventory reconciliation consume the public Sales dashboard reader; Inventory directory composition consumes the HR public directory query. Public Inventory quantity rules replace the old LINE-owned helper. Legacy facade and aggregate composition retirement still requires the final consumer audit.

LINE user-state persistence now owns only `modules/line-workflows/infrastructure/google-sheets/user-state/{UserStateSheet.ts,const.ts}`. The original leaves are named compatibility forwards; session workflows and aggregate service/factory/indexes stay legacy. The worksheet depends only on root BaseGoogleSheet, erased generic types, the range helper and its own header. This does not move LINE business services.
