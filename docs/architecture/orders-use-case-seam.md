# Orders use-case seam (PR 4)

Base: `a29396dc5d597b8ac7e40e95d9bb2ab652e59e4c`, confirmed as latest main and the merge of PR 3. Branch: `refactor/orders-use-case-seam`. Exactly two use cases are extracted: list read and simple creation. Detail, draft creation, images, other mutations and shipment workflows are not migrated.

## Caller audit before extraction

| Caller / entrypoint | Existing path retained |
| --- | --- |
| `app/api/orders/route.ts` | GET imports `listOrders`, POST imports `createOrder` from the legacy barrel; validation, response translation and `createdBy: "web"` stay unchanged |
| `services/orders/createOrderWithImages.ts` | Imports `createOrder` and `CreatedOrder` from `./createOrder`; uploads complete before this call, then image references are written |
| `app/api/orders/with-images/route.ts` | Calls the unchanged image workflow, which reaches the compatibility creation entrypoint |
| `app/api/orders/[id]/route.ts` | Imports `getOrderDetail` and the existing update service from the unchanged legacy barrel |
| `services/orders/index.ts` | All named exports remain byte-identical, including read/detail/create/status/type surfaces |
| LINE handlers / other server barrel consumers | LINE creates drafts through `createDraftOrder`, not simple `createOrder`; its existing imports and implementation stay unchanged |
| Orders UI `ui/api.ts` | Its separate browser `createOrder`/`getOrders` HTTP functions remain unchanged; no application/server import is introduced |

Searching all source imports/call references found no other direct simple-create/list/detail callers. Tests loading legacy source are retained with updated offline dependency wiring and unchanged assertions.

## Implemented files and interfaces

| File under `src/modules/orders` | Responsibility |
| --- | --- |
| `application/ports/order-list-reader.ts` | Consumer-owned `OrderListReader.readOrderList(): Promise<OrderListItem[]>`; returns fresh mapped records in persistence order, never worksheet rows/ranges |
| `application/ports/created-order-writer.ts` | Consumer-owned `CreatedOrderWriter.appendCreatedOrder(order: CreatedOrder): Promise<void>`; persists one business record |
| `application/list-orders.ts` | Executes the read port and preserves the final `reverse()` display rule |
| `application/create-order.ts` | Owns `CreateOrderInput`, normalization/status selection, clock/ID invocation and await-before-success; dependencies are writer, `now(): string`, `createId(): string` |
| `infrastructure/google-sheets/order-list-reader.ts` | Implements the read port with the same three `Promise.all` reads/ranges, grouping and last-valid-link resolution in original order |
| `infrastructure/google-sheets/order-row-mapping.ts` | Single implementation of existing Orders/item/price/string/status mapping; reused by the unmigrated detail service |
| `infrastructure/google-sheets/order-writer.ts` | Implements the write port using the existing orders sheet's append operation; range still derived from the existing headers, nine values in original order |
| `server.ts` | Explicit `server-only` named composition entrypoints `listOrders` and `createOrder`, preserving the legacy input/output shapes and injecting existing Sheets adapters, Date clock and sortable ID generator |

No generic repository, DI container, additional persistence provider, domain directory or unused layer was created. The read port is a business query, not a renamed worksheet API. Its adapter handles storage representation; the application handles display reversal. The writer receives a `CreatedOrder` record, not row arrays. Clock/ID functions are required by the application and supplied by server composition, making application tests independent of Node/Google/Next.

The new server entrypoint and all adapter/mapping files import `server-only`. New application files import only their own contracts and consumer-owned ports. Adapters import only existing Sheets interfaces and explicit constants, not the aggregate service implementation or private shipment business code. No new Orders ↔ Shipments cycle is introduced.

## Compatibility and exact behavior

`services/orders/createOrder.ts` re-exports the composed creation function and the original contract type. `services/orders/listOrders.ts` re-exports composed listing, retains its existing DTO exports, and keeps `getOrderDetail` plus its detail-only helpers in place. Common row-mapping helpers were extracted once so list/detail do not maintain duplicate behavior. The detail orchestration body is unchanged and fingerprinted against the base. The barrel and image/draft implementations remain byte-identical. Routes require no changes.

Read behavior preserves `orders.readRows("A:I")`, `orderItems.readRows()` and `shipmentOrders.readRows()` in the original `Promise.all`, trimming, deletion/status checks, price parsing, image order, duplicate IDs/links, malformed row behavior and final reverse. The port returns mapped DTOs without changing field names/nullability.

Creation preserves one clock read before optional ID generation, `id?.trim() || createSortableId()`, missing/null prices as null, zero as valid, statuses, seller/remark trimming, untouched createdBy, identical timestamps and empty deletedAt. Adapter construction performs no IO or sheet property reads; the existing orders sheet is accessed at the append after record creation. Exactly one append is awaited; no validation, retry, transaction or compensation is added. The existing transport retains USER_ENTERED behavior, including literal inputs that Sheets may interpret under that mode.

The unchanged image workflow still uploads both image kinds before simple creation and writes image references afterward. Upload failure cleans up successful uploads without creating an order. An order/reference storage failure retains the existing partial-write/no-cleanup behavior. Those semantics are characterized rather than repaired.

## Verification and remaining work

All 44 baseline tests, lint, typecheck and a credential-free build passed. Fifteen additional characterization tests passed on legacy functions before extraction; their outputs/error expectations remain unchanged afterward. Additional application/adapter/transport/boundary tests bring the final suite to 68. Compile-time checks retain legacy parameter/return compatibility. Actual API handlers are exercised with fake services for collection 200/201/400/500 and detail 404/409 outcomes; existing detail and image/API tests remain intact. See [verification](verification.md) for final command results, manifests and limits.

Remaining imports and removal criteria:

- The two legacy entrypoints and barrel remain until their API/image/server callers migrate to documented module entrypoints in a separately scoped Orders task. No compatibility export is deleted in this PR.
- Detail's private row-mapper import remains within Orders ownership until a future detail-use-case migration; detail-specific shipment/bill mapping remains legacy.
- `server.ts` uses the existing `services/utils/createSortableId` implementation; move it to the planned shared server utility only in a later utility migration, preserving its state/clock semantics.
- The pure shipment enum/browser-client bridges remain unchanged through PR 5. PR 5 is the future Shipments migration, not an extension of this seam.
- Remaining Orders mutations, drafts and LINE workflow compatibility stay for later Orders/LINE work. No claim of full Orders service migration is made.

No live provider, production data, env credentials, schema change, browser redesign, merge or deployment is used. Fake-port/transport tests do not verify real Google permissions, provider availability, browser visuals or concurrency guarantees. Existing Sheets limitations remain unchanged.
