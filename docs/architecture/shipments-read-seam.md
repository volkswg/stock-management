# Shipment list/detail read seam (PR 10)

Base: `1d6392abfcc117de1c70a966e78cabe41c0cc9ab`, the verified PR 9 squash merge and latest main at preflight. Dedicated branch: `refactor/shipments-read-seam`. This completes only the Shipment list/detail read seam. The full Shipments milestone remains incomplete.

## Callers and ownership

Source references were audited before extraction. The collection GET in `app/api/shipments/route.ts` calls `listShipments`; detail GET in `app/api/shipments/[id]/route.ts` calls `getShipmentDetail`. Both import the unchanged legacy `services/shipments` barrel. Detail also calls the list workflow internally. No other production server read callers were found. Browser operations with similar names remain HTTP clients, not server use cases.

| File | Responsibility / exports |
| --- | --- |
| `modules/shipments/application/list-shipments.ts` (new) | Named testable `listShipments(reader, options?)` and `getShipmentDetail(reader, shipmentId)`; final status filtering, relation assembly, costs and reverse ordering |
| `modules/shipments/application/ports/shipment-list-reader.ts` (new) | `ShipmentListReader` and `ShipmentReadModel`, the consumer-owned business snapshot |
| `modules/shipments/infrastructure/google-sheets/shipment-list-reader.ts` (new) | Guarded `GoogleSheetsShipmentListReader`; four existing reads and original storage row decoding/grouping |
| `modules/shipments/server.ts` (extended) | Named server-only list/detail composition; original `createShipment` declaration/body stays byte-identical |
| `services/shipments/listShipments.ts` | Exactly `export { listShipments, getShipmentDetail } from "@/modules/shipments/server";` |
| `services/shipments/index.ts` and all API routes | Byte-identical callers/exports, original validation/HTTP translation retained |

No domain layer, generic repository, cache, new provider, or second read implementation is introduced. The original source exists only as historical test evidence, not production logic.

## Port and composition

`ShipmentListReader.readShipmentList({ includeOrders: boolean }): Promise<ShipmentReadModel>` returns:

- `shipments`: a read-only array of normalized `Omit<ShipmentListItem, "orders" | "costSummary">` records, in worksheet order; invalid/deleted rows and `deletedAt` omitted.
- `orderIdsByShipmentId`: a read-only map of Shipment IDs to ordered, deduplicated Order ID arrays.
- `ordersById`: a read-only map of valid `ShipmentRelatedOrder` records with ordered product images.

The port exposes no worksheets, ranges, row/cell formats, Google interfaces/auth, HTTP objects, config, or tenancy assumptions. It does not return a calculated final list. Fake business readers execute the real application without credentials or provider code.

Server composition retains the original list input object (`googleSheetsService`, optional `includeOrders` and readonly `excludeStatuses`) and detail input (`googleSheetsService`, `shipmentId`). Return types remain `Promise<ShipmentListItem[]>` and `Promise<ShipmentListItem | undefined>`. Each call constructs one lazy reader from the supplied service; no Google auth/config/transport is constructed. The existing creation composition, ID generator, application and writer are untouched. Direct legacy, barrel, and named server read exports have identical function identity.

## Read and mapping behavior

Adapter construction stores only `Pick<IGoogleSheetsService, "shipments" | "shipmentOrders" | "orders" | "orderItems">`, without accessing any worksheet getter. Its `Promise.all` starts these four expressions in this order:

1. `shipments.readRows()`.
2. `shipmentOrders.readRows()` when includeOrders, otherwise `Promise.resolve([])`.
3. `orders.readRows("A:I")` when includeOrders, otherwise `Promise.resolve([])`.
4. `orderItems.readRows()` when includeOrders, otherwise `Promise.resolve([])`.

Reads remain concurrent, not sequential/batched/cached. Existing provider defaults resolve to A:M, A:G and A:J respectively; Orders remains explicitly A:I. The list never substitutes the status workflow's A2:M. With `includeOrders=false`, no other worksheet getter is accessed, relations are empty and final costs are null. Status exclusions never reduce read volume.

After reads, links are grouped first, then images, then related Orders, then Shipment rows are decoded. Malformed collections/rows continue rejecting in that mapping order. Synchronous worksheet getter/read exceptions retain evaluation short-circuiting; asynchronous read rejections propagate their original error without retry. No writes are added.

All eight original decoding/grouping helper declarations are unchanged: `mapShipmentRow`, `groupOrderIdsByShipmentId`, `mapRelatedOrderRow`, `groupProductImagesByOrderId`, `toStringValue`, `toNumber`, `isShipmentStatus`, `isOrderStatus`. The adapter imports runtime `OrderStatus` only from Orders public contracts, never an Orders private mapper or legacy create implementation. ShipmentStatus still comes through the public contract's single pure legacy enum definition.

Preserved rules include trimming/stringification of numbers/booleans, required ID/status/PO checks, deletion filtering, null/non-finite/comma price handling, zero values, field/key order, duplicate image retention and image order/quantity/code strings. Links deduplicate Order IDs **within each Shipment** by first occurrence and may retain one Order under multiple Shipments. The last valid duplicate Order row wins; later invalid/deleted rows do not replace it. There is no new latest-link or global uniqueness rule.

This differs deliberately from the unchanged Orders detail projection: it reads five worksheets and searches reversed active links for the latest Shipment per Order. `services/orders/listOrders.ts` is untouched and does not call this reader. Its nested Shipment projection and enum coupling require a later consumer-owned Orders port.

## Application and calculations

The application awaits the normalized snapshot, builds the exclusion set, filters statuses, resolves ordered linked Orders (dropping absent lookups), calculates costs, constructs the original DTO objects and reverses the completed array. It does not mutate snapshot ordering. Defaults remain includeOrders=true and excludeStatuses=[]. Detail executes this full default workflow once, then uses `find` on the reversed list without trimming its ID. Last valid duplicate Shipment rows therefore win detail lookup; missing IDs return undefined.

The three pure helpers `calculateShipmentCostSummary`, `calculateQuantityCost`, `toPositiveNumber` retain their original full declarations and evaluation order. Null fee, no Orders, or any null Order price yields null costSummary. Otherwise ordered price reduction and `landedTotal = totalOrderPrice + shippingFee` feed separate quote/delivered calculations. Missing/invalid/zero/negative/non-finite quantities or no images yield null quantity summaries. Positive comma-formatted quantities retain native Number conversion; division has no rounding. Zero totals/fees remain valid. The inherited table retains exact `0.1 + 0.2` and `0.3` fee results, including raw floating-point division.

## Historical evidence and tests

`tests/fixtures/shipments-list-before.json` captures the original full source, raw SHA-256, all thirteen declaration hashes and the base commit; it also records the original creation composition declaration. The existing `shipments-structure.json`, `shipments-read.json`, route fixture, client/UI/CSS/Orders fixtures and every unrelated hash remain unchanged.

Only these thirteen old read declarations receive explicit destination-aware checks: the eleven helpers named above and `listShipments` / `getShipmentDetail`. All eleven moved helper AST hashes must equal the original historical values. The two changed orchestrations instead run against golden JSON/events, fake ports/Sheets and the saved original implementation, including malformed-input error comparisons. The historical thirteen expected hashes are never overwritten; no blanket Shipment fingerprint exemption is used. Existing PR 9's two explicit creation exceptions remain active.

The inherited 212-test baseline passed before editing. Five new characterization tests ran against the original legacy implementation before extraction. Final coverage adds thirteen seam/history/transport/HTTP tests and five boundary tests: 235 total, with the original behavioral expectations retained. Necessary inherited structural changes are limited to the server's now-three named exports, the creation graph's explicit new read dependencies, and thirteen exact read fingerprint migration cases. The closed offline loader adds only the three read files; its deterministic ID/clock, pure enum and PR 9 creation wiring remain. Config/auth/Drive/arbitrary new application files remain rejected.

Tests cover concurrency and deferred completion, conditional reads, each read rejection and synchronous failure identity/order, no retries/writes, duplicate relations/Orders/Shipments, original malformed collections/rows, fake-reader application rules, original costs, direct/barrel/server identity, actual GET routes, invalid/duplicate filters and detail lookup. The real adapter also runs through all four existing worksheet classes, BaseGoogleSheet and GoogleSheetsClient with fake auth/fetch, verifying populated fixture output, exact ranges and unchanged GET options. No live provider is loaded by the closed service loader.

## Boundaries, verification and remaining work

Scoped read-file overrides permit only own public contracts/port in application and port; the adapter additionally permits server-only, erased existing Sheets interfaces and public Orders enum. Creation import allowlists remain unchanged. Composition adds only explicit application/reader imports. Alias/relative/type/re-export/import-type/dynamic/require bypasses, providers/config/frameworks and direct application time/env/IO are rejected. Adapter/server guards are explicit. Existing browser lint protections are unchanged.

Runtime and type-only server graphs remain acyclic and closed to exact seam files, pure types/constants/contracts and the original ID utility. Browser graphs still reach no application/server/provider implementation, with only Shipments → Orders ownership. No Orders module imports Shipment implementations or this new port. The pure legacy Shipment enum leaf remains the documented physical ownership exception; runtime identity is preserved.

[Verification](verification.md) records baseline/final commands, isolated credential-free builds and manifest comparison. All 23 page and 35 API route source contracts remain unchanged. API handlers, page/loading wrappers, components, CSS, browser client, Orders picker/composition, provider implementations, creation/link/status services, headers/modes, env/package/lockfile and data remain unchanged.

Linking, status updates, Drive orchestration, Orders server detail projection, physical enum ownership, original ID utility location and eventual legacy barrel/facade retirement remain separate future scopes. No retries, transactions, concurrency fixes, Supabase/auth/tenancy/billing, schema/data changes, merge or deployment are included. Synthetic fixtures/transport tests do not establish real Google permissions/availability, real-browser visuals or concurrency safety. No live Sheets, Drive, LINE, Loyverse, credentials, production records or operational scripts were used.
