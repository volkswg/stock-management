# Shipment status-update seam (PR 12)

Base: `ffb14fa63842efdc705de6709ae1efd3df13cd25`, verified latest main and PR 11 squash merge with no intervening commits or unrelated pending changes. Branch: `refactor/shipments-status-seam`. Only status-update ownership changes. The full Shipments milestone remains incomplete.

## Callers, files and exports

The only production server caller is PATCH `app/api/shipments/[id]/route.ts`, importing `updateShipmentStatus` from the unchanged `services/shipments` barrel. Direct source imports, type imports, fixtures, closed loaders and service/HTTP/ownership tests were reviewed. Browser `advanceShipmentStatus` remains an unchanged HTTP operation, not an application import.

| File | Responsibility / public names |
| --- | --- |
| `modules/shipments/application/update-shipment-status.ts` (new) | `updateShipmentStatus(input, dependencies)`, `UpdateShipmentStatusInput`, `UpdateShipmentStatusDependencies`, original `UpdateShipmentStatusResult`; fee precheck, transitions/PO validation, clock/field decisions and returned DTO |
| `modules/shipments/application/ports/shipment-status-store.ts` (new) | Consumer-owned `ShipmentStatusStore`, opaque `ShipmentStatusTarget` |
| `modules/shipments/infrastructure/google-sheets/shipment-status-store.ts` (new) | Guarded `GoogleSheetsShipmentStatusStore`; original setup writes/read, lookup/destructuring, deferred storage normalization and exact preserved-cell update |
| `modules/shipments/server.ts` (extended) | One named status composition function; existing create/list/detail/link declarations and bodies unchanged |
| `services/shipments/updateShipmentStatus.ts` | Named function re-export from server, result type from application, original ShipmentStatusUpdate type from public contracts |
| Legacy barrel, public/legacy contracts, PATCH handler, providers and UI | Byte-identical, no relocation or export changes |

Direct legacy function === barrel function === named server function. Original parameter shape remains `{ deliveryFee?, googleSheetsService, poNumber?, shippingBillUrl?, shipmentId, status }`; result stays `Promise<UpdateShipmentStatusResult>`. Its union remains updated with the original ShipmentStatusUpdate DTO, not_found, invalid_transition, invalid_delivery_fee, invalid_po_number. No new outcome or error conversion. ShipmentStatus still has one runtime object in its existing pure legacy definition, forwarded by public contracts.

## Port and ordering rationale

`ShipmentStatusStore.prepareStatusUpdate(shipmentId)` returns `Promise<ShipmentStatusTarget | undefined>`. It is the exact workflow preparation capability, including the existing header side effect, not a generic CRUD read or optional initialization. It must never be invoked on an invalid delivered fee.

The opaque target exposes six deferred normalized business accessors: `readCurrentStatus`, `readPoNumber`, `readShippingFee`, `readShippedAt`, `readDeliveredAt`, `readShippingBillUrl`, plus `saveStatusUpdate(update: ShipmentStatusUpdate): Promise<void>`. No worksheet arrays/cells/indices/ranges, raw preserved fields, transport/config/auth or tenant types cross the port. The adapter privately retains selected raw values and data position for persistence.

This split preserves inspection precedence. Preparation retains the original findIndex callback and complete selected-row destructuring before transition checks, including iterator/getter failures on otherwise unused fields. The accessors defer String/number conversion until the application reaches the original point. Eager normalization would incorrectly move stored-field conversion failures before validation or the clock. Raw untouched cells stay in the adapter and are never normalized through the business port. Neither constructor nor dependency composition accesses worksheet properties or performs IO.

Application invocation order is fee precheck → prepare → current status → transition validation → Shipping PO validation → one clock → conditional PO/fee/shipped/delivered/bill accessors → save → successful DTO. Unused conditional conversions are skipped exactly as before. Successful result construction remains after awaited persistence, using local values rather than returning the writer's argument object.

## Exact setup, selection and storage

For every request passing the delivered-fee precheck:

1. Await `shipments.updateRows("M1", [["shippingBillUrl"]])`.
2. Only after fulfillment, await `shipments.readRows("A2:M")`.
3. Run the original findIndex: destructure ID/deletion marker, compare `String(id ?? "").trim()` to the supplied untrimmed Shipment ID and require empty `String(deletedAt ?? "").trim()`.
4. Select the first active matching row, then perform the original thirteen-position destructuring in original order.
5. After application validation/calculation, write one twelve-cell B:M row at the privately retained index + 2.

There is no stricter list-row/status/PO validation at lookup, latest-duplicate selection, batching, cache, retry or additional read. Missing/deleted rows return not_found after setup; invalid transition and invalid PO retain those same header/read side effects. These outcomes perform no B:M write or clock call. Invalid delivered fee performs no operations at all. Header failure prevents read; read failure prevents data write; data failure rejects without updated success, rollback or compensation. Original synchronous getter/read/write and asynchronous rejection objects/timing order remain characterized.

The twelve B:M values remain, in order: status; raw carrier ?? ""; updated PO; shipping fee; raw remark ?? ""; shippedAt; deliveredAt; raw createdAt ?? ""; updatedAt; raw deletedAt ?? ""; raw createdBy ?? ""; updated bill URL. Untouched whitespace, booleans, numbers, false/zero and nullish defaults are retained. Column A is never written. Existing thirteen headers A:M, worksheet class, USER_ENTERED mode and provider implementations are unchanged. M1 is deliberately retained as a per-call write, not moved to schema initialization.

## Business invariants

| Current | Next allowed |
| --- | --- |
| Draft | ReadyToShip |
| ReadyToShip | Shipping |
| Shipping | Delivered |

Every other transition, including repeats/backward/Canceled/unknown stored status, returns invalid_transition before Shipping PO validation. Shipping requires nonempty `poNumber?.trim()` and original untrimmed length <=100; save the trimmed value. Other transitions retain trimmed stored PO. No PO master lookup or new entity/validation is added.

Delivered fee precheck rejects undefined, NaN, infinities, negatives and >1,000,000,000 before any port/clock call. Zero and the inclusive upper bound remain valid. No extra fee validation for other statuses. Non-Delivered stored fee retains the original exact `toNumber` helper: finite numbers, comma-stripped numeric strings, null for empty/invalid/non-finite/unsupported values. No rounding/default zero/currency changes.

Clock is injected and called exactly once after all checks. Production supplies `() => new Date().toISOString()`. Shipping sets shippedAt; Delivered sets deliveredAt; updatedAt uses that one value. Other timestamps retain original trimmed storage values. No ID generation, Date/random/env/provider/HTTP access exists in application.

Shipping uses trimmed supplied bill URL or empty string, including clearing an old URL when omitted. Other transitions retain trimmed stored URL. Returned DTO keys/order/nullability remain exactly status, poNumber, shippingFee, shippedAt, deliveredAt, updatedAt, shippingBillUrl.

## PATCH and Drive remain at HTTP boundary

`app/api/shipments/[id]/route.ts` stays byte-identical: runtime=nodejs, route ID trimming, JSON/multipart parsing/validation/error messages, PO confirmation, delivery fee checks, PDF/JPEG/PNG/WebP and inclusive 10 MiB file rules, filename sanitization/extensions/Date.now, Buffer conversion, Drive 503 and upload ID/webViewLink handling all remain.

Upload precedes status mutation. Nonupdated outcomes and thrown errors clean up uploaded files; cleanup failure is logged without replacing the final response; successful updates do not delete files. Existing 200/400/404/409/500/503 responses, partial-write behavior and logging stay intact. No Drive logic enters application or the port. The M1 header can already be written when a later operation fails; this PR adds no atomicity guarantee.

## Historical evidence and tests

Before production changes, `tests/fixtures/shipments-status-before.json` records the verified base, complete original source/raw SHA-256, signature/result declaration, all three original function declaration hashes, golden success/rejection/error outcomes and exact worksheet events, plus all four original server composition declarations. Eleven new characterization tests pass against that original implementation first.

The original `shipments-structure.json` and all prior fixtures remain byte-identical. Exactly three additional historical keys are reviewed: updateShipmentStatus → application (orchestration; original hash retained, executable original/new parity); isValidTransition → application (exact declaration hash); toNumber → adapter (exact declaration hash). Earlier PR 9/10/11 exceptions remain active. No broad skip or fixture regeneration. Additional AST assertions preserve the fee precheck, original return union/success literal, exact findIndex/selected-row destructuring, M1 payload and raw untouched-cell expressions; existing four server function sources are compared byte-for-byte.

The new suite adds eleven characterization tests, fourteen seam/history/transport/HTTP tests and five boundary tests. It executes real production application/adapter/composition with fake business ports/Sheets, and saved-original source comparisons on malformed rows/collections and price edge cases. Tests cover complete transition matrix, boundaries/PO/clock/accessor ordering, proxy/iterator/getter failures, first-active duplicates, deferred writes/error identity/no retries, actual raw cell preservation, export/enum identity and absence of ID generation. The closed loader adds only the three exact new seam files, retaining deterministic clock/ID and earlier seam execution; arbitrary config/provider/Drive/private Orders files remain rejected.

Actual transport tests instantiate ShipmentsSheet, BaseGoogleSheet and GoogleSheetsClient with fake auth/fetch, verifying encoded/quoted URLs, ordered M1 PUT → A2:M GET → B3:M3 PUT, original JSON bodies and USER_ENTERED, with each failure phase stopping subsequent requests. The actual unchanged PATCH handler executes new production composition for JSON updates and multipart Drive-before-Sheets/cleanup cases at header/read/data-write failure and nonupdated outcomes. Inherited tests still exercise all file types/rejections, exact 10 MiB acceptance, Drive unavailable/upload failure, cleanup/logging, all HTTP outcome mappings and successful upload retention.

## Boundaries, verification and deferred work

Exact status-file ESLint scopes permit only own contracts/port in application, own contracts in port, and server-only/erased pure Sheets interfaces/own contracts/port in adapter. Server adds only explicit application/adapter imports. Earlier creation/read/link and browser scopes remain unchanged. Positive/negative fixtures cover aliases, relative/type/re-export/dynamic/require/import-type paths, provider/config/Drive/app/UI/framework/Node imports, direct application Date/random/env/IO and non-erased interfaces. Runtime and type-only graphs stay acyclic; browser graphs reach no server/application/provider; ownership remains Shipments → Orders with no reverse edge.

[Verification](verification.md) records final counts/commands, clean credential-free builds and byte-identical app-paths manifest. All 23 page and 35 API route source contracts and original route fixture remain unchanged. Apart from the server entrypoint and narrow legacy status facade, every existing production file is byte-identical, including create/list/detail/link, Orders projection, UI/CSS/browser client, barrel/contracts/enum/ID utility and provider classes. No dependencies/lockfiles/env/schema/data changes.

Only this status seam is complete, not the full Shipments milestone. Drive workflow extraction, Orders server detail projection, physical enum ownership and eventual legacy facade/barrel/utility cleanup remain future tasks. No Supabase/auth/tenancy/billing, production records, live Sheets/Drive/LINE/Loyverse, operational scripts, approval, merge or deployment are included. Synthetic verification does not establish live provider permissions/availability, concurrency safety or real-browser visual parity.
