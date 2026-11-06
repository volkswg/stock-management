# Dependency rules

Apply these rules to new/migrated code. Existing imports are recorded in [the audit](audit.md); do not enforce a repository-wide error flood before consumers migrate.

| Importer | Permitted | Forbidden |
| --- | --- | --- |
| `app` server entrypoint | Module public server/UI entrypoints, config, concrete adapters for wiring, shared | Feature algorithms or storage logic implemented inside routes |
| Module `domain` | Own domain, generic pure `shared/lib`/`shared/types`, documented pure external feature contracts | React, Next, app, config, infrastructure, application, UI, legacy services/externals/features, side effects |
| Module `application` | Own domain/ports, shared pure utilities, documented public contracts/use cases of another module | React/Next, app, config/env, concrete infrastructure, provider SDK/HTTP IO, UI |
| Module `infrastructure` | Own application ports/domain, root infrastructure, config types if needed, documented contracts | UI, app, another module's private adapters |
| Module `ui` | Own UI/domain browser-safe values, own/public `contracts.ts`, generic shared UI/lib, React/Next browser APIs, same-origin application HTTP endpoints | `server.ts`, application implementations, infrastructure, config, Node-only packages, legacy service barrels |
| Root infrastructure | Own transports/protocol types, generic shared utilities, config types | Modules' business rules, app, UI; feature adapter implementations live in modules |
| `shared` | Other generic shared code, compatible platform libraries | Any modules, app, infrastructure, config, legacy feature/service/externals paths |
| `config` | Generic shared parsers/types | Modules/app/infrastructure; remove its current legacy `isRecord` dependency only in a scoped PR |

These rules apply to aliases (`@/`, `@/feature/`), relative imports, re-exports, dynamic imports, and type imports. Type-only imports cannot leak credential values, but a domain type depending on worksheet infrastructure still violates ownership. Review the full transitive client graph, not just files with `"use client"`.

Examples of intended imports (paths are illustrative; do not create empty files):

```ts
// modules/hr/application/calculatePayroll.ts
import type { PayrollRepository } from "./ports/PayrollRepository";
import { allocateDeductions } from "../domain/allocateDeductions";
// modules/hr/infrastructure/google-sheets/PayrollRepository.ts
import type { PayrollRepository } from "../../application/ports/PayrollRepository";
// modules/inventory/application/stockSummary.ts
import type { SalesDashboard } from "@/modules/sales/contracts";
```

Forbidden examples: UI importing `@/config`; domain importing `@/infrastructure/persistence/...`; application constructing `GoogleSheetsClient`; HR importing `sales/infrastructure/...`; generic shared code importing `orders/contracts`; modules importing `app/orders/api`.

## Public contract registry

The following are proposed boundaries identified from current imports, not new runtime APIs. A migration PR must define exact exported names, input/output shapes, error semantics, runtime safety, and tests before routing a consumer through one. Preserve legacy shapes through adapters where needed. Avoid circular module-level dependencies even if file imports happen to be acyclic.

| Provider | Consumers | Proposed public contract | Exposure |
| --- | --- | --- | --- |
| `orders` | `shipments`, `line-workflows`, app | Order lookup/link eligibility DTOs and order mutation use cases | Browser-safe DTOs/constants in `contracts.ts`; named use cases in `server.ts` |
| `inventory` | `line-workflows`, app | Movement commands, item/delivery records | DTOs in contracts; persistence-backed commands server-only |
| `sales` | `inventory`, `hr`, app | Date/shop sales dashboard and receipt/report DTOs | DTOs in contracts; query use case server-only |
| `expenses` | `hr`, `sales`, app | Shop identity/active status and expense report values | DTOs in contracts; shop/expense query server-only |
| `hr` | app; inventory employee picker through composition | Employee picker DTO/query, attendance, payroll and advance operations | No payroll/compensation internals in generic shared types |
| `line-workflows` | LINE webhook composition only | Event handler and session orchestration | Server-only; providers do not import journey state |
| `workspace` | app | Home/breadcrumb components | UI only; no business orchestration |

Inventory currently reads employee worksheet headers directly. Replace that later with an injected employee-directory port wired to HR's public query at composition, rather than adding reverse HR → inventory imports. Sales currently consumes expense types; HR consumes both sales and expenses. Keep this direction when extracting contracts. Orders' LINE session helpers must leave order core before introducing line-workflows → orders server calls, to avoid a reverse dependency.

Orders and shipments currently reference each other's feature code, although there is no value-import file cycle. Keep shipments → orders as the target module direction. Order detail needs a shipment projection: define that query/result as an orders-owned port, inject a shipment query adapter at app composition, and preserve the existing nested response shape. Do not import shipments' private row mapper or add an orders → shipments module import. Likewise, inventory currently imports quantity parsing from LINE workflow helpers; the pure parser belongs to inventory and LINE consumes its public contract. These choices eliminate module-level cycles rather than merely hiding them behind barrels.

Interfaces should describe business operations, such as loading an employee's attendance for a month. Avoid a generic `Repository<T>` or a port that simply renames `readRows("A:M")`. Tests use in-memory fakes. Runtime validation/HTTP error translation stays at route boundaries; invariants remain in the domain/application layer. Add explicit `server-only` guards to migrated server entrypoints when that migration establishes a testable browser/server boundary; do not bulk-edit existing modules in Phase 1.

Every newly exported cross-module surface must be listed here. Breaking a contract requires its own behavior-changing scope, not just a directory move. Cycle detection must examine runtime and type-only edges; a barrel can create a cycle or expand a browser bundle even when an individual import looks harmless.

Implemented Orders surface (PR 2): `modules/orders/contracts.ts` exports `OrderStatus`, `OrderItemQuantityType`, `OrderListItem`, `OrderDetail`, `OrderProductImage`, `OrderBillImage`, `CreatedOrder`, `OrderProductUpdate`, `UpdatedOrderProduct`, `ReplacedOrderProductImage`, and `OrderShipment`. The first two are runtime enums; all others are DTO types. Named consumers and the one pure legacy shipment bridge are documented in [Orders contracts](orders-contracts.md). Legacy services retain compatibility for existing server/LINE callers; the current named server surface for list/simple creation is described below.

Implemented UI entrypoints (PR 3): app's Orders route wrappers import `ui/OrderListPage`, `ui/create/OrderCreatePage`, `ui/[id]/OrderDetailPage`, and the loading CSS. Shipments list/mobile/detail consume `ui/OrderImageGallery` (and its `OrderGalleryImage` type if needed) through this documented public UI file. Internal Orders UI imports its own `ui/api.ts`; never import the retired `app/orders/api` or legacy frontend tree. No UI barrel is created.

Orders browser picker exceptions are removed by the [Orders-owned picker seam](orders-shipment-picker.md). No Orders module UI may import `app/shipments/api`, the pure legacy enum leaf, or any Shipment module implementation/contract, even type-only or through helpers. `OrderDetailPage` requires an Orders-owned picker port; client-side app composition supplies its implementation. App can import both feature public surfaces; features cannot import that composition file. The server page passes only `orderId`, never function-valued ports across RSC serialization.

Implemented server surface (PR 4): `modules/orders/server.ts` exposes only named `listOrders` and `createOrder`, guarded by `server-only`. Existing API/image callers reach them through legacy compatibility re-exports. It accepts the existing Sheets service at composition, wires narrow adapters, and supplies the original clock/sortable ID generator. It exports no UI or broad service barrel.

Consumer-owned ports: `OrderListReader.readOrderList()` returns a fresh mapped `OrderListItem[]` in persistence order; `CreatedOrderWriter.appendCreatedOrder()` accepts `CreatedOrder` and returns `Promise<void>`. Only application ports/contracts are allowed in the new application layer. No ranges, headers, Google row types, config, provider implementations or Date/ID IO enter those files. Feature adapters implement the ports using existing Sheets interfaces and explicit constants.

Temporary internal Orders bridges: the legacy detail service imports the common feature row mapper to avoid duplication; server composition imports only the existing sortable-ID utility from legacy services. Neither bridge points from application to legacy/infrastructure. Removal criteria and exact consumers are documented in [Orders use-case seam](orders-use-case-seam.md).

Implemented Shipment surface (PR 5 first slice): `modules/shipments/contracts.ts` exports runtime `ShipmentStatus` and DTOs `Shipment`, `ShipmentListItem`, `ShipmentRelatedOrder`, `ShipmentRelatedProductImage`, `ShipmentQuantityCost`, `ShipmentCostSummary`, `ShipmentStatusUpdate`, `ShipmentOrder`. Consumers are the five Shipment frontend/client/formatter files listed in [Shipment contracts](shipments-contracts.md). They must not import any legacy service path, even type-only. The exact public contract may forward only the pure `services/shipments/types.ts` leaf, which may import only Orders contracts. No mixed server barrel or implementation is reachable from either browser graph, including type-only edges.

Temporary physical ownership exception: keep the original enum and DTO definitions in that restricted leaf; Orders browser imports have been removed, but physical enum transfer and remaining legacy server projection work are outside this seam. Never duplicate the enum or add an Orders module import of Shipment contracts. Shipments consumes Orders contracts/gallery; Orders' existing legacy service/detail projection debt remains for a separately scoped decoupling PR. The browser picker now uses its consumer-owned port wired in app client composition. Remove the remaining legacy server projection coupling separately before retiring old definitions/exports. Runtime/type-only file graphs are checked; this does not claim the existing semantic cross-feature coupling is resolved. That contract/UI slice introduced no Shipment application/server/adapters; PR 9 now adds only the creation seam documented below.

Shipment UI/client relocation (completed PR 8): all seven presentation/formatter/style/client files now live under `modules/shipments/ui`. Shipment list/detail import their own `./api` / `../api`; no module UI file may import app implementations. The client may import only erased types from its public Shipment contract and may use browser fetch; it must not forward other clients or import components/server/provider/config implementations. The old app file is deleted with no shim. Orders feature UI remains independent of Shipment/app implementations; only its app client composition consumes the named module HTTP entrypoint.

Ownership gate after the picker seam: collapsing app/legacy intermediaries yields Shipments → Orders in both runtime and type-only browser module graphs. The former reverse Orders detail → app client → Shipment contracts trace is gone; it must not be reintroduced. File graphs are acyclic and app composition depends on both modules without a reverse feature import. PR 8 completes that client move and removes both Shipment app-client exceptions. No runtime or erased reverse exception remains. Server projection and enum ownership debt remain. [Exact interface, consumers and verification](orders-shipment-picker.md).

New public UI contract: `modules/orders/ui/[id]/shipment-picker-port.ts` exports `PickerShipment` (the four picker fields from Orders-owned `OrderShipment`) and `OrderShipmentPickerPort` with `listLinkableShipments`, `createShipmentMaster`, `linkOrderToShipment`. Its only dependency is Orders contracts. Consumer/implementation: `app/orders/[id]/OrderDetailClient.tsx`, which wires `modules/shipments/ui/api.ts` and the unchanged public Shipment enum. All excluded statuses, response validation and HTTP behavior remain in the existing implementation/composition, never in the consumer-owned port.

Public browser HTTP entrypoint (PR 8): `modules/shipments/ui/api.ts` exports exactly `getShipments`, `getShipment`, `advanceShipmentStatus`, `createShipmentMaster`, `linkOrderToShipment`, plus existing types `ShipmentsResponse`, `CreateShipmentInput`, `ShipmentResponse`, `ShipmentDetailResponse`, `UpdateShipmentStatusResponse`, `AdvanceShipmentStatusInput`, `LinkOrderToShipmentResponse`. Named consumers are its own list/detail screens and `app/orders/[id]/OrderDetailClient.tsx` composition. Orders module UI must never import it, directly, via type imports, or through forwarding helpers. Its original absolute type import, private guards, HTTP behavior and bytes are unchanged from the former app implementation. No broad barrel/public surface is added.

Shipment server surface (PRs 9–12): `modules/shipments/server.ts` exposes only named `createShipment`, `listShipments`, `getShipmentDetail`, `linkOrderToShipment` and `updateShipmentStatus`, guarded by server-only. It preserves the legacy parameter shape and composes the application with a lazy `GoogleSheetsShipmentWriter`, existing Date ISO clock and unchanged sortable ID utility. Only `services/shipments/createShipment.ts` forwards this operation; `services/shipments/index.ts` and its collection POST consumer stay byte-identical. Never import this server entrypoint into browser graphs or forward unrelated server operations through it. The list/detail facade forwards the two explicit reads while the legacy barrel and API handlers remain unchanged.

Consumer-owned creation port: `CreatedShipmentWriter.appendCreatedShipment(shipment: Shipment): Promise<void>`, beside `application/create-shipment.ts`. Application may import only its own public contracts and port; no worksheet/interface/range, config/provider/framework, direct Date/random/env or infrastructure dependency. Adapter/server use the pure existing Sheets interface type file and explicit header/range constants; no provider implementation/config is evaluated at construction. The only legacy implementation dependency is server composition's original `services/utils/createSortableId`; physical utility migration is future work. Runtime/type-only graphs remain acyclic; contracts still reach only Orders contracts through the pure legacy enum leaf, never a reverse Orders → Shipments edge. [Exact composition, mapper, fingerprints and removal criteria](shipments-create-seam.md).


PR 10 read port: `ShipmentListReader.readShipmentList({ includeOrders }): Promise<ShipmentReadModel>` returns ordered normalized Shipment records without final relations/costs, a readonly Shipment→ordered Order ID map and readonly valid related-Order map with images. Application owns exclusions/association/costs/reversal/detail lookup; adapter owns four conditional concurrent worksheet reads and original row decoding. It may import Orders public `OrderStatus`/types only, not Orders private infrastructure/services. Read-specific allowlists do not expand creation application/writer permissions. No browser import of this port/application/adapter/server is allowed. Direct/barrel/server function identity and the single legacy ShipmentStatus object remain intact. Runtime/type-only direction remains Shipments → Orders; Orders legacy detail projection is unchanged debt. [Exact interfaces, mapping and removal criteria](shipments-read-seam.md).


PR 11 linking port: `ShipmentOrderLinkStore.readLinkSnapshot()` returns deferred business lookups (`findActiveShipment`, `hasActiveOrder`, `findLatestActiveLink`) and `appendShipmentOrder(ShipmentOrder)` writes one business record. Candidate `readStatus()` is deliberately deferred past existing-link handling. Raw rows stay private inside the adapter; application owns error/eligibility/idempotency/record orchestration. It imports only own public contracts and port; adapter permits only erased pure Sheets types, original explicit range/link-header constants, own contracts/port and server-only. Error class/result/code types are application-owned and narrowly forwarded by the legacy direct facade, preserving barrel/HTTP instanceof identity; no browser error contract is added. Existing server functions and original creation/read scopes remain unchanged apart from exact link composition imports. [Exact exports, lazy precedence, tests and removal criteria](shipments-link-seam.md).


PR 12 status port: `ShipmentStatusStore.prepareStatusUpdate(shipmentId)` performs original setup and returns an opaque `ShipmentStatusTarget | undefined`. Target accessors expose only deferred normalized status/PO/fee/timestamp/URL business values; `saveStatusUpdate(ShipmentStatusUpdate)` persists the update. Raw cells, row position and ranges stay private in the adapter. Application owns fee precheck, transitions/PO/clock/conditional-field decisions and original result union. Its only imports are own contracts/port. Adapter permits only server-only, erased pure Sheets interface, own contracts/port. Earlier creation/read/link scopes remain unchanged; server gains two exact composition imports. Legacy status facade forwards function/result/DTO, preserving direct/barrel/server identity. Drive remains in the byte-identical PATCH handler. [Exact method order, historical evidence and limits](shipments-status-seam.md).


PR 13 bill workflow: application imports only its own bill port and the existing status result as an erased type. It receives an injected status operation; no File/Buffer/provider/config/HTTP types. The port exposes lazy upload/unavailable/raw id+webViewLink metadata and best-effort cleanup only. Server composition privately binds validated File/trimmed ID/lazy existing Drive factory to the guarded adapter. Adapter permits only own port and erased existing Drive interfaces, whose auth type leaf is pure. Named server `advanceShipmentStatusWithBill` returns an internal completion plus application-owned cleanup callback to preserve later response-construction failures; this is not a browser DTO. PATCH keeps original validation, config→Sheets construction, late status callback and response/log mapping. Earlier status/creation/read/link functions and browser boundaries are unchanged. [Exact contract, callers and removal criteria](shipments-drive-seam.md).


PR 14 Orders detail: public consumer contract `orders/application/ports/order-detail-shipment-projection.ts` exports OrderShipmentLinks, OrderShipmentCandidates and OrderDetailShipmentProjectionReader, using only Orders OrderShipment. Its consumer is Orders detail; implementation is the exact Shipment-owned `infrastructure/google-sheets/order-detail-shipment-projection.ts`, wired by app GET. Orders server/application import no Shipment module, including types. Own OrderDetailReader supplies three independent deferred business reads; projection supplies two, enabling the original flat five-read sequence. The explicit legacy `services/orders/listOrders.ts` compatibility composition may construct the same adapter outside Orders module ownership; module code may not import that facade to bypass direction. Named server detail requires an injected port, old direct/barrel signature remains unchanged. No Orders-private mapper is imported by Shipments; exact converter bodies remain locally owned. [Interfaces, graphs and removal criteria](orders-detail-shipment-projection.md).


## PR 15 current Shipment enum graph

The physical enum leaf is now `modules/shipments/status.ts` and permits no dependencies or other executable declarations. Public Shipment contracts forward only that runtime enum plus the eight existing erased DTO names from the pure legacy leaf. Legacy `services/shipments/types.ts` imports only the physical status leaf and erased Orders OrderStatus; it must never import Shipment contracts. This removes the former runtime contract → legacy edge while retaining the acyclic erased DTO forwarding. No Orders module may import the new leaf, including types/relative/re-export paths. Existing Shipment application/server scopes continue using public contracts; only existing compatibility forwarding uses the physical leaf. Runtime/type ownership stays Shipments → Orders. Eight legacy DTO declarations and the mixed service barrel remain; [exact graph and removal criteria](shipments-enum-ownership.md). Historical ownership exceptions below record earlier PR states, not current physical enum ownership.


## PR 16 current DTO forwarding direction

Public Shipment contracts no longer depend on legacy types, even through erased edges. Their only dependencies are runtime `./status` and erased Orders OrderStatus; they physically own all eight existing DTO declarations. The legacy DTO leaf may forward only the exact public enum and eight erased DTOs from Shipment contracts, with no back edge. This is now safe because public → legacy forwarding is removed. Orders modules still import no Shipment contract/enum/implementation, including types; existing consumer-owned seams remain intact. Both graphs stay acyclic and ownership Shipments → Orders. Legacy leaf/barrel retirement remains separately scoped. [Full graph and historical transformations](shipments-dto-ownership.md).


## PR 18 Shipment HTTP public entrypoints

All three Shipment routes import operations/error identity only from guarded modules/shipments/server.ts and runtime status only from public contracts.ts. Server now additionally names the existing application LinkOrderToShipmentError through an existing named import/local export; class physical ownership stays in application, never browser contracts. Its identity is shared with legacy direct/barrel and HTTP instanceof checks. Six existing server operations and all legacy exports remain unchanged. No new feature edge or browser exception; no production mixed-barrel consumer remains. Retire old paths only in a separate compatibility review. [Scope, graph and source history](shipments-http-boundary.md).


## PR 19 — Google shared infrastructure

PR 19 root Google transports import only their own explicit transport dependencies; Drive uses root shared auth, never legacy externals or feature implementations. The Drive factory retains only erased AppConfig; its pre-existing config/pure-helper type trace is documented. Feature adapters and consumers retain their existing paths through named forwards. Runtime/type graphs are acyclic and browser graphs exclude transports. [Rules and evidence](google-shared-infrastructure.md).


## Orders pure Sheet type-import prerequisite

Orders server, row mapper, writer and list reader now import erased Sheet contracts only from the pure `externals/google/sheet/types.ts` leaf. Their mixed-index import exception is removed in four exact lint scopes. That leaf forwards only pure generic root types and contains aggregate interface declarations, not worksheet/provider implementations. The current and virtual worksheet ownership graphs remain Shipments → Orders. [Exact consumers and history](orders-sheet-type-imports.md).


## PR 21 — Orders and Shipments worksheet ownership

Physical Orders/Shipment worksheets import only root Google base/types/constants and their own local headers. Existing consumers/registry retain old paths through named forwards. PR20 pure Sheet type imports remain unchanged; the real post-move graph preserves Shipments → Orders with no reverse erased edge. Legacy aggregate composition may depend on both modules; feature modules do not import it. [Identity, actual graph and negative regression](orders-shipments-worksheet-ownership.md).
