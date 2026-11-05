# Shipment order-linking seam (PR 11)

Base: `d4e512bc2f3d5273231f174dd117ea507ccb4850`, verified latest main and reviewed PR 10 merge, with no intervening commits. Branch: `refactor/shipments-link-seam`. Only server-side order linking is extracted; the full Shipments milestone remains incomplete.

## Caller and export audit

The only production server caller is POST `app/api/shipments/[id]/orders/route.ts`, importing the unchanged `services/shipments` barrel. Its `instanceof LinkOrderToShipmentError` branch is retained. The browser function of the same name in `modules/shipments/ui/api.ts` remains an unchanged HTTP client, consumed by the stable Orders app client composition. No UI, app route, HTTP validation or browser port changes are made.

| File | New ownership / compatibility |
| --- | --- |
| `modules/shipments/application/link-order-to-shipment.ts` (new) | Named application `linkOrderToShipment(input, dependencies)`, original `LinkOrderToShipmentError` class, error-code/result types, `LinkOrderInput`, `LinkOrderDependencies` |
| `modules/shipments/application/ports/shipment-order-link-store.ts` (new) | `ShipmentOrderLinkStore`, `ShipmentLinkSnapshot`, `ActiveShipmentCandidate`; consumer-owned business operations |
| `modules/shipments/infrastructure/google-sheets/shipment-order-link-store.ts` (new) | Guarded `GoogleSheetsShipmentOrderLinkStore`, original row helpers and A:G append mapping |
| `modules/shipments/server.ts` (extended) | One named link composition function using the supplied Sheets service, existing ISO clock and original sortable ID utility; existing three functions remain byte-identical |
| `services/shipments/linkOrderToShipment.ts` | Narrow named re-exports: function from server, class/result/error-code types from application, ShipmentOrder type from public contracts |
| `services/shipments/index.ts`, link API handler | Byte-identical imports/exports/implementation; reach the same function and class |

Direct legacy function === barrel function === server composition function. Direct error class === barrel error class === application error class. Its original constructor/body, `code`, name and message semantics remain unchanged. No second class, wrapped errors, generalized error hierarchy or browser-facing error contract is introduced. Original public input (`googleSheetsService`, `shipmentId`, `orderId`, `createdBy`) and `Promise<LinkOrderToShipmentResult>` remain structurally identical; ShipmentOrder remains the original seven-string-field DTO and `created` remains boolean.

## Business port and deferred inspection

The application input is `{ shipmentId: string; orderId: string; createdBy: string }`; dependencies are `{ store, now: () => string, createId: () => string }`.

`ShipmentOrderLinkStore` owns exactly:

- `readLinkSnapshot(): Promise<ShipmentLinkSnapshot>`.
- `appendShipmentOrder(record: ShipmentOrder): Promise<void>`.

The snapshot exposes `findActiveShipment(shipmentId)`, `hasActiveOrder(orderId)`, and `findLatestActiveLink(orderId)`. A found `ActiveShipmentCandidate` exposes only `readStatus(): string`. No worksheet arrays/cells/column positions/ranges, provider/service/auth/config/HTTP objects, or tenancy assumptions cross the port.

Deferred lookup methods are intentional. The adapter privately closes over the original returned worksheet arrays without eagerly decoding them. Application invokes lookup methods in the original order and only requests status after duplicate/conflict handling. Eagerly mapping a snapshot would inspect malformed Orders/links/status getters too soon and could replace the original error with a different failure. Snapshot construction and adapter construction perform no row inspection; constructor also accesses no worksheet getter. Raw arrays remain entirely inside infrastructure, not in the business contract.

## Original reads, decisions and errors

`readLinkSnapshot()` retains one Promise.all with exactly these expressions, in evaluation order:

1. `shipments.readRows()` (existing provider default A:M).
2. `orders.readRows("A:I")` (explicit range, never Orders' broader default).
3. `shipmentOrders.readRows()` (existing provider default A:G).

All reads start concurrently and must fulfill before decisions. Synchronous worksheet getter/read failures stop evaluation of later expressions, as before; each asynchronous rejection propagates its original object. There is no batching, cache, short-circuit based on status, additional read, transaction or retry.

Application decision order remains:

1. Find the first active Shipment with matching normalized ID and empty normalized deletion marker. No status/PO validation. Missing/deleted Shipment wins before any Order/link inspection.
2. Check an active Order with `.some`, matching normalized ID and empty deletion marker. Its status is deliberately not validated. Missing/deleted Order wins before link inspection.
3. Traverse link rows backward with the original helpers. Require nonempty link/Shipment/Order IDs, ignore deleted links, preserve historical string normalization, and return the first valid matching Order link from that reverse traversal. Invalid-field rows skip; genuinely non-iterable rows still throw at their original inspection point.
4. Existing same-Shipment link returns that same mapped record with `created: false`, without status/clock/ID/write. This holds for Shipping/Delivered as well.
5. Existing other-Shipment link conflicts before eligibility/status inspection.
6. With no active link, inspect status. Only Draft and ReadyToShip permit a new link.

| Code | Exact message | Existing HTTP mapping |
| --- | --- | --- |
| `shipment_not_found` | Shipment not found. | 404 |
| `order_not_found` | Order not found. | 404 |
| `order_already_linked` | Order is already linked to another shipment. | 409 |
| `shipment_not_linkable` | Orders can only be linked to draft or ready-to-ship shipments. | 409 |

The latest valid active link is deliberately different from the list reader's first-occurrence grouping per Shipment. No shared mapper consolidation, latest-global-unique constraint or Orders-detail rewrite is introduced. Duplicate Shipments retain first-active-row selection; malformed rows/getters keep their inspection/failure precedence.

## Record, clock and storage invariants

After all checks: read the clock once, generate ID once, construct `{ id, shipmentId, orderId, createdAt, updatedAt, deletedAt, createdBy }` in original field order, await one append, then return `{ shipmentOrder, created: true }`. The same clock string fills both timestamps. No application trimming of IDs/actor, extra validation, default actor or ID override is added. Clock/ID failure performs no append; append failure propagates unchanged without retry/rollback/compensation/false success.

Server composition supplies `now: () => new Date().toISOString()` and unchanged `createSortableId`; its original module-level clock/random/sequence behavior remains. Application uses neither directly. The lazy adapter uses `Pick<IGoogleSheetsService, "shipments" | "orders" | "shipmentOrders">`, importing the interface only as an erased type from the pure existing types file. No service/config/auth/transport construction occurs.

Append is exactly one `shipmentOrders.appendRows(getShipmentOrdersAppendRange(), [[id, shipmentId, orderId, createdAt, updatedAt, deletedAt, createdBy]])`. Original range helper still derives `A:${lastColumnLetter(SHIPMENT_ORDERS_SHEET_HEADERS.length - 1)}`, evaluating to A:G with unchanged seven headers. The existing provider retains USER_ENTERED and INSERT_ROWS. No updateRows, extra read or write on idempotent/conflict/invalid outcomes is added. The check/write remains nontransactional and does not promise stronger concurrency safety.

## Historical evidence and regression tests

Before extraction, `tests/fixtures/shipments-link-before.json` captures complete original source/raw SHA-256, all five function hashes, original function signature, class/error-code/result declarations, actual synthetic success/idempotent JSON and read/append events, plus original three server composition declarations. Ten new characterization tests pass against the original implementation before production edits.

The old `shipments-structure.json` stays byte-identical. Exactly five declarations receive migration handling: `linkOrderToShipment`, `findLatestShipmentOrder`, `mapShipmentOrderRow`, `getShipmentOrdersAppendRange`, `toStringValue`. The four helpers retain their entire original declaration hashes at the adapter destination. The changed orchestration retains its historical hash/source and is verified by original-vs-new executable comparisons, lookup-sequence tests and exact class/type/mapping AST checks. The original class and two public type declarations are identical. Original seven append expressions/range-call ASTs and the three existing server function source declarations are compared exactly. No old fixture/hash regeneration or blanket skip; PR 9 creation and PR 10 read-history checks remain active.

Final suite: 261 pass = all 235 inherited plus 26 added (ten characterization, eleven seam/history/HTTP/transport, five boundary). Only necessary inherited structural assertions change: server now has four named functions, its closed graph includes three link files plus the explicit pure link header constant, and five exact historical declarations move. All other expectations and fingerprints remain.

Tests run pure application with fake business ports, actual application/adapter/server with fake Sheets, and the saved original source for malformed-data/error/event parity. Coverage includes concurrent/deferred reads, synchronous evaluation short-circuiting, async error identity, missing/deleted existence priority, deferred status, arbitrary Order status, first active Shipment, latest valid links, same-link identity/idempotency, conflict-before-status, allowed/rejected statuses, historical normalization, clock→ID→append order, actor/ID preservation, pending success and all failure phases without retry. The closed loader adds only the three new link files and explicit pure header constant; deterministic clock/ID and all earlier seams remain loadable. Config/auth/Drive/private Orders/arbitrary files remain rejected.

The actual unchanged HTTP handler executes new production services for 201 new/200 idempotent, all four class-based 404/409 mappings, existing malformed JSON/ID validation 400, unexpected append 500 and original error logging. Actor remains web and route-only ID trimming remains intact.

Real adapter transport tests instantiate ShipmentsSheet, OrdersSheet, ShipmentOrdersSheet, BaseGoogleSheet and GoogleSheetsClient with fake auth/fetch only. They verify three ordered GETs, quoted/encoded worksheet/spreadsheet names, A:M/A:I/A:G, exact seven-cell append JSON, USER_ENTERED/INSERT_ROWS, no write for same/conflict and failed append without retry. No live authentication or requests occur.

## Boundaries, verification and remaining work

Exact new ESLint scopes allow only own contracts/port in application, own contracts in port, and server-only/erased Sheets types/explicit original constants/own contracts/port in adapter. Server composition permits the exact two new owned imports alongside original ID wiring. Original creation/read and browser scopes remain unchanged. Tests reject alias/relative/type/re-export/import-type/dynamic/require bypasses, private Orders/provider/app/config/framework/Node dependencies and direct application Date/random/env/IO. Guards are explicit, port imports are erased, and graphs include runtime and type-only edges.

The closed composed server graph remains file-acyclic. Browser graphs remain server-free and ownership remains Shipments → Orders only; no reverse Orders feature edge, hidden app shim or enum duplication is added. Public/legacy enum/DTO source remains byte-identical. [Verification](verification.md) records commands/build results and unchanged route manifest.

Only this link seam is complete. Creation/read/detail/status use-case behavior, all routes/UI/CSS/browser clients/Orders picker, provider classes, headers/ranges/modes, package/env/lockfiles and data remain unchanged. Remaining work is status/Drive orchestration, Orders detail five-sheet projection, physical enum ownership and eventual legacy facade/barrel retirement. No Supabase/auth/tenancy/billing, schema/data changes, merge or deployment is included.

Synthetic tests do not establish live Google permissions/availability, real-browser visual equivalence or concurrency safety. No live Sheets/Drive/LINE/Loyverse, production credentials/data, operational scripts or deployment were used.
