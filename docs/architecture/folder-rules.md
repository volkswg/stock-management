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

PR 4 implements Orders `application` and `application/ports` for list/simple creation, `infrastructure/google-sheets` for their existing row mapping/read/write operations, and explicit server composition in `server.ts`. Application ports contain only business DTOs and operations. `getOrderDetail` remains legacy and reuses the common Orders row mapper; it is not a new application use case. No domain folder or speculative adapter is created. [Exact file ownership and compatibility criteria](orders-use-case-seam.md).

PR 5 creates only `modules/shipments/contracts.ts`, a named browser-safe public surface. Its temporary physical definition owner remains the pure `services/shipments/types.ts` leaf to preserve the Orders bridge and single enum identity. The two browser-consumed response aliases move from IO files into that leaf, with compatibility re-exports. The five Shipment UI/client/formatter files stay in `app/shipments`; all routes, styles and Sheets classes remain in place. Do not create empty Shipment UI/application/infrastructure/domain directories. Removal criteria and exact exports are in [Shipment contracts](shipments-contracts.md).

Shipment UI/client relocation is complete after PR 8: the seven actual components/formatter/styles/browser client live under `modules/shipments/ui`. Four app route/loading wrappers retain routing/metadata/loading ownership. `app/shipments/api.ts` is deleted with no placeholder, proxy or forwarding shim. The module HTTP client owns same-origin browser requests, accepts only erased public Shipment types, and is consumed by its two screens plus app Orders client composition. No module UI app-import exception remains. Server use cases, adapters, enum physical ownership and the full Shipments milestone remain future work.

Orders picker seam: `modules/orders/ui/[id]/shipment-picker-port.ts` owns only the consumer's three browser operations and four-field Orders shipment projection. `app/orders/[id]/OrderDetailClient.tsx` is client composition, constructs the stable adapter internally and adds no DOM. The server page retains metadata/params and passes only `orderId`. Orders UI requires and threads the port and imports no Shipment/app/legacy enum. PR 8 relocates the original Shipment client byte-for-byte to `modules/shipments/ui/api.ts` and changes only the app wrapper import; public/legacy enums, the Orders port and all component bodies stay intact. No domain/application/infrastructure layers are added.

PR 9 creates only actual Shipment creation files: `application/create-shipment.ts` and its `application/ports/created-shipment-writer.ts`, `infrastructure/google-sheets/shipment-writer.ts`, and named `server.ts` composition. The application owns PO normalization, injected clock/ID use and the business record; its writer accepts `Shipment`, not rows. The server-only adapter owns the thirteen A:M values/range while wrapping the existing worksheet. The direct legacy creation file becomes one named re-export; the existing barrel/routes remain unchanged. No domain folder, generic repository or other use-case migration is added. [Exact ownership and compatibility](shipments-create-seam.md).


PR 10 adds only `shipments/application/list-shipments.ts`, `application/ports/shipment-list-reader.ts` and `infrastructure/google-sheets/shipment-list-reader.ts`. The business snapshot port belongs to its read consumer; final filtering/association/cost/reverse/detail logic belongs to application, worksheet mapping and four-read orchestration to the server-only reader. Existing server composition gains exactly two named read operations, retaining creation unchanged. Legacy list file becomes two named compatibility re-exports; barrel/API/UI/provider files stay put. No shared mapper consolidation, domain layer or unrelated workflow extraction. [Exact ownership](shipments-read-seam.md).


PR 11 adds only Shipment `application/link-order-to-shipment.ts`, `application/ports/shipment-order-link-store.ts`, and `infrastructure/google-sheets/shipment-order-link-store.ts`. Application owns original error class/types, lazy decision order, eligibility/idempotency and record construction; its port owns business snapshot lookups and one-record append. Infrastructure privately retains raw arrays in deferred closures and owns three-read/range/row mapping. Named server composition wires only the existing service/clock/ID utility; the legacy link file narrowly forwards function/class/types. No domain directory, generic repository, eager mapping reuse or list/status/Orders projection migration. [Exact ownership and compatibility](shipments-link-seam.md).


PR 12 adds Shipment `application/update-shipment-status.ts`, `application/ports/shipment-status-store.ts` and `infrastructure/google-sheets/shipment-status-store.ts` only. Application owns fee/transition/PO/outcome/clock/updated DTO decisions; the consumer-owned port exposes workflow preparation and opaque target operations without worksheet indices/rows/raw cells. Adapter owns original M1→A2:M, findIndex/destructuring, deferred normalization, raw preserved fields and B:M mechanics. Named server composition supplies the existing service/ISO clock; direct legacy service narrowly re-exports function/result/DTO. PATCH keeps Drive upload/cleanup and HTTP validation. No generic repository/domain/provider abstraction or other migration. [Exact ownership](shipments-status-seam.md).


PR 13 adds only Shipment `application/advance-shipment-status-with-bill.ts`, `application/ports/shipment-bill-storage.ts`, `infrastructure/google-drive/shipment-bill-storage.ts`. Application owns upload/status/ID/cleanup coordination; port exposes business metadata, no file/provider/HTTP types. Infrastructure privately holds File/factory/service, original filename/Buffer conversion and cleanup logging. Named server composition builds a lazy adapter; app PATCH keeps request validation/config/Sheets composition/HTTP translation and invokes the retained failure-cleanup callback when response mapping fails. Existing Google Drive provider/auth/factory remain legacy and untouched; no generic storage framework. [Detailed ownership](shipments-drive-seam.md).


PR 14 adds Orders `application/get-order-detail.ts`, its `ports/order-detail-reader.ts` and public consumer `ports/order-detail-shipment-projection.ts`, plus own `infrastructure/google-sheets/order-detail-reader.ts`. Orders owns final assembly and Order/image/bill storage mapping. Shipment `infrastructure/google-sheets/order-detail-shipment-projection.ts` owns reverse link and nested Shipment mapping, implementing the Orders port; it does not reuse private Orders adapters. App GET composes both modules; Orders server composes only own reader plus supplied port. Legacy detail leaf is explicit compatibility composition with original exports; no duplicated business mapper. [Exact ownership](orders-detail-shipment-projection.md).


## PR 15 current enum ownership

`modules/shipments/status.ts` owns only the single pure ShipmentStatus runtime enum, with no dependencies, IO or server marker. `modules/shipments/contracts.ts` forwards it by name and retains eight erased DTO exports from `services/shipments/types.ts`. That compatibility leaf keeps all eight exact DTO declarations, imports Orders OrderStatus as a type and imports/re-exports the same physical Shipment enum directly. It must not import Shipment contracts. The unchanged legacy barrel remains server compatibility, never a browser entrypoint. No domain folder or wider DTO migration. This supersedes earlier temporary physical ownership descriptions; [history, consumers and retirement criteria](shipments-enum-ownership.md).


## PR 16 current Shipment DTO ownership

`modules/shipments/contracts.ts` physically owns the eight existing DTO aliases, imports only erased Orders OrderStatus and its own pure status leaf, and exports only ShipmentStatus at runtime. `services/shipments/types.ts` now contains only explicit named public enum/type forwards; no DTO definitions, imports or business code. `status.ts` and the legacy barrel stay byte-identical. No module/browser graph depends back on the legacy DTO leaf. This supersedes PR15's temporary DTO ownership while retaining its enum ownership. [Exact declaration inventory and removal criteria](shipments-dto-ownership.md).


## PR 19 — Google shared infrastructure

PR 19: shared Google auth/JWT, Sheets client/constants/base/types physically live under `infrastructure/persistence/google-sheets`; Drive provider/factory/protocol types under `infrastructure/files/google-drive`. Legacy externals paths are explicit named forwards. Aggregate service/configuration and feature worksheets/headers remain legacy-owned; no parallel registry. [Exact file map](google-shared-infrastructure.md).
