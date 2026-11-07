# Architecture decisions and compatibility invariants

These decisions record implemented boundaries. They are constraints on structural refactors, not authorization for behavior changes. Historical source, exact hashes and test provenance live in [progress](../refactoring/progress.md#historical-evidence); current code and fixtures remain authoritative for full declarations/error text.

## Consumer ownership and composition

Define the smallest port beside its application/UI consumer. Expose business records and operations, never Google rows/cells/ranges/indices, tokens, config, File/Buffer, SDK clients, HTTP responses or tenancy assumptions. Infrastructure implements it; app or named guarded server composition injects it. Constructor/composition must stay lazy: no provider getter access, reads, file bytes, clocks or validation earlier than the original workflow.

Deferred business snapshots/opaque targets are intentional. Eagerly normalizing all rows can change getter/iterator failures and error precedence. Preserve synchronous invocation failures separately from async rejections, original error objects, pending writes, await boundaries and promise settlement ordering. Do not add retries, caching, rollback, transactions, locks or stronger idempotency guarantees.

## Public contracts and single enum identity

Orders contracts are self-contained, with OrderStatus, OrderItemQuantityType and the existing DTOs. OrderShipment owns its wire-string status union; it must not import a Shipment enum/type. Shipment contracts own eight aliases: Shipment, ShipmentListItem, ShipmentRelatedOrder, ShipmentRelatedProductImage, ShipmentQuantityCost, ShipmentCostSummary, ShipmentStatusUpdate and ShipmentOrder. They retain original fields, readonly/optional/nullability and Orders OrderStatus compatibility.

ShipmentStatus is defined once in `modules/shipments/status.ts`:

| Member in declaration/runtime enumeration order | Value |
| --- | --- |
| Draft | draft |
| ReadyToShip | ready_to_ship |
| Shipping | shipping |
| Delivered | delivered |
| Canceled | canceled |

The separate dependency-free status leaf avoided a type cycle while DTOs temporarily remained legacy. DTOs now live in contracts; the legacy types leaf forwards the exact enum/eight erased aliases. Physical/public/legacy leaf/barrel enum objects remain strictly equal, as do existing operation/error-class exports. Public Shipment runtime export keys remain exactly `["ShipmentStatus"]`. No duplicated enum, union replacement, extra runtime export or broad server barrel in browser contracts.

## Orders browser picker and UI

Orders owns a picker projection `Pick<OrderShipment, "id" | "poNumber" | "carrier" | "status">` and three operations: listLinkableShipments({signal?}), createShipmentMaster({poNumber, carrier?}) and linkOrderToShipment(shipmentId, orderId): Promise<void>. The app client wrapper owns the stable module-scope adapter. The server page passes only orderId across React serialization; no function-valued server prop, visible wrapper DOM, provider or extra effect.

List delegates to the real Shipment client with includeOrders=false and exclusions Shipping, Delivered, Canceled **in that order**, passing the same AbortSignal without sorting/mapping. Create retains input/result; link awaits the real client's response validation before resolving void. Preserve preselection, duplicate suppression, modal/PO/carrier/temporary-PO rules, state/remount keys, notifications, disabled/loading/error/retry behavior. The relocated client is the only implementation; there is no retired app-client shim. Orders/Shipment component non-import bodies, CSS, metadata/params, URLs and browser request/guard behavior remain compatibility evidence.

## Orders list and simple creation

OrderListReader.readOrderList returns a fresh mapped list in persistence order; application owns display reversal. CreatedOrderWriter.appendCreatedOrder accepts the business record. Existing create inputs/defaults, optional ID behavior, original sortable-ID utility, clock ordering, append payload and failure propagation remain unchanged. This does not extract draft/image/mutation/LINE workflows. Their original upload/write/partial-failure behavior remains separately characterized.

## Orders detail and Shipment projection

One **flat Promise.all** starts these operations in exact order, including for a missing Order:

1. orders.readRows("A:I")
2. orderItems.readRows() — no explicit argument
3. orderBills.readRows() — no explicit argument
4. shipmentOrders.readRows() — no explicit argument
5. shipments.readRows() — no explicit argument

Orders' reader exposes deferred findOrder/forOrder business handles. Its projection port exposes readLinks and readShipments returning deferred findShipmentIdForOrder and findShipmentById handles using **OrderShipment**. A Shipment-owned adapter implements that consumer port; app GET and legacy compatibility composition inject it. Orders server imports no Shipment module. Do not substitute Shipment list/detail APIs, sequential/nested reads, conditional reads, streaming finds or batchGet.

Map the entire Orders collection before selecting its first qualifying matching ID. Missing Order returns undefined without inspecting links/images/Shipments. Then reverse-scan links, map/filter product images, map/filter bill images, and finally (only for a truthy shipmentId) map the **entire** Shipments collection before finding the first qualifying match. A later malformed row still rejects even after an earlier valid match.

The newest active matching link wins; a newest match with a blank Shipment ID yields null, not fallback to an older link. Link lookup does not validate referenced Shipment existence. A non-null shipmentId can coexist with shipment:null. The nested Shipment retains all original thirteen fields including deletedAt, no orders/costSummary. Require nonblank ID/PO, recognized status and empty normalized deletion marker. Strings trim, numbers/booleans stringify, other values become empty. Prices preserve finite numbers, remove commas from nonempty strings before Number conversion, otherwise return null; zero stays zero, no rounding. Keep image order, quantities/product codes, original field order and totalPrice/shippingFee nullability. Do not import Orders private converters into Shipments; exact duplicated pure converters have historical AST evidence.

## HTTP validation and response compatibility

The backend Shipment helper retains readJsonBody (invalid JSON→undefined), isUpdatableStatus (`value is ShipmentStatus`, accepting only ReadyToShip/Shipping/Delivered), finite delivery-fee bounds 0–1,000,000,000 inclusive, and original PO whitespace/untrimmed-length rules. Draft/Canceled/unknown/nonstring statuses are rejected. Its runtime import reaches public contracts/status, never the mixed server barrel.

Shipment collection/detail/link/status routes retain request/query parsing (including duplicate/invalid excluded statuses), ID trimming, JSON/multipart, config/factory timing, logging and response wrappers. Link maps new/idempotent to 201/200; Shipment/Order absence to 404; conflict/ineligible to 409; unexpected errors to 500. Original link messages remain Shipment not found.; Order not found.; Order is already linked to another shipment.; Orders can only be linked to draft or ready-to-ship shipments.

PATCH preserves these outcome translations:

| Outcome | HTTP / error (or success wrapper) |
| --- | --- |
| updated | 200 `{ shipment: result.shipment }` |
| not_found | 404 `Shipment was not found.` |
| invalid_transition | 409 `Shipment status has changed or cannot be advanced.` |
| invalid_delivery_fee | 400 `Delivery fee must be a non-negative number.` |
| invalid_po_number | 400 `Enter a valid PO number before starting shipping.` |
| Drive unavailable | 503 `Google Drive is not configured.` |
| unexpected failure | 500 `Failed to update shipment status.` |

Preconfiguration PATCH validation retains Shipment ID and a valid next status are required.; PO number confirmation is required.; and Select a PDF, JPEG, PNG, or WebP file up to 10 MB. Orders detail GET retains 200 `{ order }`, 400 Order ID is required., 404 Order not found., and 500 Failed to load order. with original log fields. Orders detail PATCH behavior is a separate unchanged mutation; no HTTP wrapper, status, field or message is redesigned by these seams.

## Shipment creation

Application trims PO, throws exactly `Shipment PO number is required.` when empty, calls injected ISO clock once, then original sortable-ID generator once, constructs the original record, awaits one append, returns only after success. Invalid input invokes neither clock/ID nor writer. Carrier remains `carrier?.trim() || ""`; createdBy is untrimmed; status Draft, fee null, remark/timestamps/deletion/bill defaults unchanged.

CreatedShipmentWriter.appendCreatedShipment accepts Shipment. Adapter maps exactly id, status, carrier, poNumber, shippingFee, remark, shippedAt, deliveredAt, createdAt, updatedAt, deletedAt, createdBy, shippingBillUrl to A:M, using the original header-length range expression. Do not change transport USER_ENTERED behavior or ID generator module state.

## Shipment list and detail reads

Reader starts four expressions in the original Promise.all evaluation order: shipments.readRows(); conditional shipmentOrders.readRows(); conditional orders.readRows("A:I"); conditional orderItems.readRows(). For includeOrders=false, the latter three expressions remain Promise.resolve([]), only Shipments is read, orders arrays are empty and costSummary null. Status exclusions do not reduce read volume. Reader snapshot contains normalized ordered shipments without deletedAt/orders/costSummary, ordered deduplicated link-ID groups and related Orders with ordered images; no worksheet types cross the port.

Adapter excludes invalid/deleted Shipment/Order rows; within each Shipment group, links preserve first-occurrence order and deduplicate Order IDs. This is **not** global latest-link selection. Last valid duplicate Order row wins; images retain order without deduplication. Original string/number/status converters and malformed-iterable/row rejection phases remain exact.

Application awaits snapshot, builds exclusion set, filters, attaches linked Orders, calculates costs, then reverses the completed array. Detail executes that full default four-read list once, then finds the first matching ID in the reversed result (including original duplicate selection), or returns undefined.

CostSummary is null when fee is null, no related Orders or any Order price is null. Otherwise preserve reduce order, totalOrderPrice, landedTotal = price + fee, and independent quote/delivered quantity calculations. Quantities require positive finite numbers after original comma removal; empty images/invalid/zero/negative/nonfinite quantities produce null quantity results. Divide without rounding. Preserve `0.1 + 0.2`, 0.3 fee, zero totals/fees, nulls and floating-point quirks; no decimal library, toFixed, clamping or fallback price zero.

## Shipment order linking

ShipmentOrderLinkStore exposes readLinkSnapshot and appendShipmentOrder. Snapshot methods defer findActiveShipment, hasActiveOrder, findLatestActiveLink; candidate.readStatus defers eligibility inspection. Its adapter starts concurrently, in order: shipments.readRows(), orders.readRows("A:I"), shipmentOrders.readRows(). No eager mapping or extra read.

Decision order is fixed: first active matching Shipment → active Order existence (no OrderStatus requirement) → reverse-scan latest valid active link → same-Shipment idempotent result → other-Shipment conflict → Shipment eligibility. Same link returns created:false even for Shipping/Delivered; conflict precedes status. Only Draft/ReadyToShip accept new links. Original single LinkOrderToShipmentError class/name/code/message survives direct/barrel/server/HTTP instanceof checks: shipment_not_found, order_not_found, order_already_linked, shipment_not_linkable.

After checks, call clock once then ID once; preserve untrimmed IDs/actor and same createdAt/updatedAt. Await one A:G append: id, shipmentId, orderId, createdAt, updatedAt, deletedAt, createdBy. Return created:true only afterward. No writes/clocks/IDs on read-only outcomes; original errors propagate without retries. Sheet check/write remains nontransactional and is not concurrency-safe by this extraction.

## Shipment status update

Application returns exactly updated/not_found/invalid_transition/invalid_delivery_fee/invalid_po_number. Delivered fee precheck accepts finite 0 through 1,000,000,000 inclusive; invalid fee performs **no** Sheets operation or clock call. Other requests await M1 update `[["shippingBillUrl"]]`, then read A2:M, then optionally one B{row}:M{row} twelve-cell write. M1 must fulfill before read starts; missing row/invalid transition/invalid PO retain completed header+read side effects. Failures reject original errors without retry/rollback.

Opaque ShipmentStatusTarget preserves adapter-owned findIndex/destructuring/raw cells and deferred field access. Select first active row where String(id ?? "").trim() equals the unmodified supplied ID and deletion string trims empty. Do not use stricter list mapping. Only Draft→ReadyToShip→Shipping→Delivered transitions exist; no repeats/backward/Canceled transition. Transition check precedes Shipping PO check: require nonblank trimmed PO and original untrimmed length ≤100.

Clock is invoked once after valid selection/checks; same value sets updatedAt and relevant shippedAt/deliveredAt. No new ID. For non-Delivered fee, preserve finite number/comma-string parsing or null. Shipping saves trimmed supplied PO and bill URL; **omitted bill clears any previous URL**. Other transitions keep trimmed stored PO/URL/timestamps. DTO has exactly status, poNumber, shippingFee, shippedAt, deliveredAt, updatedAt, shippingBillUrl.

B:M values stay: status, original carrier ?? "", updated PO, fee, original remark ?? "", shippedAt, deliveredAt, original createdAt ?? "", updatedAt, original deletedAt ?? "", original createdBy ?? "", updated bill URL. Untouched cells retain original types, not extra normalization. Column A is never written.

## Shipping bill upload and cleanup

HTTP retains params/body parsing, validation, getConfig then Sheets construction, response translation and top-level logging. Validate before factories: actual File, nonzero size ≤10 MiB inclusive, MIME exactly PDF/JPEG/PNG/WebP; zero-byte multipart files become absent, files on non-Shipping requests are ignored. JSON Shipping without file never evaluates Drive.

Application port ShipmentBillStorage exposes lazy upload returning unavailable or original id/webViewLink metadata and cleanup(fileId). It exposes no File/Buffer/provider/HTTP type. Concrete adapter privately holds File and Drive factory. After Sheets construction, only a bill causes Drive factory evaluation; unavailable returns original 503 without status operations. Once available, construct `shipment-bill-${safeShipmentId}-${Date.now()}${extension}` with ID regex `/[^a-zA-Z0-9_-]/g`, original .pdf/.jpg/.png/.webp mapping; read type, await arrayBuffer, Buffer.from, await uploadImage. Filename time is called once at this phase. Do not copy getter-backed metadata: capture id before webViewLink. Upload/file-byte/factory failures prevent status operations.

Call existing status updater exactly once after upload. For any nonupdated outcome, await best-effort cleanup then translate original HTTP outcome; exceptions clean up then propagate the original error. Falsy IDs/no service cause no delete. Exactly one deletion attempt where required; failure logs `Failed to clean up shipment bill upload` with fileId and original error-string conversion, preserving original outcome. Success retains file. The retained cleanupAfterFailure callback also covers errors during subsequent HTTP response translation. Preserve `Failed to update shipment status` log fields. Provider-internal permission-failure cleanup remains in the unchanged Drive provider, not duplicated in orchestration.

Preserve original HTTP statuses/wrappers/error strings (200/400/404/409/500/503), upload-before-M1 order, partial header writes and possible orphaned files. No cross-provider atomicity or retries are promised.

## Shared Google transport and feature worksheets

Root transport/auth/Drive moves retained original bodies, signatures, caching/error behavior and explicit legacy forwards. Six generic Sheets types are root-owned; aggregate service/configuration/types remain legacy. Root infrastructure cannot import feature worksheets/headers. Feature classes import only root base/types/constants and own headers; pure erased interfaces must not come through mixed indexes. Registry instances, legacy exports and physical owners share constructor/prototype/header-array identities and mutation behavior.

Preserve original default/explicit ranges, quoted worksheet names, URL encoding, HTTP methods, RAW/USER_ENTERED, INSERT_ROWS, batch ordering/partial failures and no retries. Auth retains OAuth-refresh-first Drive choice, service-account fallback, scopes, JWT/RS256/base64url, exact token cache boundary and errors. Drive retains multipart/related bytes/CRLF/boundary/content lengths, access-token timing, upload/permission/delete URLs, optional public/shared-drive behavior and provider-internal failed-permission cleanup. Do not replace providers or registry while moving ownership. HR core worksheets preserve call-time header-length defaults A:I/A:L/A:G and read/append/update signatures; header arrays are neither cloned nor frozen. Original sources and synthetic calls are captured in hr-worksheets-before.json, with exact inverse import restoration and class/header/index/registry identity tests. Exact header/range table is in [migration map](migration-map.md#physical-worksheet-owners).

## Inventory employee directory prerequisite

Inventory port has listEmployees(): Promise<AdjustmentEmployee[]>; its application returns that original promise directly. HR owns independent five-field EmployeeDirectoryEntry, one lazy employees.readRows() and original header-prefix/row projection. Guarded legacy composition supplies HR's public query and an error factory for the original StockAdjustmentError("Employee storage headers do not match.", 503). HR never imports Inventory/error implementation.

Keep exactly one async row await: public query, compatibility adapter, Inventory use case and old facade return its promise without additional async adoption. Extra wrappers change simultaneous error settlement precedence. Construct error only after original failed header check. Empty rows→[], extra trailing header columns allowed, filter only truthy raw IDs; preserve id/name/status/hiredDate/terminatedDate field order, String(v ?? "") without trimming/active filtering and malformed object-without-length→[] quirk. Existing employment eligibility remains in Inventory. No employee writes, time/ID calls or changed stock algorithm. PR25 reaudits and relocates only the six core HR worksheet/header files. The reader retains its existing compatibility-header import, resolving to its own HR-owned header with no cross-feature edge. Inventory uses the public query; it never imports the private header, even through a mixed legacy registry. The actual runtime/type graph replaces the former virtual move test and retains direct/legacy/barrel negative cases.

## Deferred behavior and security work

Existing sensitive routes have no new application authentication; this refactor adds none. Sheets read/check/write is not cross-instance transactional. Some legacy LINE failures log before success responses. Preserve these as known risks rather than silently fixing them in moves. Supabase/schema/data conversion, tenancy/IDs/membership/authorization, billing/subscriptions, concurrency/retries/queues and provider replacements need separately scoped requirements and migration review. Current shop master is not a tenant model; no fake tenant columns, dual writes or transactional promises.


## Inventory core worksheet ownership

PR26 transfers only StockCountsSheet, STOCK_COUNT_HEADERS and MovementSheet. The old leaves explicitly forward the same class/header objects. StockCountsSheet retains the nine original headers (id, month, accountId, shopName, physicalCount, note, countedAt, updatedAt, updatedBy), their mutability and dynamic A:I calculation. MovementSheet retains literal A:N, readRows/appendRows/updateRows/deleteRow and direct client.deleteRow(worksheetName, rowNumber) delegation; no new validation or Movement header file. Original-source inverse substitutions preserve complete class/header declarations, not just similar output.

StockCountsSheet identity is retained through both indexes and real registry instances. MovementSheet is not a baseline aggregate export; preserve that absence while proving leaf/physical/real movement-master/detail instance identity. Preserve original readMovementRanges mapping/order, legacy master/detail schemas, default/explicit ranges, USER_ENTERED/RAW/INSERT_ROWS, payload identities, await/error timing and no retries. Existing business services and HTTP routes do not change. Synthetic old/current tests execute stock equations, save-ID reuse, adjustment reversals, movement delivery/deletion and partial-write/HTTP outcomes; they do not make these processes transactional.

The new Inventory worksheet graph imports only root generic Google transport/types and its own header. It has no LINE workflow dependency, including erased edges. The pre-existing legacy movement service still calls LINE quantity helpers; extracting that use case/parser is future work. Inventory/HR directory seams and the four known erased client debts stay unchanged. Source witness: tests/fixtures/inventory-worksheets-before.json; older history fixtures remain authoritative.


## Movement worksheet schema prerequisite

Separate the existing MASTER_HEADERS, DETAIL_HEADERS and ensureHeader declarations from mixed movement session state before relocating LINE user-state persistence. Keep the split legacy-local to avoid introducing a LINE-module dependency on Inventory private infrastructure. The new worksheet-schema leaf imports only an erased root Sheet interface; ensureHeader retains its exact supplied-sheet ensure/read/conditional-write body, payload identities, awaits and failures. It performs no IO until invoked.

State retains const aliases to the shared arrays and function, preserving mutability, function identity/name/signature, runtime export-key order and property descriptor flags. The business service changes one import. All other state/context/delivery/deletion/financial/HTTP bodies and physical worksheets remain unchanged. New tests retain original full sources/ASTs and a pre-edit real workflow/event golden; older fixtures are reconciled only through exact inverse substitutions, including the earlier PR23 type-import step.

The direct movement→state→future LINE-header dependency and two movement client erased traces disappear. The four known mixed-registry browser debts remain; a separate stock-counts→Sales→registry chain is deliberately not hidden or extracted. This is one prerequisite, not a claim that all future user-state relocation/legacy consumers are clean.


## Inventory Sales-query registry prerequisite

The PR28 gate fails on the unchanged stock-counts→Sales barrel→read query→Sheets registry→future LINE worksheet path. Implement only the dependency prerequisite and defer physical relocation to PR29. Stock counts imports the existing query leaf directly; the query imports four same-object Sales header leaves and erased pure types, so no mixed registry is evaluated through that closure.

Erased imports matter: the old Expense barrel and SalesProfitCostOverride implementation would still lead back to provider composition in the type graph. Use Expense's existing pure leaf and transfer the single original override DTO declaration verbatim to Sales contracts, forwarding its old type export. No copied DTO, changed signature, new runtime contract export, report/financial calculation, worksheet/provider move or service barrel retirement. All original non-import query declarations/functions remain exact; only the reviewed DTO declaration relocates.

New regression tests retain original complete sources, ASTs, reports and read events; restore the exact preflight failure, then prove direct/barrel/type-only regressions fail the dependency gate. Existing PR27 assertions retain their old source-backed Sales trace and now assert its named removal instead of regenerating old evidence. Four inherited erased browser debts remain; other legacy Sales/Expense/HR aggregations are still future work.


## LINE user-state physical ownership

After PR27's legacy-local movement schema separation and PR28's direct Inventory/Sales query prerequisite, PR29 moves only UserStateSheet and its const.ts to LINE infrastructure. Root Google transport stays feature-neutral. The old two paths forward the unique class/array; no provider, service, registry or business code moves.

Keep all four method bodies verbatim and change only the three necessary external import strings. Headers remain mutable; readRows computes A:H from their current length on every call. deleteRow delegates the original row number without extra validation. Constructors remain lazy and share BaseGoogleSheet/prototype identity through legacy leaves, indexes and GoogleSheetsService. The inner index does not gain a header export it never had.

Actual original/current fake-client and real-client/fake-fetch tests preserve explicit/default ranges, payload identity, pending operations, original errors, USER_ENTERED/INSERT_ROWS, quoted URLs and deleteDimension indices. Existing movement session tests retain header repair, conditional provisioning only on the original Sheets 400 invalid-range failure, batch/fallback ordering, context/save/read/delete outcomes and quota failure propagation. No new retry, stronger concurrency claim, validation or server-only marker is introduced.

The immutable `tests/fixtures/user-state-worksheet-before.json` records original sources/declarations/hashes, operations, consumer edges and prior evidence. Exact inverse imports reconcile only two historical inventory entries; all prior fixture bytes remain authoritative. Broader LINE service/quantity-rule extraction, RecordsSheet inheritance, registry retirement, four erased browser debts and the inherited payroll type cycle require separate review.


## Remaining record worksheet hierarchy

StockAdjustmentsSheet and PayrollRecordsSheet originally inherit Expenses' RecordsSheet. RecordsSheet contains only three generic row delegates, so its unchanged implementation is root transport. Expenses aliases the same constructor; its legacy path forwards through that alias. This is the minimum extraction that removes private cross-feature inheritance while preserving direct constructor/prototype equality and instanceof. Adding a feature wrapper subclass or copying the delegates would break identity or create duplicate implementations. RAW overrides stay in Inventory and HR. Expenses owns its three schemas; HR owns advance/settlement schemas; Inventory owns the adjustment schema.

The adjustment panel previously consumed reason labels from a legacy mixed schema/type leaf. Its existing reason object and DTO declarations move into Inventory's public contracts before header relocation. Only that import changes in the panel. Service exports remain named aliases, preserving public compatibility without putting worksheet headers in browser contracts. Aggregate registry, provider configuration, business rules, ordering and schemas remain unchanged.
