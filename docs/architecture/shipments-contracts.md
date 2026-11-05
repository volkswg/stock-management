# Shipment browser contracts and characterization (PR 5, first slice)

Base main: `60408c3e91ebecd0dc550bbf00464b9e6ce708d2` (merged PR 4), verified before branching to `refactor/shipments-contracts`. This implements the contracts/characterization slice only. The full Shipments milestone is **not complete**. No UI, worksheet class, use case or adapter moves in this PR.

## Public surface and temporary physical ownership

`src/modules/shipments/contracts.ts` explicitly exports:

- Runtime `ShipmentStatus`: `Draft = "draft"`, `ReadyToShip = "ready_to_ship"`, `Shipping = "shipping"`, `Delivered = "delivered"`, `Canceled = "canceled"`.
- DTO types `Shipment`, `ShipmentListItem`, `ShipmentRelatedOrder`, `ShipmentRelatedProductImage`, `ShipmentQuantityCost`, `ShipmentCostSummary`, `ShipmentStatusUpdate`, `ShipmentOrder`.

Current browser status: the [Orders-owned picker seam](orders-shipment-picker.md) removes Orders UI enum/client imports; app client composition now supplies the existing implementation. PR 8 also moves the unchanged HTTP client to `modules/shipments/ui/api.ts`, removes its app exceptions, and completes the seven-file UI/client slice. Both browser module graphs are one-way Shipments → Orders. The historical PR 5 rationale/audit below records the earlier state; physical enum ownership and server projection remain unchanged.

There is exactly one enum object, still defined in the pure `services/shipments/types.ts` leaf. The public contract forwards these names from that leaf; it never forwards the mixed service barrel. Existing DTO declarations stay there temporarily. Only `ShipmentStatusUpdate` and `ShipmentOrder` move out of IO implementations into this pure leaf; their old implementation files re-export the types, preserving direct imports and unchanged `services/shipments/index.ts` exports. No field, optionality, price/fee nullability, nested representation or JSON wrapper changes. `ShipmentRelatedOrder.status` remains Orders' `OrderStatus` type. No server outcome/error classes or speculative DTOs become public browser contracts.

This physical ownership exception is deliberate: Orders detail still imports the old enum leaf and browser Shipment client. Moving the enum into the Shipments module and forwarding it back would add a reverse Orders → Shipments module edge alongside the existing Shipments → Orders contract/gallery edge. Duplicating the enum would break identity. The leaf has only a type import from the self-contained Orders contract. Runtime and type-only file graphs remain acyclic; the pre-existing semantic Orders/Shipments coupling is retained, not claimed solved. Orders' unchanged HTTP bridge now reaches the public Shipment types through erased type imports, while its runtime enum import still terminates at the original leaf.

Removal requires a separately reviewed Orders/Shipments decoupling slice: replace Orders' enum/client imports with an Orders-owned browser picker/query interface, inject the Shipment-facing implementation at app composition, and preserve requests, messages and nested response shapes. Also replace the legacy server detail projection with its consumer-owned port. Only then physically transfer the single enum/DTO definitions, update all remaining consumers, and retire the pure legacy forwarding path when no caller needs it. Do not make Orders import `modules/shipments/contracts` as a shortcut.

## Consumer and dependency audit

| Current source | Before | After / future removal |
| --- | --- | --- |
| `app/shipments/ShipmentListPage.tsx` | Mixed Shipment barrel; Orders contracts/gallery | Shipment public contract; Orders imports unchanged |
| `app/shipments/ShipmentMobileCard.tsx` | Mixed Shipment barrel; Orders gallery | Shipment public contract; gallery unchanged |
| `app/shipments/[id]/ShipmentDetailPage.tsx` | Mixed Shipment barrel; Orders contracts/gallery | Shipment public contract; Orders imports unchanged |
| `app/shipments/shipmentListFormat.ts` | Mixed Shipment barrel; Orders contracts | Shipment public contract; formatting unchanged |
| `app/shipments/api.ts` | Mixed Shipment barrel (types only) | Shipment public DTOs; HTTP code/path unchanged |
| `modules/orders/ui/[id]/OrderDetailPage.tsx` | Pure legacy enum + `app/shipments/api` browser bridge | Byte-identical; remove in the separate decoupling slice |
| `services/orders/listOrders.ts` (`getOrderDetail`) | Mixed Shipment barrel for enum/model and legacy Shipment worksheet mapping | Unchanged; replace projection at composition in decoupling slice; initial Orders list seam has no Shipment implementation dependency |
| Three `app/api/shipments` handlers | Mixed Shipment server barrel | Byte-identical; retain until named server seam exists |
| `features/backend/shipments/utils.ts` | Mixed Shipment barrel for status validation | Unchanged server helper; migrate with future HTTP/server composition |
| `services/shipments/listShipments.ts` | Legacy Orders enum wrapper, raw Orders/items/links | Unchanged; future public Orders query seam, preserving cost/link behavior |
| Orders API/image callers | Legacy Orders wrappers → `modules/orders/server` for list/simple creation | Unchanged; no new Orders server consumer |

The complete source search includes aliases and relative imports, direct legacy type/implementation exports, app client consumers, and all `modules/orders/contracts`, `modules/orders/ui`, `modules/orders/server` references. Remaining gallery consumers are exactly Shipment list/mobile/detail. Orders route wrappers retain their module UI imports. No new cross-feature public UI export or broad barrel is introduced.

## Offline evidence

All 68 inherited tests and their expectations remain. Before production edits, 62 new characterization tests passed against original code (130 total). Synthetic list/detail expected JSON and declaration/body fingerprints were captured from that implementation, not regenerated after extraction. Nine additional contract/architecture tests bring the final suite to 139 tests, plus compile-time DTO/enum compatibility assertions.

- `shipments-services.test.mjs`: list/detail empty/populated/deleted/malformed/status/PO rows, trimming, prices, image/link grouping and duplicates, reverse/filter/includeOrders behavior, exact concurrent read invocation order/ranges and rejection; original landed-cost formula including null, zero, commas, quantities and raw floating-point division; linking error/check order, latest active/duplicate/deleted links, eligibility, ID/time and single A:G append; status progression/rejection, PO/fee bounds, raw column preservation and failures.
- `shipments-http.test.mjs`: actual unchanged handlers with fake Sheets/Drive for collection/detail/link/status 200/201/400/404/409/500/503, exact error texts, query parameters, IDs, JSON/multipart, all four accepted file types and 10 MB limits, filename sanitization, upload-before-write, cleanup success/failure/logging and unchanged partial-write behavior. Fake browser fetch tests preserve request fields, encoding, abort errors, response guards and fallback messages.
- `shipments-ui.test.mjs`: actual component functions/hooks/callbacks with fake HTTP, list loading/error/retry/abort/search/filter/pagination/expansion and desktop/mobile descriptors; detail lifecycle, status/PO/bill/fee callbacks, failure state/messages, linked orders/gallery/navigation. Existing Orders gallery tests retain keyboard/modal behavior for the same public gallery implementation.
- `shipments-contracts.test.mjs` and `.types.ts`: one enum identity through public/legacy barrels, exact strings/exports, all eight original DTO declarations, type equality, import-only UI changes, unchanged service function bodies, Orders module, routes and CSS.
- `shipments-boundaries.test.mjs`: real flat-config positive/negative tests for all five files and pure contracts, transitive runtime and type-only graphs, cycle and server reachability checks, and no direct reverse Orders → Shipments module import. Orders lint files and protections are unchanged.

Status updates deliberately retain `updateRows("M1", [["shippingBillUrl"]])` **before** `readRows("A2:M")`, including missing/rejected outcomes and failures. Successful updates retain `B{row}:M{row}` with twelve values within the existing thirteen-column schema. Shipment creation retains A:M; links retain A:G. No transport, schema, constructor, value-input mode or retry changes occur. Existing duplicate links, malformed iterable failures, zero totals, nullable costs, missing bill clearing and cleanup logging are characterized, not corrected.

## Follow-up scopes and limits

The [UI/client relocation](shipments-ui-relocation.md) is complete after PR 8: seven original files are in `modules/shipments/ui`, with the client moved byte-for-byte and no compatibility shim. PR 7's Orders-owned picker seam removed the reverse dependency first. Original contract exports and runtime enum object are unchanged. PR 9 now implements only [creation with its writer adapter](shipments-create-seam.md); the public contract remains byte-identical. The full milestone remains incomplete: list/detail/link/status use cases and adapters, remaining server projection decoupling and physical enum ownership cleanup still need separately scoped work. Characterize each before migration.

The component harness runs production callbacks with fake hooks and element descriptors. It does not render React DOM, run Ant Design validation, test focus/layout/native file dialogs, or establish browser visual equivalence. The graph checks project imports, not third-party internals or the entire repository. HTTP tests use synthetic Requests/Files and fake provider factories; no live Sheets/Drive/LINE/Loyverse, production data, permissions, credentials, concurrency, deployment or end-to-end provider behavior was verified. Existing limitations and partial-write semantics remain. See [verification results](verification.md).

Current consumer locations after the UI follow-up: replace the three app presentation paths and formatter in the historical PR 5 audit above with the corresponding `modules/shipments/ui/` paths. PR 8 relocates `app/shipments/api.ts` to `modules/shipments/ui/api.ts` with identical bytes; all server consumers retain their original locations/implementations. Orders browser enum/client imports are now removed through app client composition. The former type-only reverse trace is absent; neither runtime nor type-only browser ownership may add a reverse Orders edge. Public `contracts.ts` is byte-identical to merged PR 5.


PR 10 now implements the [list/detail read seam](shipments-read-seam.md) behind the existing legacy server exports. Public/legacy DTOs and the single ShipmentStatus definition remain byte-identical. The new reader imports Orders public OrderStatus directly; it does not import Orders private mapping or alter Orders detail's five-sheet/latest-link projection. Creation stays unchanged. The two actual API GET consumers retain byte-identical imports/validation/responses. Linking/status/Drive, physical enum ownership and server projection decoupling remain future slices; the full milestone is incomplete.
