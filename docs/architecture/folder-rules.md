# Folder ownership

Apply these rules to new and migrated code. `services` and backend feature leaves retain reviewed compatibility surfaces. `src/externals/` is retired and must not be recreated. Do not scaffold empty layers or blindly move mixed files.

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
