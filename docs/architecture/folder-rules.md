# Folder ownership

These are target rules. Existing `services`, `externals`, and `features` remain legacy locations until explicitly migrated. Tests and documentation added in Phase 1 are not production module scaffolding.

| Location | Owns | Must not own |
| --- | --- | --- |
| `app/**/page.tsx`, `layout.tsx`, `loading.tsx` | Routing, metadata, route params, composition, Next-required loading/layout boundaries | Business algorithms, feature HTTP clients, reusable feature components |
| `app/api/**/route.ts` | HTTP parsing, validation/translation of transport inputs, status/response mapping, construction/injection of server dependencies | Worksheet mapping, business calculations, duplicated workflow rules |
| `app/globals.css`, route assets | Global style/reset, Next special assets | Feature CSS that can accompany a moved component |
| `modules/<feature>/domain` | Models, value rules, deterministic calculations | React/Next, SDKs, env, clocks/random/IO without explicit inputs, storage schemas |
| `modules/<feature>/application` | Use cases, orchestration, consumer-owned persistence/file/external ports, public server functions | Concrete adapters, fetch to providers, JSX, transport row formats |
| `modules/<feature>/infrastructure` | Feature repository implementations, worksheet headers/row mapping, external-response mapping | Generic provider transport/auth duplicated per feature, React |
| `modules/<feature>/ui` | Components, hooks, co-located CSS, browser API clients, UI formatting/PDF generation | Env access, adapter/SDK/server imports, direct provider calls |
| `infrastructure/persistence/google-sheets` | Sheets HTTP client, base worksheet operations, shared Google credential plumbing under `google-auth/` | Payroll/order/stock rules or aggregate feature service registry |
| `infrastructure/external/line`, `loyverse` | Provider HTTP/signature clients and protocol DTOs | Journey decisions, financial calculations, UI |
| `infrastructure/files/google-drive` | Drive operations and file protocol mapping | Order/movement policy; depends on shared Google auth transport, not vice versa |
| `shared/ui` | UI with no business feature knowledge, only after proven reuse | Home/navigation or generic-looking employee/order components |
| `shared/lib` | Generic, small utilities, explicit `.server` ownership for Node utilities | Domain-specific date/quantity/status logic, config, feature aggregation |
| `shared/types` | Cross-cutting value contracts with no business owner | A central store for all feature DTOs, provider/worksheet types |
| `config` | Server environment parsing and config types | UI access, feature rules, changing env names during moves |
| `src/scripts` | Explicit operational entrypoints (rich-menu setup remains opt-in) | Code run automatically in lint/tests/build; moving scripts without a separate script verification plan |
| `tests` | Synthetic fixtures, offline characterization and route-contract tests | Production data, credentials, automatic snapshot approval |

Module ownership:

| Module | Current responsibility | Important boundary |
| --- | --- | --- |
| `orders` | Draft/create/update/list orders, bills, item quantities/codes and images | LINE journey state belongs to `line-workflows`; order mutation belongs here |
| `shipments` | Shipment creation/status and order links | Reads orders through a contract; does not own order persistence |
| `inventory` | Movements, delivery, monthly stock counts, reversals/adjustments | Movement domain records belong here; LINE movement journey belongs to `line-workflows` |
| `sales` | Loyverse synchronization, stored receipts, reports, cost overrides | Protocol client is root infrastructure; calculations/report contracts are feature-owned |
| `expenses` | Expenses, categories, shop master | Remains shop master owner until a separate domain decision; do not move shops into workspace speculatively |
| `hr` | Employees, compensation, attendance, advance recovery and settlements | Consumes sales/shop contracts; finance semantics stay unchanged |
| `line-workflows` | LINE classification/commands/replies, user sessions, order and movement journeys | Calls order/inventory use cases; never exports provider tokens or business persistence details |
| `workspace` | Home menu, app breadcrumb/navigation, sales menu shell owned by sales | No tenant/auth model yet; global Next layout stays in app |

Public files may be added only with real consumers: `contracts.ts` for browser-safe DTOs/constants, `server.ts` for named server use cases, `ui/<Component>.tsx` for UI. Avoid `index.ts` exposing all layers. Feature-owned contracts stay with their feature rather than migrating to `shared/types` solely because another feature consumes them.

Mixed files in the migration map require a later split, not an immediate whole-file relocation. For example, payroll calculation currently mixes pure rules and IO; pure deduction logic may become domain code only after it has no infrastructure imports. The central `GoogleSheetsService` is a temporary legacy composition facade: split feature adapters before retiring it.

PR 2 creates only `modules/orders/contracts.ts`: self-contained public DTOs and enum values with real UI consumers. It creates no empty domain/application/infrastructure/ui folders. Existing Orders files stay in place with narrow compatibility type/enum exports until their implementation migrates.

PR 3 implements `modules/orders/ui`: components, create/detail screens, the browser HTTP client, formatter and CSS modules. Only the four Next Orders routing/loading files remain in `app/orders`. Shipments consumes the explicit public `ui/OrderImageGallery.tsx` entrypoint; it is feature-owned UI, not a generic shared component. No empty domain/application/infrastructure directories are introduced.
