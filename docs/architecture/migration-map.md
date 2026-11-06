# Proposed file destinations

This is a planning inventory of every current src file at the audited base. **No file listed here is moved in Phase 1.** Destination paths express ownership, not instructions for a blind rename. A “split” row needs characterization, contract extraction and consumer migration first. Existing route filenames/URLs remain in app even when implementation delegates to a module. Do not create destination directories until actual code is migrated. Feature subfolders may be introduced to avoid collisions.

Root files: package.json, yarn.lock, tsconfig.json, eslint.config.mjs, next.config.ts, next-env.d.ts and .env.example remain at root; preserve env and dependency names. public assets and existing workflow docs stay in place. Root config changes must be separately reviewed.

## PR 18 — Shipment HTTP boundary implemented

Three Shipment API route files keep their paths and every non-import byte; operations now import module server and status imports module contracts. Module server names the original application LinkOrderToShipmentError through its existing import and a local export. No new class or legacy deletion. Source-only legacy audit now finds only the unchanged barrel's internal leaf forwards, with no production barrel consumer. [Exact files, historical source restoration and remaining compatibility](shipments-http-boundary.md).

## PR 17 — Shipment validation contract import implemented

`src/features/backend/shipments/utils.ts` stays in place. Its only production change replaces the mixed legacy Shipment barrel import with the public ShipmentStatus contract import. All four declarations and all other production bytes remain unchanged. The three Shipment HTTP routes still consume the legacy barrel and remain deferred with facade retirement, Orders cleanup and provider/SaaS work. [Exact history, graph and verification](shipments-validation-import.md).

## PR 16 — Shipment DTO physical ownership implemented

| Original owner / surface | Current owner / compatibility |
| --- | --- |
| Eight aliases in `src/services/shipments/types.ts` | Verbatim declarations now in `src/modules/shipments/contracts.ts`; original order/AST hashes retained |
| `src/services/shipments/types.ts` | Pure named public enum/eight erased DTO forwards; original path remains |
| `src/modules/shipments/status.ts`, legacy index and all other production source | Byte-identical; no new production file, caller import rewrite or service migration |

This table supersedes temporary physical DTO ownership proposals below. The public contract no longer reaches legacy types; [exact consumers, graph, history and retirement criteria](shipments-dto-ownership.md). Only DTO ownership is complete.

## PR 15 — physical ShipmentStatus ownership implemented

| Original / current file | Implemented ownership / remaining work |
| --- | --- |
| `src/services/shipments/types.ts:ShipmentStatus` | Exact original enum declaration moves to `src/modules/shipments/status.ts`; legacy named import/re-export preserves identity |
| `src/modules/shipments/contracts.ts` | Runtime enum forwards from `./status`; eight type-only DTO forwards unchanged |
| Eight DTO declarations in `src/services/shipments/types.ts` | Stay byte-equivalent AST declarations in place; no DTO move or barrel retirement |
| All other production source files | Byte-identical, including Orders projection/picker and all applications/adapters/routes/clients/providers |

Current table supersedes prior temporary enum ownership proposals below. [Source/AST/runtime/graph evidence and future cleanup](shipments-enum-ownership.md).

## PR 14 — Orders detail Shipment projection implemented

| Existing / new file | Ownership / compatibility |
| --- | --- |
| `src/services/orders/listOrders.ts` | Legacy detail wrapper composes injected port; original input/DTO/list exports remain, mapping removed |
| `src/modules/orders/application/get-order-detail.ts` (new) | Flat five business reads, deferred existence/association/assembly |
| `src/modules/orders/application/ports/order-detail-reader.ts` (new) | Three independent Order/product/bill business handles |
| `src/modules/orders/application/ports/order-detail-shipment-projection.ts` (new) | Public Orders-owned link and Shipment projection query handles |
| `src/modules/orders/infrastructure/google-sheets/order-detail-reader.ts` (new) | First three original read calls, unchanged Order/product mapper and moved bill mapper |
| `src/modules/shipments/infrastructure/google-sheets/order-detail-shipment-projection.ts` (new) | Last two read calls, exact reverse-link/nested Shipment mapping and local converter parity |
| `src/modules/orders/server.ts`, `src/app/api/orders/[id]/route.ts` | Named injected detail operation and app GET composition; old create/list and HTTP PATCH/helper bodies unchanged |

Historical detail body and old raw server hash remain authoritative; no existing fixture values regenerated. [Five-read/error parity, dependency direction and deferred cleanup](orders-detail-shipment-projection.md).

## PR 13 — Shipment shipping-bill workflow seam implemented

| Existing / new file | Ownership and retained compatibility |
| --- | --- |
| `src/app/api/shipments/[id]/route.ts` | Delegates only upload/status/cleanup; GET/parsing/validation/constants and HTTP mappings remain; two helpers move unchanged |
| `src/modules/shipments/application/advance-shipment-status-with-bill.ts` (new) | Upload coordination, raw metadata ID→URL order, one injected status call, cleanup state and internal completion |
| `src/modules/shipments/application/ports/shipment-bill-storage.ts` (new) | Business metadata/upload-unavailable/cleanup capability, no File/Buffer/provider/HTTP types |
| `src/modules/shipments/infrastructure/google-drive/shipment-bill-storage.ts` (new) | Lazy existing Drive adapter, original filename/upload/Buffer evaluation and best-effort cleanup helpers |
| `src/modules/shipments/server.ts` | One explicit bill composition; five existing function declarations unchanged |
| Existing status seam, all providers/auth/factories/contracts/UI/other services | Byte-identical, no replacement or move |

Exactly one old raw-route hash has explicit historical handling, with complete original source and unchanged/moved helper AST comparisons. All original fixtures remain intact. [Operation order, compatibility and evidence](shipments-drive-seam.md). Full milestone remains incomplete.

## PR 12 — Shipment status-update seam implemented

| Existing / new file | Ownership and compatibility |
| --- | --- |
| `src/services/shipments/updateShipmentStatus.ts` | Narrow function re-export from server, result type from application, ShipmentStatusUpdate from contracts |
| `src/modules/shipments/application/update-shipment-status.ts` (new) | Original fee/transition/PO checks, clock/conditional field decisions, outcome union and returned DTO |
| `src/modules/shipments/application/ports/shipment-status-store.ts` (new) | Business preparation and opaque target; normalized accessors plus one business DTO save, no worksheet/raw types |
| `src/modules/shipments/infrastructure/google-sheets/shipment-status-store.ts` (new) | Lazy existing-service wrapper, exact header/read/first-active selection/destructuring, preserved raw cells and twelve-value B:M write |
| `src/modules/shipments/server.ts` | Adds one named status composition; original create/list/detail/link functions unchanged |
| Legacy barrel, PATCH/Drive, contracts/UI/client/Orders projection/providers | Byte-identical; original paths/behavior retained |

Exactly three status hashes retain history: transition/number helpers match new destinations, orchestration has explicit original-source/behavior parity handling. Earlier history exceptions remain active. [Port, ordering, DTO/HTTP evidence and remaining debt](shipments-status-seam.md). Only this status slice is complete.

## PR 11 — Shipment order-linking seam implemented

| Existing / new file | Ownership and compatibility |
| --- | --- |
| `src/services/shipments/linkOrderToShipment.ts` | Narrow named function re-export from server; class/result/code from application, ShipmentOrder type from contracts |
| `src/modules/shipments/application/link-order-to-shipment.ts` (new) | Original error class/types, lookup/error order, eligibility/idempotency, injected clock/ID and record/await behavior |
| `src/modules/shipments/application/ports/shipment-order-link-store.ts` (new) | Business snapshot lookups with deferred candidate status, plus single ShipmentOrder append |
| `src/modules/shipments/infrastructure/google-sheets/shipment-order-link-store.ts` (new) | Lazy existing-service wrapper, original three concurrent reads, private row closures, four unchanged helpers and seven-value A:G mapping |
| `src/modules/shipments/server.ts` | Adds one named link composition; original create/list/detail declarations unchanged |
| Legacy barrel/API, creation/read/status, Orders projection, UI/client/providers/contracts | Byte-identical; no relocation or behavior changes |

Exactly five old link hashes stay recorded: four helpers match at new destinations, orchestration has explicit original-source and executable parity checks. Earlier creation/read exceptions remain active. [Port, error identity, precedence, evidence and remaining scopes](shipments-link-seam.md). Only linking is complete; full milestone remains incomplete.

## PR 10 — Shipment list/detail read seam implemented

| Existing / new file | Ownership and retained compatibility |
| --- | --- |
| `src/services/shipments/listShipments.ts` | Exactly two named read re-exports from `modules/shipments/server`; direct/barrel identity retained |
| `src/modules/shipments/application/list-shipments.ts` (new) | Final filtering, relation assembly, unchanged pure costs, reversal and full-list detail lookup |
| `src/modules/shipments/application/ports/shipment-list-reader.ts` (new) | `ShipmentListReader` and business-only `ShipmentReadModel`, readonly sequences/maps |
| `src/modules/shipments/infrastructure/google-sheets/shipment-list-reader.ts` (new) | Lazy existing-service reader, four concurrent conditional reads and eight unchanged mapping/grouping helpers |
| `src/modules/shipments/server.ts` | Adds only named list/detail composition; original creation declaration/body unchanged |
| Legacy barrel, APIs, Orders detail, creation/link/status/provider/UI/client/contracts | Byte-identical; remain at existing locations |

The original thirteen read function hashes remain in historical fixtures: eleven helpers match at exact new destinations; two orchestrations have explicit executable parity/history checks. No blanket skip or fixture regeneration. [Port, callers, tests and remaining work](shipments-read-seam.md). Only this read slice is complete.

## PR 9 — Shipment creation seam implemented

| Existing / new file | Ownership and retained compatibility |
| --- | --- |
| `src/services/shipments/createShipment.ts` | One named re-export from `modules/shipments/server`; old direct callers remain compatible |
| `src/modules/shipments/application/create-shipment.ts` (new) | Original creation validation/record/clock/ID/await behavior; explicit business input/dependencies |
| `src/modules/shipments/application/ports/created-shipment-writer.ts` (new) | Consumer-owned single-record writer, no worksheet/provider types |
| `src/modules/shipments/infrastructure/google-sheets/shipment-writer.ts` (new) | Server-only lazy wrapper, unchanged thirteen-column A:M mapping and append |
| `src/modules/shipments/server.ts` (new) | Only named creation composition using the supplied service, original Date clock and ID utility |
| `src/services/shipments/index.ts`, `src/app/api/shipments/route.ts` | Byte-identical; existing creation export/import, validation and HTTP responses retained |

The historical original source and two function hashes are preserved with explicit reviewed creation exceptions only; list/link/status/UI/client/route/contract hashes remain intact. No other services or Sheets classes move. [Detailed evidence and remaining scopes](shipments-create-seam.md).

## PR 8 — seventh Shipment UI/client move completed

| Old / consumer path | Implemented location / correction |
| --- | --- |
| `src/app/shipments/api.ts` | `src/modules/shipments/ui/api.ts`, Git-recognized byte-identical rename; old file deleted, no shim |
| `src/modules/shipments/ui/ShipmentListPage.tsx` | Import becomes `./api` only |
| `src/modules/shipments/ui/[id]/ShipmentDetailPage.tsx` | Import becomes `../api` only |
| `src/app/orders/[id]/OrderDetailClient.tsx` | Import becomes `@/modules/shipments/ui/api` only; stable adapter/Orders port unchanged |

All seven UI/client/style destinations below are now implemented. Original body/CSS/raw hashes are preserved, including the fixture's original from/to/hash history. Both Shipment app-client lint exceptions are removed, with no app imports permitted in module UI. The ownership direction remains Shipments → Orders for runtime/types; app composition consumes both modules. Full milestone, server projection, enum physical ownership and application/adapter work remain incomplete. [Final evidence and historical six-file scope](shipments-ui-relocation.md).

## Orders browser picker dependency seam — implemented

| Source / public entrypoint | Implemented responsibility / remaining work |
| --- | --- |
| `src/modules/orders/ui/[id]/shipment-picker-port.ts` (new) | Orders-owned `PickerShipment` and three-operation `OrderShipmentPickerPort`; imports Orders contracts only |
| `src/app/orders/[id]/OrderDetailClient.tsx` (new) | Client-side composition with a stable adapter delegating to the existing Shipment client; imports the public enum here only |
| `src/modules/orders/ui/[id]/OrderDetailPage.tsx` | Required injected port threaded through content/card; removes both browser client/legacy enum imports; non-picker behavior unchanged |
| `src/app/orders/[id]/page.tsx` | Import/render target becomes app client wrapper; metadata/params/orderId unchanged; no function-valued prop across RSC boundary |
| `src/app/shipments/api.ts`, Shipment contracts/enum leaf and UI | Byte-identical definitions/implementation; PR 8 relocates only the client and updates its three consumer imports, with no shim |
| Orders legacy server detail projection | Unchanged; separate consumer-owned server seam still needed |

The browser prerequisite behind PR 6's historical client blocker is now satisfied: runtime/type-only browser ownership has only Shipments → Orders. PR 8 now completes the seven-file client/UI slice. The full Shipments milestone remains incomplete. [Interface, exact graph and evidence](orders-shipment-picker.md).

## Shipments UI follow-up — six safe moves; client deferred

The [focused audit](shipments-ui-relocation.md) overrides the original proposed destinations for this slice. This table records the historical six-file step; PR 8 above completes the seventh move.

| Original path | Current implementation / status |
| --- | --- |
| `src/app/shipments/ShipmentListPage.tsx` | `src/modules/shipments/ui/ShipmentListPage.tsx` (moved) |
| `src/app/shipments/ShipmentMobileCard.tsx` | `src/modules/shipments/ui/ShipmentMobileCard.tsx` (moved) |
| `src/app/shipments/shipmentListFormat.ts` | `src/modules/shipments/ui/shipmentListFormat.ts` (moved) |
| `src/app/shipments/shipments.module.css` | `src/modules/shipments/ui/shipments.module.css` (moved, bytes unchanged) |
| `src/app/shipments/[id]/ShipmentDetailPage.tsx` | `src/modules/shipments/ui/[id]/ShipmentDetailPage.tsx` (moved) |
| `src/app/shipments/[id]/shipmentDetail.module.css` | `src/modules/shipments/ui/[id]/shipmentDetail.module.css` (moved, bytes unchanged) |
| `src/app/shipments/api.ts` | `src/modules/shipments/ui/api.ts` (moved byte-identically in PR 8) |

Four route/loading wrappers keep their locations and import module UI/CSS. Orders picker, Shipment contracts and API handlers remain unchanged. There is no forwarding compatibility entrypoint: PR 8 moves the single implementation into its module, used by Orders app composition and the two Shipment screens. The historical reverse ownership trace below has been removed by the picker seam above.

## PR 5 implemented first slice — Shipment contracts/characterization

This status table overrides the proposed destinations below only for this narrow slice. The full Shipments milestone remains incomplete; that initial status is historical; the six UI/CSS follow-up moves above are now implemented, while worksheet destinations remain future work.

| Current file | Implemented change | Remaining migration |
| --- | --- | --- |
| `src/modules/shipments/contracts.ts` (new) | Named browser-safe public forwarding of the single enum and eight actual DTOs | Transfer physical definitions only after Orders decoupling |
| `src/services/shipments/types.ts` | Keeps original enum/DTO ownership; receives `ShipmentStatusUpdate` and `ShipmentOrder` aliases unchanged | Temporary pure compatibility leaf; retire only after all callers/Orders bridges migrate |
| `src/services/shipments/updateShipmentStatus.ts` | Re-exports extracted response type; function bodies unchanged | Future status use case/adapter seam |
| `src/services/shipments/linkOrderToShipment.ts` | Re-exports extracted link DTO; function bodies unchanged | Future linking use case/adapter seam |
| `src/app/shipments/ShipmentListPage.tsx`, `ShipmentMobileCard.tsx`, `[id]/ShipmentDetailPage.tsx`, `shipmentListFormat.ts`, `api.ts` | Import source corrections to public contracts only, no moves | Separate UI/client relocation PR at the listed destinations |
| Orders detail enum/client bridges and `services/orders/listOrders.ts` detail projection | Unchanged | Consumer-owned picker/projection interfaces at app composition in dedicated decoupling slice |
| Three Shipment API handlers, legacy Shipment list/create/barrel, backend validation, all Shipment Sheets classes | Unchanged | Later server/use-case/adapter slices; retain paths/schema/HTTP behavior |

See [exports, audited consumers, tests and removal criteria](shipments-contracts.md). No empty target layers are created.

## PR 2 completed extraction

`src/modules/orders/contracts.ts` now owns the enum values and UI DTOs extracted from the files below. No implementation/UI file was relocated. Existing destinations in the inventory remain future work.

| Current source / consumer | Completed change | Remaining work |
| --- | --- | --- |
| `services/orders/createDraftOrder.ts`, `OrderItemQuantityType.ts` | Enum definitions now in Orders contracts; legacy exports reference the same objects | Draft/session business logic remains in place; migrate consumers before retiring exports |
| `services/orders/listOrders.ts` | Read/image/detail DTOs extracted; nested shipment represented by Orders-owned `OrderShipment` | Queries and mapping stay here until PR 4 |
| `services/orders/createOrder.ts`, `updateOrderProducts.ts`, `replaceOrderProductImage.ts` | UI-used result/input DTOs extracted with type compatibility exports | All write/upload implementations stay here |
| `app/orders/api.ts`, Orders detail, Orders frontend components/formatter | Import public Orders contracts | UI/client moves deferred to PR 3 |
| Shipments list/detail/formatter | OrderStatus imports now use Orders contracts | Shipments UI/contracts migration remains PR 5 |
| `services/shipments/types.ts` | Type-only OrderStatus import now uses Orders contracts | Pure temporary runtime enum bridge for Orders detail; retained after PR 5 first slice until dedicated decoupling |

Paths in this progress table are relative to `src/`. Exact public names, consumers and bridge removal criteria: [Orders contracts](orders-contracts.md).

## PR 3 implemented UI relocation

All 15 UI/client/style files below now reside at their listed destination. The old implementations and empty legacy Orders frontend directories are removed. Contracts remain unchanged; no domain/application/infrastructure layers were created. Four Next routing/loading files stay in place; the three Shipments gallery consumers now import the module UI entrypoint. The [pre-move consumer audit](orders-ui-migration.md) records each consumer and retained shipment bridge (PR 5).

| Original file | Implemented destination |
| --- | --- |
| `src/app/orders/api.ts` | `src/modules/orders/ui/api.ts` |
| `src/app/orders/create/OrderCreatePage.tsx` | `src/modules/orders/ui/create/OrderCreatePage.tsx` |
| `src/app/orders/create/orderCreate.module.css` | `src/modules/orders/ui/create/orderCreate.module.css` |
| `src/app/orders/[id]/OrderDetailPage.tsx` | `src/modules/orders/ui/[id]/OrderDetailPage.tsx` |
| `src/app/orders/[id]/orderDetail.module.css` | `src/modules/orders/ui/[id]/orderDetail.module.css` |
| `src/features/frontend/orders/components/OrderImageCard.tsx` | `src/modules/orders/ui/OrderImageCard.tsx` |
| `src/features/frontend/orders/components/OrderImageGallery.tsx` | `src/modules/orders/ui/OrderImageGallery.tsx` |
| `src/features/frontend/orders/components/OrderListPage.tsx` | `src/modules/orders/ui/OrderListPage.tsx` |
| `src/features/frontend/orders/components/OrderMobileCard.tsx` | `src/modules/orders/ui/OrderMobileCard.tsx` |
| `src/features/frontend/orders/components/OrderProductImageActions.tsx` | `src/modules/orders/ui/OrderProductImageActions.tsx` |
| `src/features/frontend/orders/components/OrderProductImageUpload.tsx` | `src/modules/orders/ui/OrderProductImageUpload.tsx` |
| `src/features/frontend/orders/components/OrderQuantityStatus.tsx` | `src/modules/orders/ui/OrderQuantityStatus.tsx` |
| `src/features/frontend/orders/components/orderListFormat.ts` | `src/modules/orders/ui/orderListFormat.ts` |
| `src/features/frontend/orders/components/orderQuantityStatus.module.css` | `src/modules/orders/ui/orderQuantityStatus.module.css` |
| `src/features/frontend/orders/components/orders.module.css` | `src/modules/orders/ui/orders.module.css` |

## PR 4 implemented initial use-case seam

Only list read and simple creation migrate. Exact ownership and caller/removal criteria are in [Orders use-case seam](orders-use-case-seam.md). Contracts, UI and all route paths remain unchanged.

| Original responsibility | Implemented destination | Compatibility retained |
| --- | --- | --- |
| `services/orders/listOrders.ts`: list execution | `modules/orders/application/list-orders.ts` + `application/ports/order-list-reader.ts` | Legacy file re-exports named server composition; `getOrderDetail` stays there |
| List reads/grouping | `modules/orders/infrastructure/google-sheets/order-list-reader.ts` | Same three ranges/Promise.all and mapped record order; final reverse remains application-owned |
| Common order/item/string/price/status mapping | `modules/orders/infrastructure/google-sheets/order-row-mapping.ts` | Legacy detail imports the same helpers; detail orchestration and detail-only mapping are unchanged |
| `services/orders/createOrder.ts`: record construction | `modules/orders/application/create-order.ts` + `application/ports/created-order-writer.ts` | Legacy direct and barrel exports keep the same parameters/CreatedOrder type |
| Creation append | `modules/orders/infrastructure/google-sheets/order-writer.ts` | Existing Orders sheet interface, header-derived range, nine values and transport mode |
| Composition | `modules/orders/server.ts` | Explicit server-only list/create functions wire adapters and unchanged clock/ID semantics |

Paths above are relative to `src/`. No image/draft/detail/shipment use case or other order mutation is extracted. No domain directory, generic repository or future provider is scaffolded.

## Original file inventory

| Original file | Destination / ownership | Migration note |
| --- | --- | --- |
| `src/app/AppBreadcrumb.tsx` | `src/modules/workspace/ui/AppBreadcrumb.tsx` | Move with home/navigation consumers. |
| `src/app/HomeMenuPage.tsx` | `src/modules/workspace/ui/HomeMenuPage.tsx` | Move with home/navigation consumers. |
| `src/app/api/employees/[id]/route.ts` | `src/app/api/employees/[id]/route.ts` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/api/employees/advances/route.ts` | `src/app/api/employees/advances/route.ts` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/api/employees/payroll/route.ts` | `src/app/api/employees/payroll/route.ts` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/api/employees/payroll/settle/route.ts` | `src/app/api/employees/payroll/settle/route.ts` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/api/employees/route.ts` | `src/app/api/employees/route.ts` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/api/employees/timesheets/[id]/route.ts` | `src/app/api/employees/timesheets/[id]/route.ts` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/api/employees/timesheets/route.ts` | `src/app/api/employees/timesheets/route.ts` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/api/employees/timesheets/summary/route.ts` | `src/app/api/employees/timesheets/summary/route.ts` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/api/expenses/masters/[kind]/route.ts` | `src/app/api/expenses/masters/[kind]/route.ts` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/api/expenses/route.ts` | `src/app/api/expenses/route.ts` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/api/line/webhook/route.ts` | `src/app/api/line/webhook/route.ts` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/api/loyverse/accounts/route.ts` | `src/app/api/loyverse/accounts/route.ts` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/api/loyverse/daily-sales/route.ts` | `src/app/api/loyverse/daily-sales/route.ts` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/api/loyverse/daily-sales/sync/route.ts` | `src/app/api/loyverse/daily-sales/sync/route.ts` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/api/movements/[id]/items/[itemId]/image/route.ts` | `src/app/api/movements/[id]/items/[itemId]/image/route.ts` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/api/movements/[id]/items/[itemId]/route.ts` | `src/app/api/movements/[id]/items/[itemId]/route.ts` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/api/movements/[id]/route.ts` | `src/app/api/movements/[id]/route.ts` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/api/movements/route.ts` | `src/app/api/movements/route.ts` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/api/orders/[id]/images/route.ts` | `src/app/api/orders/[id]/images/route.ts` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/api/orders/[id]/items/[itemId]/image/route.ts` | `src/app/api/orders/[id]/items/[itemId]/image/route.ts` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/api/orders/[id]/items/[itemId]/route.ts` | `src/app/api/orders/[id]/items/[itemId]/route.ts` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/api/orders/[id]/items/route.ts` | `src/app/api/orders/[id]/items/route.ts` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/api/orders/[id]/route.ts` | `src/app/api/orders/[id]/route.ts` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/api/orders/route.ts` | `src/app/api/orders/route.ts` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/api/orders/with-images/route.ts` | `src/app/api/orders/with-images/route.ts` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/api/sales/daily-sales/route.ts` | `src/app/api/sales/daily-sales/route.ts` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/api/sales/dashboard/route.ts` | `src/app/api/sales/dashboard/route.ts` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/api/sales/profit-summary/cost-overrides/route.ts` | `src/app/api/sales/profit-summary/cost-overrides/route.ts` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/api/sales/profit-summary/route.ts` | `src/app/api/sales/profit-summary/route.ts` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/api/sales/sync-status/route.ts` | `src/app/api/sales/sync-status/route.ts` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/api/shipments/[id]/orders/route.ts` | `src/app/api/shipments/[id]/orders/route.ts` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/api/shipments/[id]/route.ts` | `src/app/api/shipments/[id]/route.ts` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/api/shipments/route.ts` | `src/app/api/shipments/route.ts` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/api/stock-adjustments/route.ts` | `src/app/api/stock-adjustments/route.ts` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/api/stock-counts/route.ts` | `src/app/api/stock-counts/route.ts` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/employees/EmployeesPage.tsx` | `src/modules/hr/ui/EmployeesPage.tsx` | Feature UI/client/style; retain current route entrypoints. |
| `src/app/employees/advances/SalaryAdvancesPage.tsx` | `src/modules/hr/ui/advances/SalaryAdvancesPage.tsx` | Feature UI/client/style; retain current route entrypoints. |
| `src/app/employees/advances/advances.module.css` | `src/modules/hr/ui/advances/advances.module.css` | Feature UI/client/style; retain current route entrypoints. |
| `src/app/employees/advances/page.tsx` | `src/app/employees/advances/page.tsx` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/employees/employees.module.css` | `src/modules/hr/ui/employees.module.css` | Feature UI/client/style; retain current route entrypoints. |
| `src/app/employees/page.tsx` | `src/app/employees/page.tsx` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/employees/payroll/PayrollPage.tsx` | `src/modules/hr/ui/payroll/PayrollPage.tsx` | Feature UI/client/style; retain current route entrypoints. |
| `src/app/employees/payroll/page.tsx` | `src/app/employees/payroll/page.tsx` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/employees/payroll/payroll.module.css` | `src/modules/hr/ui/payroll/payroll.module.css` | Feature UI/client/style; retain current route entrypoints. |
| `src/app/employees/payroll/payrollPdf.ts` | `src/modules/hr/ui/payroll/payrollPdf.ts` | Feature UI/client/style; retain current route entrypoints. |
| `src/app/expenses/ExpenseMasterPage.tsx` | `src/modules/expenses/ui/ExpenseMasterPage.tsx` | Feature UI/client/style; retain current route entrypoints. |
| `src/app/expenses/ExpensesPage.tsx` | `src/modules/expenses/ui/ExpensesPage.tsx` | Feature UI/client/style; retain current route entrypoints. |
| `src/app/expenses/categories/page.tsx` | `src/app/expenses/categories/page.tsx` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/expenses/expenses.module.css` | `src/modules/expenses/ui/expenses.module.css` | Feature UI/client/style; retain current route entrypoints. |
| `src/app/expenses/page.tsx` | `src/app/expenses/page.tsx` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/expenses/shops/page.tsx` | `src/app/expenses/shops/page.tsx` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/globals.css` | `src/app/globals.css` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/icon.svg` | `src/app/icon.svg` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/layout.tsx` | `src/app/layout.tsx` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/loyverse/daily-sales/LoyverseDailySalesPage.tsx` | `src/modules/sales/ui/daily-sales/LoyverseDailySalesPage.tsx` | Feature UI/client/style; retain current route entrypoints. |
| `src/app/loyverse/daily-sales/loyverseDailySales.module.css` | `src/modules/sales/ui/daily-sales/loyverseDailySales.module.css` | Feature UI/client/style; retain current route entrypoints. |
| `src/app/loyverse/daily-sales/page.tsx` | `src/app/loyverse/daily-sales/page.tsx` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/movements/MovementListPage.tsx` | `src/modules/inventory/ui/MovementListPage.tsx` | Feature UI/client/style; retain current route entrypoints. |
| `src/app/movements/[id]/MovementDetailPage.tsx` | `src/modules/inventory/ui/[id]/MovementDetailPage.tsx` | Feature UI/client/style; retain current route entrypoints. |
| `src/app/movements/[id]/movementDetail.module.css` | `src/modules/inventory/ui/[id]/movementDetail.module.css` | Feature UI/client/style; retain current route entrypoints. |
| `src/app/movements/[id]/page.tsx` | `src/app/movements/[id]/page.tsx` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/movements/api.ts` | `src/modules/inventory/ui/api.ts` | Feature UI/client/style; retain current route entrypoints. |
| `src/app/movements/format.ts` | `src/modules/inventory/ui/format.ts` | Feature UI/client/style; retain current route entrypoints. |
| `src/app/movements/movements.module.css` | `src/modules/inventory/ui/movements.module.css` | Feature UI/client/style; retain current route entrypoints. |
| `src/app/movements/page.tsx` | `src/app/movements/page.tsx` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/orders/[id]/OrderDetailPage.tsx` | `src/modules/orders/ui/[id]/OrderDetailPage.tsx` | Moved in PR 3; component/client/style body preserved; imports corrected. |
| `src/app/orders/[id]/orderDetail.module.css` | `src/modules/orders/ui/[id]/orderDetail.module.css` | Moved in PR 3; component/client/style body preserved; imports corrected. |
| `src/app/orders/[id]/page.tsx` | `src/app/orders/[id]/page.tsx` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/orders/api.ts` | `src/modules/orders/ui/api.ts` | Moved in PR 3; component/client/style body preserved; imports corrected. |
| `src/app/orders/create/OrderCreatePage.tsx` | `src/modules/orders/ui/create/OrderCreatePage.tsx` | Moved in PR 3; component/client/style body preserved; imports corrected. |
| `src/app/orders/create/orderCreate.module.css` | `src/modules/orders/ui/create/orderCreate.module.css` | Moved in PR 3; component/client/style body preserved; imports corrected. |
| `src/app/orders/create/page.tsx` | `src/app/orders/create/page.tsx` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/orders/loading.tsx` | `src/app/orders/loading.tsx` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/orders/page.tsx` | `src/app/orders/page.tsx` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/page.module.css` | `src/modules/workspace/ui/page.module.css` | Move with home/navigation consumers. |
| `src/app/page.tsx` | `src/app/page.tsx` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/sales/SalesMenuPage.tsx` | `src/modules/sales/ui/SalesMenuPage.tsx` | Feature UI/client/style; retain current route entrypoints. |
| `src/app/sales/SalesSyncStatusPage.tsx` | `src/modules/sales/ui/SalesSyncStatusPage.tsx` | Feature UI/client/style; retain current route entrypoints. |
| `src/app/sales/daily-sales/SalesDailySalesPage.tsx` | `src/modules/sales/ui/daily-sales/SalesDailySalesPage.tsx` | Feature UI/client/style; retain current route entrypoints. |
| `src/app/sales/daily-sales/page.tsx` | `src/app/sales/daily-sales/page.tsx` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/sales/daily-sales/salesDailySales.module.css` | `src/modules/sales/ui/daily-sales/salesDailySales.module.css` | Feature UI/client/style; retain current route entrypoints. |
| `src/app/sales/dashboard/DesktopDateRange.tsx` | `src/modules/sales/ui/dashboard/DesktopDateRange.tsx` | Feature UI/client/style; retain current route entrypoints. |
| `src/app/sales/dashboard/MobileDateRange.tsx` | `src/modules/sales/ui/dashboard/MobileDateRange.tsx` | Feature UI/client/style; retain current route entrypoints. |
| `src/app/sales/dashboard/SalesDashboardPage.tsx` | `src/modules/sales/ui/dashboard/SalesDashboardPage.tsx` | Feature UI/client/style; retain current route entrypoints. |
| `src/app/sales/dashboard/page.tsx` | `src/app/sales/dashboard/page.tsx` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/sales/dashboard/salesDashboard.module.css` | `src/modules/sales/ui/dashboard/salesDashboard.module.css` | Feature UI/client/style; retain current route entrypoints. |
| `src/app/sales/page.tsx` | `src/app/sales/page.tsx` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/sales/profit-summary/SalesProfitSummaryPage.tsx` | `src/modules/sales/ui/profit-summary/SalesProfitSummaryPage.tsx` | Feature UI/client/style; retain current route entrypoints. |
| `src/app/sales/profit-summary/page.tsx` | `src/app/sales/profit-summary/page.tsx` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/sales/profit-summary/salesProfitSummary.module.css` | `src/modules/sales/ui/profit-summary/salesProfitSummary.module.css` | Feature UI/client/style; retain current route entrypoints. |
| `src/app/sales/salesSyncStatus.module.css` | `src/modules/sales/ui/salesSyncStatus.module.css` | Feature UI/client/style; retain current route entrypoints. |
| `src/app/sales/sync-status/page.tsx` | `src/app/sales/sync-status/page.tsx` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/shipments/ShipmentListPage.tsx` | `src/modules/shipments/ui/ShipmentListPage.tsx` | Moved in UI follow-up; body/CSS preserved, route entrypoints retained. |
| `src/app/shipments/ShipmentMobileCard.tsx` | `src/modules/shipments/ui/ShipmentMobileCard.tsx` | Moved in UI follow-up; body/CSS preserved, route entrypoints retained. |
| `src/app/shipments/[id]/ShipmentDetailPage.tsx` | `src/modules/shipments/ui/[id]/ShipmentDetailPage.tsx` | Moved in UI follow-up; body/CSS preserved, route entrypoints retained. |
| `src/app/shipments/[id]/loading.tsx` | `src/app/shipments/[id]/loading.tsx` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/shipments/[id]/page.tsx` | `src/app/shipments/[id]/page.tsx` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/shipments/[id]/shipmentDetail.module.css` | `src/modules/shipments/ui/[id]/shipmentDetail.module.css` | Moved in UI follow-up; body/CSS preserved, route entrypoints retained. |
| `src/app/shipments/api.ts` | `src/modules/shipments/ui/api.ts` (implemented PR 8) | Byte-identical move; original app path deleted without a forwarding shim. |
| `src/app/shipments/loading.tsx` | `src/app/shipments/loading.tsx` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/shipments/page.tsx` | `src/app/shipments/page.tsx` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/shipments/shipmentListFormat.ts` | `src/modules/shipments/ui/shipmentListFormat.ts` | Moved in UI follow-up; body/CSS preserved, route entrypoints retained. |
| `src/app/shipments/shipments.module.css` | `src/modules/shipments/ui/shipments.module.css` | Moved in UI follow-up; body/CSS preserved, route entrypoints retained. |
| `src/app/stock-counts/StockAdjustmentsPanel.tsx` | `src/modules/inventory/ui/StockAdjustmentsPanel.tsx` | Feature UI/client/style; retain current route entrypoints. |
| `src/app/stock-counts/StockCountsPage.tsx` | `src/modules/inventory/ui/StockCountsPage.tsx` | Feature UI/client/style; retain current route entrypoints. |
| `src/app/stock-counts/adjustments.module.css` | `src/modules/inventory/ui/adjustments.module.css` | Feature UI/client/style; retain current route entrypoints. |
| `src/app/stock-counts/page.tsx` | `src/app/stock-counts/page.tsx` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/stock-counts/stockCounts.module.css` | `src/modules/inventory/ui/stockCounts.module.css` | Feature UI/client/style; retain current route entrypoints. |
| `src/app/timesheets/TimesheetCalendarPage.tsx` | `src/modules/hr/ui/TimesheetCalendarPage.tsx` | Feature UI/client/style; retain current route entrypoints. |
| `src/app/timesheets/page.tsx` | `src/app/timesheets/page.tsx` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/timesheets/timesheetCalendar.module.css` | `src/modules/hr/ui/timesheetCalendar.module.css` | Feature UI/client/style; retain current route entrypoints. |
| `src/app/timesheets/tracker/TimesheetTrackerPage.tsx` | `src/modules/hr/ui/tracker/TimesheetTrackerPage.tsx` | Feature UI/client/style; retain current route entrypoints. |
| `src/app/timesheets/tracker/page.tsx` | `src/app/timesheets/tracker/page.tsx` | Keep Next entrypoint/asset; extract embedded feature logic later without changing routes. |
| `src/app/timesheets/tracker/timesheetTracker.module.css` | `src/modules/hr/ui/tracker/timesheetTracker.module.css` | Feature UI/client/style; retain current route entrypoints. |
| `src/config/index.ts` | `src/config/index.ts` | Keep config/env names; replace legacy helper import later. |
| `src/externals/google/auth/GoogleAccessTokenProvider.ts` | `src/infrastructure/persistence/google-sheets/google-auth/GoogleAccessTokenProvider.ts` | Implemented PR 19; old path retains named forwards to the single physical owner. |
| `src/externals/google/auth/GoogleOAuthRefreshTokenAuth.ts` | `src/infrastructure/persistence/google-sheets/google-auth/GoogleOAuthRefreshTokenAuth.ts` | Implemented PR 19; old path retains named forwards to the single physical owner. |
| `src/externals/google/auth/GoogleServiceAccountAuth.ts` | `src/infrastructure/persistence/google-sheets/google-auth/GoogleServiceAccountAuth.ts` | Implemented PR 19; old path retains named forwards to the single physical owner. |
| `src/externals/google/auth/const.ts` | `src/infrastructure/persistence/google-sheets/google-auth/const.ts` | Implemented PR 19; old path retains named forwards to the single physical owner. |
| `src/externals/google/auth/types.ts` | `src/infrastructure/persistence/google-sheets/google-auth/types.ts` | Implemented PR 19; old path retains named forwards to the single physical owner. |
| `src/externals/google/drive/GoogleDriveService.ts` | `src/infrastructure/files/google-drive/GoogleDriveService.ts` | Implemented PR 19; old path retains named forwards to the single physical owner. |
| `src/externals/google/drive/const.ts` | `src/infrastructure/files/google-drive/const.ts` | Implemented PR 19; old path retains named forwards to the single physical owner. |
| `src/externals/google/drive/createGoogleDriveServiceFromConfig.ts` | `src/infrastructure/files/google-drive/createGoogleDriveServiceFromConfig.ts` | Implemented PR 19; old path retains named forwards to the single physical owner. |
| `src/externals/google/drive/index.ts` | `src/infrastructure/files/google-drive/index.ts` | Implemented PR 19; old path retains named forwards to the single physical owner. |
| `src/externals/google/drive/types.ts` | `src/infrastructure/files/google-drive/types.ts` | Implemented PR 19; old path retains named forwards to the single physical owner. |
| `src/externals/google/sheet/GoogleSheetsService.ts` | `app server composition + module ports/adapters + root Sheets transport contracts` | Split aggregate feature registry/exports; keep legacy facade until consumers migrate. |
| `src/externals/google/sheet/client/GoogleSheetsClient.ts` | `src/infrastructure/persistence/google-sheets/client/GoogleSheetsClient.ts` | Implemented PR 19; old path retains named forwards to the single physical owner. |
| `src/externals/google/sheet/client/index.ts` | `src/infrastructure/persistence/google-sheets/client/index.ts` | Implemented PR 19; old path retains named forwards to the single physical owner. |
| `src/externals/google/sheet/const.ts` | `src/infrastructure/persistence/google-sheets/const.ts` | Implemented PR 19; old path retains named forwards to the single physical owner. |
| `src/externals/google/sheet/createGoogleSheetsServiceFromConfig.ts` | `app server composition + module ports/adapters + root Sheets transport contracts` | Split aggregate feature registry/exports; keep legacy facade until consumers migrate. |
| `src/externals/google/sheet/index.ts` | `app server composition + module ports/adapters + root Sheets transport contracts` | Split aggregate feature registry/exports; keep legacy facade until consumers migrate. |
| `src/externals/google/sheet/sheets/BaseGoogleSheet.ts` | `src/infrastructure/persistence/google-sheets/sheets/BaseGoogleSheet.ts` | Implemented PR 19; old path retains named forwards to the single physical owner. |
| `src/externals/google/sheet/sheets/employee-advances/PayrollRecordsSheet.ts` | `src/modules/hr/infrastructure/google-sheets/employee-advances/PayrollRecordsSheet.ts` | Feature worksheet adapter/schema; preserve columns and input modes. |
| `src/externals/google/sheet/sheets/employee-compensations/EmployeeCompensationsSheet.ts` | `src/modules/hr/infrastructure/google-sheets/employee-compensations/EmployeeCompensationsSheet.ts` | Feature worksheet adapter/schema; preserve columns and input modes. |
| `src/externals/google/sheet/sheets/employee-compensations/const.ts` | `src/modules/hr/infrastructure/google-sheets/employee-compensations/const.ts` | Feature worksheet adapter/schema; preserve columns and input modes. |
| `src/externals/google/sheet/sheets/employee-timesheets/EmployeeTimesheetsSheet.ts` | `src/modules/hr/infrastructure/google-sheets/employee-timesheets/EmployeeTimesheetsSheet.ts` | Feature worksheet adapter/schema; preserve columns and input modes. |
| `src/externals/google/sheet/sheets/employee-timesheets/const.ts` | `src/modules/hr/infrastructure/google-sheets/employee-timesheets/const.ts` | Feature worksheet adapter/schema; preserve columns and input modes. |
| `src/externals/google/sheet/sheets/employees/EmployeesSheet.ts` | `src/modules/hr/infrastructure/google-sheets/employees/EmployeesSheet.ts` | Feature worksheet adapter/schema; preserve columns and input modes. |
| `src/externals/google/sheet/sheets/employees/const.ts` | `src/modules/hr/infrastructure/google-sheets/employees/const.ts` | Feature worksheet adapter/schema; preserve columns and input modes. |
| `src/externals/google/sheet/sheets/expenses/RecordsSheet.ts` | `src/modules/expenses/infrastructure/google-sheets/expenses/RecordsSheet.ts` | Feature worksheet adapter/schema; preserve columns and input modes. |
| `src/externals/google/sheet/sheets/index.ts` | `app server composition + module ports/adapters + root Sheets transport contracts` | Split aggregate feature registry/exports; keep legacy facade until consumers migrate. |
| `src/externals/google/sheet/sheets/movements/MovementSheet.ts` | `src/modules/inventory/infrastructure/google-sheets/movements/MovementSheet.ts` | Feature worksheet adapter/schema; preserve columns and input modes. |
| `src/externals/google/sheet/sheets/order-bills/OrderBillsSheet.ts` | `src/modules/orders/infrastructure/google-sheets/order-bills/OrderBillsSheet.ts` | Implemented PR21; one named legacy forward, original class/header declaration and registry consumer preserved. |
| `src/externals/google/sheet/sheets/order-bills/const.ts` | `src/modules/orders/infrastructure/google-sheets/order-bills/const.ts` | Implemented PR21; one named legacy forward, original class/header declaration and registry consumer preserved. |
| `src/externals/google/sheet/sheets/order-items/OrderItemsSheet.ts` | `src/modules/orders/infrastructure/google-sheets/order-items/OrderItemsSheet.ts` | Implemented PR21; one named legacy forward, original class/header declaration and registry consumer preserved. |
| `src/externals/google/sheet/sheets/order-items/const.ts` | `src/modules/orders/infrastructure/google-sheets/order-items/const.ts` | Implemented PR21; one named legacy forward, original class/header declaration and registry consumer preserved. |
| `src/externals/google/sheet/sheets/orders/OrdersSheet.ts` | `src/modules/orders/infrastructure/google-sheets/orders/OrdersSheet.ts` | Implemented PR21; one named legacy forward, original class/header declaration and registry consumer preserved. |
| `src/externals/google/sheet/sheets/orders/const.ts` | `src/modules/orders/infrastructure/google-sheets/orders/const.ts` | Implemented PR21; one named legacy forward, original class/header declaration and registry consumer preserved. |
| `src/externals/google/sheet/sheets/sales/profit-cost-overrides/SalesProfitCostOverridesSheet.ts` | `src/modules/sales/infrastructure/google-sheets/profit-cost-overrides/SalesProfitCostOverridesSheet.ts` | Implemented PR22; one named legacy forward, exact original declaration/headers and unchanged registry/consumer behavior. |
| `src/externals/google/sheet/sheets/sales/profit-cost-overrides/const.ts` | `src/modules/sales/infrastructure/google-sheets/profit-cost-overrides/const.ts` | Implemented PR22; one named legacy forward, exact original declaration/headers and unchanged registry/consumer behavior. |
| `src/externals/google/sheet/sheets/sales/receipt-items/SalesReceiptItemsSheet.ts` | `src/modules/sales/infrastructure/google-sheets/receipt-items/SalesReceiptItemsSheet.ts` | Implemented PR22; one named legacy forward, exact original declaration/headers and unchanged registry/consumer behavior. |
| `src/externals/google/sheet/sheets/sales/receipt-items/const.ts` | `src/modules/sales/infrastructure/google-sheets/receipt-items/const.ts` | Implemented PR22; one named legacy forward, exact original declaration/headers and unchanged registry/consumer behavior. |
| `src/externals/google/sheet/sheets/sales/receipt-payments/SalesReceiptPaymentsSheet.ts` | `src/modules/sales/infrastructure/google-sheets/receipt-payments/SalesReceiptPaymentsSheet.ts` | Implemented PR22; one named legacy forward, exact original declaration/headers and unchanged registry/consumer behavior. |
| `src/externals/google/sheet/sheets/sales/receipt-payments/const.ts` | `src/modules/sales/infrastructure/google-sheets/receipt-payments/const.ts` | Implemented PR22; one named legacy forward, exact original declaration/headers and unchanged registry/consumer behavior. |
| `src/externals/google/sheet/sheets/sales/receipt-syncs/SalesReceiptSyncsSheet.ts` | `src/modules/sales/infrastructure/google-sheets/receipt-syncs/SalesReceiptSyncsSheet.ts` | Implemented PR22; one named legacy forward, exact original declaration/headers and unchanged registry/consumer behavior. |
| `src/externals/google/sheet/sheets/sales/receipt-syncs/const.ts` | `src/modules/sales/infrastructure/google-sheets/receipt-syncs/const.ts` | Implemented PR22; one named legacy forward, exact original declaration/headers and unchanged registry/consumer behavior. |
| `src/externals/google/sheet/sheets/sales/receipts/SalesReceiptsSheet.ts` | `src/modules/sales/infrastructure/google-sheets/receipts/SalesReceiptsSheet.ts` | Implemented PR22; one named legacy forward, exact original declaration/headers and unchanged registry/consumer behavior. |
| `src/externals/google/sheet/sheets/sales/receipts/const.ts` | `src/modules/sales/infrastructure/google-sheets/receipts/const.ts` | Implemented PR22; one named legacy forward, exact original declaration/headers and unchanged registry/consumer behavior. |
| `src/externals/google/sheet/sheets/shipment-orders/ShipmentOrdersSheet.ts` | `src/modules/shipments/infrastructure/google-sheets/shipment-orders/ShipmentOrdersSheet.ts` | Implemented PR21; one named legacy forward, original class/header declaration and registry consumer preserved. |
| `src/externals/google/sheet/sheets/shipment-orders/const.ts` | `src/modules/shipments/infrastructure/google-sheets/shipment-orders/const.ts` | Implemented PR21; one named legacy forward, original class/header declaration and registry consumer preserved. |
| `src/externals/google/sheet/sheets/shipments/ShipmentsSheet.ts` | `src/modules/shipments/infrastructure/google-sheets/shipments/ShipmentsSheet.ts` | Implemented PR21; one named legacy forward, original class/header declaration and registry consumer preserved. |
| `src/externals/google/sheet/sheets/shipments/const.ts` | `src/modules/shipments/infrastructure/google-sheets/shipments/const.ts` | Implemented PR21; one named legacy forward, original class/header declaration and registry consumer preserved. |
| `src/externals/google/sheet/sheets/stock-adjustments/StockAdjustmentsSheet.ts` | `src/modules/inventory/infrastructure/google-sheets/stock-adjustments/StockAdjustmentsSheet.ts` | Feature worksheet adapter/schema; preserve columns and input modes. |
| `src/externals/google/sheet/sheets/stock-counts/StockCountsSheet.ts` | `src/modules/inventory/infrastructure/google-sheets/stock-counts/StockCountsSheet.ts` | Feature worksheet adapter/schema; preserve columns and input modes. |
| `src/externals/google/sheet/sheets/stock-counts/const.ts` | `src/modules/inventory/infrastructure/google-sheets/stock-counts/const.ts` | Feature worksheet adapter/schema; preserve columns and input modes. |
| `src/externals/google/sheet/sheets/user-state/UserStateSheet.ts` | `src/modules/line-workflows/infrastructure/google-sheets/user-state/UserStateSheet.ts` | Feature worksheet adapter/schema; preserve columns and input modes. |
| `src/externals/google/sheet/sheets/user-state/const.ts` | `src/modules/line-workflows/infrastructure/google-sheets/user-state/const.ts` | Feature worksheet adapter/schema; preserve columns and input modes. |
| `src/externals/google/sheet/types.ts` | `app server composition + module ports/adapters + root Sheets transport contracts` | Split aggregate feature registry/exports; keep legacy facade until consumers migrate. |
| `src/externals/google/utils/jwt.ts` | `src/infrastructure/persistence/google-sheets/google-auth/utils/jwt.ts` | Implemented PR 19; old path retains named forwards to the single physical owner. |
| `src/externals/line/LineBotService.ts` | `src/infrastructure/external/line/LineBotService.ts` | Provider transport/protocol only; preserve runtime behavior. |
| `src/externals/line/const.ts` | `src/infrastructure/external/line/const.ts` | Provider transport/protocol only; preserve runtime behavior. |
| `src/externals/line/enum.ts` | `src/infrastructure/external/line/enum.ts` | Provider transport/protocol only; preserve runtime behavior. |
| `src/externals/line/index.ts` | `src/infrastructure/external/line/index.ts` | Provider transport/protocol only; preserve runtime behavior. |
| `src/externals/line/types.ts` | `src/infrastructure/external/line/types.ts` | Provider transport/protocol only; preserve runtime behavior. |
| `src/externals/line/utils/messageBuilder.ts` | `src/infrastructure/external/line/utils/messageBuilder.ts` | Provider transport/protocol only; preserve runtime behavior. |
| `src/externals/loyverse/LoyverseService.ts` | `src/infrastructure/external/loyverse/LoyverseService.ts` | Provider transport/protocol only; preserve runtime behavior. |
| `src/externals/loyverse/const.ts` | `src/infrastructure/external/loyverse/const.ts` | Provider transport/protocol only; preserve runtime behavior. |
| `src/externals/loyverse/createLoyverseServiceFromConfig.ts` | `src/infrastructure/external/loyverse/createLoyverseServiceFromConfig.ts` | Provider transport/protocol only; preserve runtime behavior. |
| `src/externals/loyverse/index.ts` | `src/infrastructure/external/loyverse/index.ts` | Provider transport/protocol only; preserve runtime behavior. |
| `src/externals/loyverse/types.ts` | `src/infrastructure/external/loyverse/types.ts` | Provider transport/protocol only; preserve runtime behavior. |
| `src/features/backend/line/enum/index.ts` | `src/modules/line-workflows/application/enum/index.ts` | Workflow routing/reply/state; separate pure command models into domain when needed. |
| `src/features/backend/line/services/movements/index.ts` | `src/modules/line-workflows/application/services/movements/index.ts` | Workflow routing/reply/state; separate pure command models into domain when needed. |
| `src/features/backend/line/services/movements/utils.ts` | `src/modules/inventory/domain/movementQuantity.ts` | Pure quantity parser/validation used by inventory and LINE; expose through inventory public contracts to avoid a reverse dependency. |
| `src/features/backend/line/services/reply.ts` | `src/modules/line-workflows/application/services/reply.ts` | Workflow routing/reply/state; separate pure command models into domain when needed. |
| `src/features/backend/line/utils/index.ts` | `src/modules/line-workflows/application/utils/index.ts` | Workflow routing/reply/state; separate pure command models into domain when needed. |
| `src/features/backend/shared/utils.ts` | `src/shared/lib/isRecord.ts` | Generic parser only; no business dependencies. |
| `src/features/backend/shipments/utils.ts` | `src/modules/shipments/application/validation.ts + app route HTTP parsing` | Split business validation from readJsonBody transport helper. |
| `src/features/frontend/orders/components/OrderImageCard.tsx` | `src/modules/orders/ui/OrderImageCard.tsx` | Moved in PR 3; component/client/style body preserved; imports corrected. |
| `src/features/frontend/orders/components/OrderImageGallery.tsx` | `src/modules/orders/ui/OrderImageGallery.tsx` | Moved in PR 3; component/client/style body preserved; imports corrected. |
| `src/features/frontend/orders/components/OrderListPage.tsx` | `src/modules/orders/ui/OrderListPage.tsx` | Moved in PR 3; component/client/style body preserved; imports corrected. |
| `src/features/frontend/orders/components/OrderMobileCard.tsx` | `src/modules/orders/ui/OrderMobileCard.tsx` | Moved in PR 3; component/client/style body preserved; imports corrected. |
| `src/features/frontend/orders/components/OrderProductImageActions.tsx` | `src/modules/orders/ui/OrderProductImageActions.tsx` | Moved in PR 3; component/client/style body preserved; imports corrected. |
| `src/features/frontend/orders/components/OrderProductImageUpload.tsx` | `src/modules/orders/ui/OrderProductImageUpload.tsx` | Moved in PR 3; component/client/style body preserved; imports corrected. |
| `src/features/frontend/orders/components/OrderQuantityStatus.tsx` | `src/modules/orders/ui/OrderQuantityStatus.tsx` | Moved in PR 3; component/client/style body preserved; imports corrected. |
| `src/features/frontend/orders/components/orderListFormat.ts` | `src/modules/orders/ui/orderListFormat.ts` | Moved in PR 3; component/client/style body preserved; imports corrected. |
| `src/features/frontend/orders/components/orderQuantityStatus.module.css` | `src/modules/orders/ui/orderQuantityStatus.module.css` | Moved in PR 3; component/client/style body preserved; imports corrected. |
| `src/features/frontend/orders/components/orders.module.css` | `src/modules/orders/ui/orders.module.css` | Moved in PR 3; component/client/style body preserved; imports corrected. |
| `src/scripts/line-rich-menu-client.ts` | `src/scripts/line-rich-menu-client.ts` | Keep operational entrypoint; rich-menu content may later move to line-workflows; do not execute. |
| `src/scripts/rich-menu.ts` | `src/scripts/rich-menu.ts` | Keep operational entrypoint; rich-menu content may later move to line-workflows; do not execute. |
| `src/scripts/setup-rich-menu.ts` | `src/scripts/setup-rich-menu.ts` | Keep operational entrypoint; rich-menu content may later move to line-workflows; do not execute. |
| `src/scripts/tsconfig.json` | `src/scripts/tsconfig.json` | Keep operational entrypoint; rich-menu content may later move to line-workflows; do not execute. |
| `src/services/employees/calculateEmployeePayroll.ts` | `src/modules/hr/application/calculateEmployeePayroll.ts` | Split DTOs/pure rules to domain and row schemas/mapping/IO to module infrastructure; use explicit ports. |
| `src/services/employees/index.ts` | `src/modules/hr/contracts.ts + server.ts` | Retire broad barrel after consumers use explicit browser/server exports; not a whole-file move. |
| `src/services/employees/manageEmployeeTimesheets.ts` | `src/modules/hr/application/manageEmployeeTimesheets.ts` | Split DTOs/pure rules to domain and row schemas/mapping/IO to module infrastructure; use explicit ports. |
| `src/services/employees/manageEmployees.ts` | `src/modules/hr/application/manageEmployees.ts` | Split DTOs/pure rules to domain and row schemas/mapping/IO to module infrastructure; use explicit ports. |
| `src/services/employees/manageSalaryAdvances.ts` | `src/modules/hr/application/manageSalaryAdvances.ts` | Split DTOs/pure rules to domain and row schemas/mapping/IO to module infrastructure; use explicit ports. |
| `src/services/employees/settleEmployeePayroll.ts` | `src/modules/hr/application/settleEmployeePayroll.ts` | Split DTOs/pure rules to domain and row schemas/mapping/IO to module infrastructure; use explicit ports. |
| `src/services/expenses/index.ts` | `src/modules/expenses/contracts.ts + server.ts` | Retire broad barrel after consumers use explicit browser/server exports; not a whole-file move. |
| `src/services/expenses/manageExpenses.ts` | `src/modules/expenses/application/manageExpenses.ts` | Split DTOs/pure rules to domain and row schemas/mapping/IO to module infrastructure; use explicit ports. |
| `src/services/expenses/types.ts` | `src/modules/expenses/domain/types.ts` | Pure feature values; split worksheet headers/provider DTOs into infrastructure before moving. |
| `src/services/line/enum.ts` | `src/modules/line-workflows/application/enum.ts` | Move command enums/text rules to domain only after separating IO. |
| `src/services/line/events.ts` | `src/modules/line-workflows/application/events.ts` | Move command enums/text rules to domain only after separating IO. |
| `src/services/line/events/completeBill.ts` | `src/modules/line-workflows/application/events/completeBill.ts` | Move command enums/text rules to domain only after separating IO. |
| `src/services/line/events/completeProducts.ts` | `src/modules/line-workflows/application/events/completeProducts.ts` | Move command enums/text rules to domain only after separating IO. |
| `src/services/line/events/createOrder.ts` | `src/modules/line-workflows/application/events/createOrder.ts` | Move command enums/text rules to domain only after separating IO. |
| `src/services/line/events/orderBillImage.ts` | `src/modules/line-workflows/application/events/orderBillImage.ts` | Move command enums/text rules to domain only after separating IO. |
| `src/services/line/events/orderProductImage.ts` | `src/modules/line-workflows/application/events/orderProductImage.ts` | Move command enums/text rules to domain only after separating IO. |
| `src/services/line/events/orderTotalPrice.ts` | `src/modules/line-workflows/application/events/orderTotalPrice.ts` | Move command enums/text rules to domain only after separating IO. |
| `src/services/line/index.ts` | `src/modules/line-workflows/application/index.ts` | Move command enums/text rules to domain only after separating IO. |
| `src/services/line/text.ts` | `src/modules/line-workflows/application/text.ts` | Move command enums/text rules to domain only after separating IO. |
| `src/services/line/utils/resolveUserState.ts` | `src/modules/line-workflows/application/utils/resolveUserState.ts` | Move command enums/text rules to domain only after separating IO. |
| `src/services/movements/index.ts` | `src/modules/inventory/contracts.ts + server.ts` | Retire broad barrel after consumers use explicit browser/server exports; not a whole-file move. |
| `src/services/movements/manageMovements.ts` | `src/modules/inventory/application/manageMovements.ts` | Split DTOs/pure rules to domain and row schemas/mapping/IO to module infrastructure; use explicit ports. |
| `src/services/movements/state.ts` | `src/modules/line-workflows/application/sessions/ + src/modules/inventory/infrastructure/google-sheets/` | Split session workflow from inventory master/item persistence; preserve ordering and retry behavior. |
| `src/services/orders/OrderItemQuantityType.ts` | `src/modules/orders/contracts.ts` (implemented) | Definition extracted in PR 2; existing file is a compatibility re-export. |
| `src/services/orders/completeOrderBill.ts` | `src/modules/orders/application/completeOrderBill.ts` | Split DTOs/pure rules to domain and row schemas/mapping/IO to module infrastructure; use explicit ports. |
| `src/services/orders/completeOrderProducts.ts` | `src/modules/orders/application/completeOrderProducts.ts` | Split DTOs/pure rules to domain and row schemas/mapping/IO to module infrastructure; use explicit ports. |
| `src/services/orders/completeOrderTotalPrice.ts` | `src/modules/orders/application/completeOrderTotalPrice.ts` | Split DTOs/pure rules to domain and row schemas/mapping/IO to module infrastructure; use explicit ports. |
| `src/services/orders/completeWebOrderPrice.ts` | `src/modules/orders/application/completeWebOrderPrice.ts` | Split DTOs/pure rules to domain and row schemas/mapping/IO to module infrastructure; use explicit ports. |
| `src/services/orders/createDraftOrder.ts` | `src/modules/orders/application/createDraftOrder.ts` | OrderStatus extracted to contracts in PR 2; application/workflow/persistence split remains future work. |
| `src/services/orders/createOrder.ts` | `src/modules/orders/application/create-order.ts` + feature writer adapter (implemented) | Legacy file is a server composition/type compatibility re-export; image workflow call path retained. |
| `src/services/orders/createOrderBill.ts` | `src/modules/orders/application/createOrderBill.ts` | Split DTOs/pure rules to domain and row schemas/mapping/IO to module infrastructure; use explicit ports. |
| `src/services/orders/createOrderItem.ts` | `src/modules/orders/application/createOrderItem.ts` | Split DTOs/pure rules to domain and row schemas/mapping/IO to module infrastructure; use explicit ports. |
| `src/services/orders/createOrderWithImages.ts` | `src/modules/orders/application/createOrderWithImages.ts` | Split DTOs/pure rules to domain and row schemas/mapping/IO to module infrastructure; use explicit ports. |
| `src/services/orders/findOrderRowNumber.ts` | `src/modules/orders/application/findOrderRowNumber.ts` | Split DTOs/pure rules to domain and row schemas/mapping/IO to module infrastructure; use explicit ports. |
| `src/services/orders/index.ts` | `src/modules/orders/contracts.ts + server.ts` | Retire broad barrel after consumers use explicit browser/server exports; not a whole-file move. |
| `src/services/orders/isActiveOrderCreateState.ts` | `src/modules/line-workflows/application/orders/isActiveOrderCreateState.ts` | Workflow/session responsibility; consume orders public status contracts. |
| `src/services/orders/isOrderImageUploadState.ts` | `src/modules/line-workflows/application/orders/isOrderImageUploadState.ts` | Workflow/session responsibility; consume orders public status contracts. |
| `src/services/orders/listOrders.ts` | `src/modules/orders/application/list-orders.ts` + feature read/mapping adapters (implemented) | List compatibility export retained; getOrderDetail and its detail-only mapping remain legacy. |
| `src/services/orders/orderExists.ts` | `src/modules/orders/application/orderExists.ts` | Split DTOs/pure rules to domain and row schemas/mapping/IO to module infrastructure; use explicit ports. |
| `src/services/orders/replaceOrderProductImage.ts` | `src/modules/orders/application/replaceOrderProductImage.ts` | Split DTOs/pure rules to domain and row schemas/mapping/IO to module infrastructure; use explicit ports. |
| `src/services/orders/updateOrderCreateState.ts` | `src/modules/line-workflows/application/orders/updateOrderCreateState.ts` | Workflow/session responsibility; consume orders public status contracts. |
| `src/services/orders/updateOrderDetails.ts` | `src/modules/orders/application/updateOrderDetails.ts` | Split DTOs/pure rules to domain and row schemas/mapping/IO to module infrastructure; use explicit ports. |
| `src/services/orders/updateOrderItemProductCode.ts` | `src/modules/orders/application/updateOrderItemProductCode.ts` | Split DTOs/pure rules to domain and row schemas/mapping/IO to module infrastructure; use explicit ports. |
| `src/services/orders/updateOrderItemQuantity.ts` | `src/modules/orders/application/updateOrderItemQuantity.ts` | Split DTOs/pure rules to domain and row schemas/mapping/IO to module infrastructure; use explicit ports. |
| `src/services/orders/updateOrderProducts.ts` | `src/modules/orders/application/updateOrderProducts.ts` | Split DTOs/pure rules to domain and row schemas/mapping/IO to module infrastructure; use explicit ports. |
| `src/services/sales/getGoogleSheetsDailySales.ts` | `src/modules/sales/application/getGoogleSheetsDailySales.ts` | Split DTOs/pure rules to domain and row schemas/mapping/IO to module infrastructure; use explicit ports. |
| `src/services/sales/getLoyverseReceiptsForSalesDate.ts` | `src/modules/sales/application/getLoyverseReceiptsForSalesDate.ts` | Split DTOs/pure rules to domain and row schemas/mapping/IO to module infrastructure; use explicit ports. |
| `src/services/sales/idBuilders.ts` | `src/modules/sales/domain/idBuilders.ts` | Pure feature values; split worksheet headers/provider DTOs into infrastructure before moving. |
| `src/services/sales/index.ts` | `src/modules/sales/contracts.ts + server.ts` | Retire broad barrel after consumers use explicit browser/server exports; not a whole-file move. |
| `src/services/sales/listSalesSyncStatus.ts` | `src/modules/sales/application/listSalesSyncStatus.ts` | Split DTOs/pure rules to domain and row schemas/mapping/IO to module infrastructure; use explicit ports. |
| `src/services/sales/manageSalesProfitCostOverrides.ts` | `src/modules/sales/application/manageSalesProfitCostOverrides.ts` | Split DTOs/pure rules to domain and row schemas/mapping/IO to module infrastructure; use explicit ports. |
| `src/services/sales/rowMappers.ts` | `src/modules/sales/application/rowMappers.ts` | Split DTOs/pure rules to domain and row schemas/mapping/IO to module infrastructure; use explicit ports. |
| `src/services/sales/syncLoyverseDailySales.ts` | `src/modules/sales/application/syncLoyverseDailySales.ts` | Split DTOs/pure rules to domain and row schemas/mapping/IO to module infrastructure; use explicit ports. |
| `src/services/shipments/createShipment.ts` | `src/modules/shipments/application/create-shipment.ts` + writer adapter/server (implemented PR 9) | Legacy path is one named composition re-export; original business object and A:M payload preserved. |
| `src/services/shipments/index.ts` | `src/modules/shipments/contracts.ts + server.ts` | Retire broad barrel after consumers use explicit browser/server exports; not a whole-file move. |
| `src/services/shipments/linkOrderToShipment.ts` | `src/modules/shipments/application/link-order-to-shipment.ts` + link port/Sheets adapter (implemented PR 11) | Narrow named facade retained; original error class/types in application; deferred row mapping and A:G append in adapter. |
| `src/services/shipments/listShipments.ts` | `src/modules/shipments/application/list-shipments.ts` + reader port/Sheets adapter (implemented PR 10) | Two named legacy re-exports retained; final read rules in application, row decoding in adapter; see implemented table above. |
| `src/services/shipments/types.ts` | `src/modules/shipments/contracts.ts` (public surface implemented; physical definitions deferred) | Pure enum/DTO leaf retained temporarily for Orders bridge/identity; physically transfer only after decoupling. No speculative domain layer. |
| `src/services/shipments/updateShipmentStatus.ts` | `src/modules/shipments/application/update-shipment-status.ts` + status port/Sheets adapter (implemented PR 12) | Narrow legacy facade retained; decisions in application, original header/read/raw-field/B:M mechanics in adapter; Drive stays in PATCH. |
| `src/services/stock-adjustments/manageStockAdjustments.ts` | `src/modules/inventory/application/manageStockAdjustments.ts` | Split DTOs/pure rules to domain and row schemas/mapping/IO to module infrastructure; use explicit ports. |
| `src/services/stock-adjustments/types.ts` | `src/modules/inventory/domain/adjustments/types.ts` | Pure feature values; split worksheet headers/provider DTOs into infrastructure before moving. |
| `src/services/stock-counts/index.ts` | `src/modules/inventory/contracts.ts + server.ts` | Retire broad barrel after consumers use explicit browser/server exports; not a whole-file move. |
| `src/services/stock-counts/manageStockCounts.ts` | `src/modules/inventory/application/manageStockCounts.ts` | Split DTOs/pure rules to domain and row schemas/mapping/IO to module infrastructure; use explicit ports. |
| `src/services/user-states/findLatestUserState.ts` | `src/modules/line-workflows/application/sessions/findLatestUserState.ts` | Split session DTOs/domain and row adapter into module infrastructure. |
| `src/services/user-states/index.ts` | `src/modules/line-workflows/application/sessions/index.ts` | Split session DTOs/domain and row adapter into module infrastructure. |
| `src/services/utils/createSortableId.ts` | `src/shared/lib/createSortableId.server.ts` | Node crypto utility; preserve IDs, sequence and clock behavior. |

## PR 19 — completed shared Google transport slice

The fifteen transport/auth/provider files above are physically relocated with named compatibility forwards. Six generic type declarations move from `externals/google/sheet/types.ts` to `infrastructure/persistence/google-sheets/types.ts`; aggregate and feature contracts remain. GoogleSheetsService, its factory, worksheet registry/classes/headers and all consumers stay byte-identical. [Exact mapping, 115-edge audit and remaining work](google-shared-infrastructure.md).


## Orders pure Sheet type-import prerequisite

The four erased imports in Orders server/row-mapping/writer/list-reader change from the mixed Sheets index to its pure types leaf. All worksheet classes, header constants, registry/indexes and consumers outside those four imports remain unchanged. This prerequisite clears the type-inclusive reverse-edge blocker; the ten-file worksheet migration must start from the new reviewed merge SHA. [Exact inventory and evidence](orders-sheet-type-imports.md).

## PR 21 — completed Orders/Shipments worksheet slice

Five worksheet classes and their five header files now live at the feature destinations above. All ten old paths remain explicit named forwards. Aggregate GoogleSheetsService/factory/indexes and every consumer remain byte-identical. PR20 pure type imports prevent the former reverse ownership edge; other feature worksheet moves and registry retirement remain separate work. [Exact source/hash/identity/graph evidence](orders-shipments-worksheet-ownership.md).

## PR 22 — completed Sales worksheet slice

Five Sales classes and five header arrays now live at the module destinations above, with ten exact old named forwards. Registry/factory/indexes, existing Sales/other consumers and all business/provider behavior remain unchanged. Other feature worksheets, use-case extraction, legacy type-boundary debt and compatibility retirement remain deferred. [Source/hash/consumer/graph evidence](sales-worksheet-ownership.md).


## Inventory employee-directory prerequisite

listAdjustmentEmployees now delegates to Inventory application/port and guarded legacy composition of the HR public employee query. HR infrastructure owns the existing prefix-header/five-column projection. Exact AdjustmentEmployee and StockCountAccount types move to Inventory contracts with old forwards; direct Inventory Sheet imports become pure types/own headers. Other stock/HR algorithms and all worksheets remain unchanged. The HR core worksheet move must restart on a newly verified merge base. [Inventory/HR prerequisite map](inventory-employee-directory.md).
