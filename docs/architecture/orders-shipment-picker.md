# Orders-owned Shipment picker seam

Base: `c58669b7a00e8c9169423228fa6f18ab782c358a`, confirmed as the merged PR 6 main commit with no intervening changes or unrelated pending edits. Branch: `refactor/orders-shipment-picker-port`. This implements only the browser picker prerequisite. It does not move the Shipment client, transfer enum ownership, migrate services/adapters or complete the Shipments milestone.

## Interface and composition

`modules/orders/ui/[id]/shipment-picker-port.ts` exports `PickerShipment = Pick<OrderShipment, "id" | "poNumber" | "carrier" | "status">` and `OrderShipmentPickerPort`:

- `listLinkableShipments({ signal?: AbortSignal })` returns `Promise<{ shipments: PickerShipment[] }>`.
- `createShipmentMaster({ poNumber: string, carrier?: string })` returns `Promise<{ shipment: PickerShipment }>`.
- `linkOrderToShipment(shipmentId: string, orderId: string)` returns `Promise<void>`.

The only import is the Orders-owned `OrderShipment` type. There are no Shipment DTOs, runtime status values, provider interfaces, HTTP wrappers, rows, ranges or IO in the port. `OrderDetailPage` requires `shipmentPicker`, threads it to `OrderContent` and `ShipmentLinkCard`, and calls only these three operations. There is no context, global store, generic service/container or new module layer.

`app/orders/[id]/OrderDetailClient.tsx` starts with `"use client"`. A module-scope adapter has stable object identity across renders. It imports the actual existing Shipment browser functions from `app/shipments/api.ts` and the single enum through `modules/shipments/contracts.ts`:

- List delegates to `getShipments` with the original `excludeStatuses` order `[Shipping, Delivered, Canceled]`, `includeOrders: false`, and the exact supplied signal. It returns the existing response without reordering/mapping; the unchanged picker still maps options and suppresses duplicate current shipments.
- Create delegates directly with the same input object and successful response.
- Link awaits the existing operation and returns void only after its response guard succeeds. No error translation, retry, rollback or transaction is added.

The server `app/orders/[id]/page.tsx` changes only import/render target from `OrderDetailPage` to `OrderDetailClient`. It retains metadata, params Promise, ID, absence of a route key, and all other behavior. It passes only `orderId`; no function-valued adapter crosses RSC serialization. The client wrapper returns the original module component with no DOM, key or loading boundary added. The picker card's existing key and the Orders initial fetch lifecycle remain unchanged. Its effect adds the required port to dependencies so an actual replacement aborts/refetches, while stable app composition avoids repeated requests.

## Consumer audit and dependency result

Before this seam, Orders detail was the only Orders browser consumer of both the legacy `services/shipments/types` enum and `app/shipments/api`. Shipment list/detail are the other app-client consumers. Public Shipment contracts forward the pure enum leaf; backend/Orders detail projections remain legacy server consumers. Tests previously mocked the direct Orders app import, and ownership checks explicitly recorded its type-only reverse trace.

After this seam, Orders module UI has no app, Shipment module, legacy Shipment type or service import, including erased dependencies. Both former Orders browser exceptions are removed. The app wrapper composes both features; neither feature imports it. Module runtime and type-only browser ownership graphs are now **Shipments → Orders** only. The inherited Orders → app client → Shipment contract reverse type trace disappears. Resolved project file graphs are also acyclic; no browser graph reaches server IO. The ownership checker still follows intermediary app/legacy files rather than treating an app forwarding shim as an ownership firewall. Reintroducing the old direct import is a negative lint/ownership regression case.

Current client flow:

```text
app server page (orderId only)
  -> app client composition (stable adapter)
     -> Orders UI -> Orders-owned picker port
     -> unchanged app Shipment HTTP client -> unchanged /api/shipments routes
     -> public ShipmentStatus -> original pure legacy enum definition
```

Shipment list/detail remain byte-identical and still use the retained app client. Shipment contracts and the legacy enum leaf remain byte-identical and retain one runtime enum object. The old comment in the unchanged Shipment contract records its earlier compatibility rationale; the browser exception is now removed, while physical ownership remains intentionally outside this task. The legacy Orders server detail projection and other server service imports still need a separate consumer-owned seam. This browser graph result does not claim the entire repository's server dependencies are decoupled.

The browser picker prerequisite blocking client relocation in PR 6 is now satisfied. A later scoped PR can relocate the single Shipment client and update app composition plus the two Shipment screens, retaining its original response/type/HTTP tests. A virtual graph test confirms that proposed future move no longer adds a reverse module edge; it does not implement the move. Existing Shipment client no-forwarding lint remains unchanged until that future task. Enum physical ownership and server projection work remain separate scopes.

## Characterization and surgical structural evidence

All 148 inherited tests and baseline checks pass. Thirteen new picker tests pass against the original direct-import implementation before production edits (161 total), exercising real client requests with fake fetch. The same result assertions run after injection through the production app adapter: preselection/unlinked state, duplicates, search/disabled states, exact exclusions/query/headers/cache/signals, no unnecessary retries, unmount/replacement abort, explicit retry, create/link success/failures, malformed success guards, original messages and notification order.

Additional composition/fake-port tests check stable adapter identity, serializable server props, no DOM wrapper, delegation and input/result identity, response-guard completion before void resolution, network error identity, fake-port signal-only inputs and replacement behavior, required prop typing, and browser runtime/type-only graphs. Form instrumentation records original temporary PO format, reset/modal state and loading callbacks without implementing Ant Design validation.

Original Orders/Shipment golden fixtures and hashes are retained. The new `orders-picker-seam.json` captures pre-refactor hashes of every non-import statement plus old raw evidence. Instead of blindly regenerating whole-file snapshots, a surgical AST comparison reverses only the reviewed three-function plumbing: required port parameters/properties, two threaded JSX attributes, the three delegated calls, exclusion options now supplied by composition, and the added effect dependency. Every restored statement must match the captured original hash, including every unrelated component/function/constant. The existing Orders body fingerprint also remains equal after that reviewed transformation. Server page comparison permits only the JSX render-target rename; metadata/params and remaining statements keep the original fingerprint. Obsolete whole-file Orders lint equality becomes exact unchanged static-selector parity plus positive/negative tests for stronger scoped rules. All CSS and unrelated raw file fingerprints stay unchanged.

Harness changes remove the obsolete direct app-client/legacy enum mocking path from Orders, supply required injected ports explicitly, and use the real production adapter with either fake HTTP operations or the actual unchanged browser client. Existing query/create/link expectations remain intact. Existing Shipment HTTP/provider/status/cost tests remain unchanged. New scoped ESLint covers the pure port and app wrapper; Orders module UI now rejects all app/legacy Shipment/module imports, including relative/type/re-export/dynamic bypasses. Shipment rules remain unchanged.

See [command results](verification.md). Tests execute actual component functions/callbacks with fake hooks/descriptors; they do not render React DOM, run Ant Design validation or establish real-browser visual/focus/native dialog equivalence. Project graphs exclude third-party internals/unrelated legacy areas. No live Sheets, Drive, LINE, Loyverse, production data/credentials, provider permissions, concurrency, deployment or operational scripts were used. Financial, status, image, upload/cleanup, partial-write, schema and transport behavior remain untouched.
