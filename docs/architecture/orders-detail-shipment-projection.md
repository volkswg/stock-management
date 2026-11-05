# Orders detail Shipment projection seam (PR 14)

Base: `b16df0fff494b01357c318b65cc5e586656c028b`, verified latest main and PR 13 squash merge; initial tree clean, no intervening commits. Branch: `refactor/orders-detail-shipment-projection`. Only Orders detail and its Shipment projection are extracted. Physical ShipmentStatus ownership and broader legacy cleanup remain future milestones.

## Caller and file inventory

Source/caller audit found one production detail caller: GET `app/api/orders/[id]/route.ts`, previously through `services/orders`. No LINE or other server function calls getOrderDetail. The direct leaf and unchanged barrel nevertheless retain the original public contract for existing consumers. Browser getOrder remains an unchanged HTTP client, not a server query import.

| File | Ownership |
| --- | --- |
| `modules/orders/application/get-order-detail.ts` (new) | Five flat business reads, Order existence, deferred association order, original final OrderDetail assembly |
| `modules/orders/application/ports/order-detail-reader.ts` (new) | Orders-owned Order/product/bill business snapshots |
| `modules/orders/application/ports/order-detail-shipment-projection.ts` (new) | Orders-owned public consumer projection interfaces, using only OrderShipment |
| `modules/orders/infrastructure/google-sheets/order-detail-reader.ts` (new) | First three read starts and deferred original Order/product/bill mapping; moved bill mapper |
| `modules/shipments/infrastructure/google-sheets/order-detail-shipment-projection.ts` (new) | Fourth/fifth read starts, deferred reverse link lookup and exact nested Shipment mapper; feature-local converters |
| `modules/orders/server.ts` | Named detail composition requiring an injected Orders-owned projection; existing list/create declarations unchanged |
| `services/orders/listOrders.ts` | Narrow legacy-only composition preserving old getOrderDetail input/return/type/list exports; no mapping or Shipment runtime enum/barrel dependency |
| `app/api/orders/[id]/route.ts` | GET injects concrete Shipment adapter at app composition; original validation/config/HTTP handling retained; PATCH/helper declarations unchanged |

All public DTOs/enums, Orders list/create use cases/adapters, Orders image/mutation/LINE flows, Shipment creation/read/link/status/Drive seams, providers/worksheets/headers, browser components/client/CSS/picker/page metadata and package/env/schema/data remain unchanged. No empty layers, generic repository or query optimization.

## Consumer-owned ports and composition

`OrderDetailReader` supplies independent `readOrders`, `readProductImages`, `readBillImages` operations. Their business handles expose `findOrder(orderId)`, `forOrder(orderId)` and `forOrder(orderId)` respectively, returning existing Orders DTOs. `OrderDetailShipmentProjectionReader` supplies independent `readLinks` and `readShipments` handles with `findShipmentIdForOrder(orderId): string | null` and `findShipmentById(shipmentId): OrderShipment | null`.

No rows/cells/worksheet names/ranges/indices/provider/config/HTTP types cross either port. Handles retain raw storage only privately in adapter closures. Promise fulfillment creates handles without inspecting or mapping rows. All conversions and entire-array mapping occur when the application invokes each business lookup. Constructors perform no worksheet property access or IO.

Orders application/server import no Shipment module/contract/implementation, including type-only. The Shipment adapter imports the specific Orders-owned port and public OrderShipment DTO, its own ShipmentStatus and erased Sheets types. This permitted dependency is Shipments → Orders. The app GET can import both modules and inject the adapter; neither feature imports the app route/composition.

The legacy direct leaf is an explicit temporary compatibility composition outside `modules/orders`: it constructs the same concrete Shipment adapter and calls Orders server detail. This does not duplicate a mapper or add an Orders-module reverse edge. Orders module code must never import this facade as a hidden route back into Shipments. Retire the bridge only in a separately reviewed legacy-export migration after all consumers/contracts migrate. The unchanged barrel still exposes the same direct function and OrderListItem/OrderProductImage/OrderBillImage/OrderDetail types. listOrders still forwards the original named server operation.

Legacy input remains exactly `{ googleSheetsService: IGoogleSheetsService; orderId: string }` with `Promise<OrderDetail | undefined>`. The separate named module server input adds required `shipmentProjection`; callers explicitly supply the consumer port. It is not the same composition signature/function as the legacy wrapper. The server page/client/picker remain byte-identical and pass only orderId across React serialization; no projection function enters the client graph.

## Five-read concurrency and deferred phases

Application uses one flat Promise.all of five independent port operations, preserving actual call evaluation order:

1. orders.readRows("A:I").
2. orderItems.readRows(), default A:J.
3. orderBills.readRows(), default A:G.
4. shipmentOrders.readRows(), default A:G.
5. shipments.readRows(), default A:M.

Read-start methods deliberately are not async: worksheet getters/methods run synchronously before Promise wrapping, so a synchronous failure stops later expressions rather than becoming a rejection that starts extra reads. Native promises are uniformly wrapped only to create business handles; no nested Promise.all, eager mapping, batching/cache/conditional Shipment lookup/retry or sixth read. Missing Orders still initiate all five reads. Deferred tests and every pair of immediate/microtask native rejections compare original winners/error identity.

After all reads: map the entire Orders collection then find its first valid match; if absent, return undefined without inspecting links/images/Shipments. Otherwise reverse-scan links, then map/filter all product images, then bills, then map the entire Shipment collection/find its first valid matching record only when Shipment ID is truthy. The full maps deliberately preserve errors after an earlier valid match. Malformed collections and iterator/getter failures remain deferred to those original phases. Original local names are retained so native malformed-map TypeError text also stays unchanged.

## Exact link, mapping and DTO rules

Latest active matching Order link wins. Reverse traversal retains original destructuring and normalization; a newest active match with blank Shipment ID returns null without falling back. Link IDs need not be valid/nonempty, existence is not checked during link search, and a non-null unknown/deleted Shipment ID can coexist with shipment=null. This differs from Orders list grouping, Shipment list per-Shipment association and Shipment linking's valid-link-ID rules; none is reused.

Shipment mapper retains all thirteen input columns, required normalized ID/status/PO, five existing enum statuses and deleted-row exclusion. It returns only the original nested OrderShipment fields, including deletedAt in the original object key order; no costs/linked Orders/product images/status flags. Duplicate Shipment rows select the first valid mapped match after mapping the entire array. The richer Shipment list reader omits deletedAt and has different reads/associations, so it is not a substitute.

Order/product mapping reuses the byte-identical existing Orders mapper; bill mapping moves unchanged within Orders infrastructure. Shipment's detail-specific mapper moves to its own adapter with only the declared return type changed from Shipment to OrderShipment. The two pure converters are deliberately duplicated feature-locally rather than importing Orders private infrastructure: exact original bodies/signatures are checked. toStringValue trims strings/stringifies numbers and booleans only; toPrice retains finite numbers/comma parsing/null and native precision. No coercion of objects, money/quantity recalculation, rounding or zero defaults.

OrderDetail, OrderShipment and all public contracts are byte-identical. Product/bill ordering, quantity/code strings, timestamps, null prices/fees, shipmentId/string-or-null and unresolved nested null remain exact. Supplied orderId is not newly normalized in application; HTTP retains original trim.

## HTTP and historical evidence

GET retains await params/trim/validation inside original try, getConfig→Sheets construction, one query, 200 {order}, 400 Order ID is required., 404 Order not found., 500 Failed to load order. and original logging/error conversion. Only import/query composition changes. Every PATCH/helper declaration and runtime=nodejs remain unchanged. Browser URL encoding/no-store/signal/guards, UI/page metadata and picker are untouched.

New `tests/fixtures/orders-detail-before.json` captures original full legacy source/raw hash, five declaration hashes, original body, mapping source/declarations, complete route/source/helper hashes, original server source/declarations, golden detail/missing examples and exact read traces. Eight characterization tests ran on untouched production code before extraction.

The existing orders-seam-preserved.json body hash `7a863b4ebdd1220a8e7f250978f5fc644f19656f95a286b2fe88e3abdadff293` is retained and verified against saved original source, not regenerated. Exact moved findShipmentIdForOrder/isShipmentStatus/bill mapper declaration hashes remain. Shipment mapper body and feature-local converter bodies/parameters match original ASTs; only ownership-related return type/export visibility differs. The one intentionally changed orchestration is verified through executable old/new parity. Existing list/create server source bodies stay exact; PATCH/helpers retain hashes.

Two inherited Shipment raw-server preservation loops also record the old Orders server hash; only that exact key gains reviewed saved-original-source/function checks. The old Orders server-boundary raw hash is likewise preserved; a surgical AST comparison removes only three reviewed new scopes/three server imports and requires every previous rule to remain exact. All other loop entries remain strict. Existing fixtures, routes, browser/CSS/contracts and PR 9–13 historical values are byte-identical. No blanket skip or new golden expectations to bless changed behavior.

## Tests, boundaries and limitations

All 317 inherited tests remain; added coverage comprises eight pre-extraction characterization, nine application/adapter/parity/transport/HTTP tests and five boundary/graph tests (22 added). Tests run actual application and both adapters, legacy composition, real GET/PATCH and actual five worksheet classes/BaseGoogleSheet/GoogleSheetsClient with fake auth/fetch. They compare complete JSON, malformed rows/messages, immediate/deferred rejection order, raw iterator/getter error identity, all statuses/fees/duplicates/links/images, five-call/default-range/concurrency/no-retry behavior, encoded/quoted GET URLs and export/type compatibility.

Scoped rules permit only own contracts/ports in new Orders application, pure Sheets interfaces/own mapper/port in its adapter, and own Shipment contracts plus the exact Orders public port/DTO in projection adapter. They reject reverse Shipment/legacy/provider/config/framework/Node/private/dynamic/type/re-export paths without widening existing create/list/Shipment scopes. Resolved graphs of all Orders/Shipment module files are runtime/type-acyclic with no Orders → Shipments edge; browser ownership remains only Shipments → Orders and server-free. The narrow facade is explicit outside core ownership, not a hidden barrel workaround.

[Verification](verification.md) records baseline/final commands, counts, warning and identical build manifests. Only this detail projection slice is complete. Physical ShipmentStatus definition transfer and broader Orders/Shipment legacy retirement remain deferred. No Supabase/auth/tenancy/billing, provider/schema/env/data changes, production calls, operational scripts, approval, merge or deployment. Offline evidence does not establish live Google permissions/availability, concurrency guarantees or real-browser visuals.
