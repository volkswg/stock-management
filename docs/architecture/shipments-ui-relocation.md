# Shipment UI/client relocation — completed in PR 8; PR 6 history retained

Current status: PR 7 supplied the Orders-owned picker seam, and PR 8 completes the seventh byte-identical move from `app/shipments/api.ts` to `modules/shipments/ui/api.ts`. All seven requested files are now relocated. The old path is deleted with no shim, duplicate, barrel or proxy. Both former Shipment screen app-client exceptions are removed. The full Shipments milestone remains incomplete. The account below preserves the historical PR 6 blocker/evidence; the final PR 8 evidence follows at the end.

Base main is exactly `a0ff4127b68419d15a7836cdb130a3a33c87d21d`, confirmed as the merged PR 5 commit before branching. No intervening changes or pending work were present. Branch: `refactor/shipments-ui`. This implements six UI/formatter/CSS moves. The requested seven-file UI/client slice is **incomplete** because the browser client cannot move without violating the module dependency gate. The full Shipments milestone also remains incomplete.

## Dependency gate and explicit scope decision

AGENTS.md prohibits introducing circular dependencies and extending legacy violations. The dependency guide explicitly requires Shipments → Orders, including module ownership rather than only file imports. Current Shipment screens/gallery and DTOs already consume Orders. Orders detail imports runtime `ShipmentStatus` from the pure legacy leaf and three HTTP functions from `app/shipments/api.ts`: `getShipments`, `createShipmentMaster`, `linkOrderToShipment`.

Moving that implementation into `modules/shipments/ui/api.ts` and leaving a named app re-export would produce this runtime ownership cycle:

```text
Orders UI -> app/shipments/api (forwarder) -> Shipments UI/client
Shipments UI -> Orders contracts / OrderImageGallery
```

The files could still form a DAG; the modules would be cyclic. An app wrapper does not change implementation ownership. A test models exactly this proposed forwarding entrypoint and demonstrates the reverse runtime edge. No shim or duplicated client is shipped, and no exception permits that new runtime cycle.

The smallest safe subset leaves `src/app/shipments/api.ts` byte-identical, including every exported request/response type, all five operations and private response guards. It is still the implementation, **not** a compatibility forwarding entrypoint. Only the two relocated Shipment screens import this exact existing app browser client; other module files cannot use that exception. Orders detail and its enum/client imports remain byte-identical. There is no `modules/shipments/ui/api.ts`, placeholder, new interface, server change or physical enum transfer.

The inherited type-only ownership coupling is also explicit: `Orders/ui/[id]/OrderDetailPage -> app/shipments/api -> modules/shipments/contracts`, followed in the other direction by Shipment DTOs' Orders types. This type-level module cycle predates relocation. Tests preserve only that exact erased reverse trace; they do not call the modules decoupled. Runtime module edges remain Shipments → Orders; runtime and type-only **file** graphs are acyclic. Target module ownership is unchanged even though the actual legacy system retains this documented type debt.

Required follow-up before client relocation: separately authorize a narrow Orders picker dependency seam, define an Orders-owned browser interface for these three operations, inject the existing Shipment client from app composition, and remove the Orders module's app-client import while preserving loading/query/create/link callbacks. Then relocate the one client implementation and remove both screens' app-client exceptions. Also remove the enum bridge through the dedicated decoupling design before physical enum ownership transfer, and handle the legacy server detail projection through its own consumer-owned port. None of that decoupling is implemented here.

## Exact moves and audited consumers

| Old path under `src/app/shipments/` | New path under `src/modules/shipments/ui/` | Consumers / corrections |
| --- | --- | --- |
| `ShipmentListPage.tsx` | `ShipmentListPage.tsx` | `app/shipments/page.tsx` imports module list; list imports retained app client explicitly |
| `ShipmentMobileCard.tsx` | `ShipmentMobileCard.tsx` | List's relative component import remains valid |
| `shipmentListFormat.ts` | `shipmentListFormat.ts` | Relative list/mobile/detail formatting imports remain valid |
| `shipments.module.css` | `shipments.module.css` | List/mobile relative styles remain valid; app list loading wrapper imports module CSS |
| `[id]/ShipmentDetailPage.tsx` | `[id]/ShipmentDetailPage.tsx` | `app/shipments/[id]/page.tsx` imports module detail; detail imports retained app client explicitly |
| `[id]/shipmentDetail.module.css` | `[id]/shipmentDetail.module.css` | Detail's relative CSS remains valid; app detail loading wrapper imports module CSS |
| `api.ts` | **Deferred**, original file retained | Existing Orders picker and both Shipment screens call the same original HTTP implementation |

The four app route/loading wrappers stay in place with import-only changes. Their metadata, params, keys, skeletons and accessibility attributes remain identical. The three `/api/shipments` handlers are byte-identical. No consumer outside those four wrappers imports moved Shipment presentation files. Orders is the only external source consumer of the retained Shipment browser client. All three gallery consumers keep the named `@/modules/orders/ui/OrderImageGallery` import.

Audits cover aliases and relative imports across source, tests, ESLint and fixture locations. Existing Orders tests still execute picker selection/create/linking; additional tests feed the actual retained HTTP exports into production component callbacks with fake fetch rather than replacing those operations with stand-in functions.

## Characterization and enforcement

All 139 inherited tests pass before changes. Three additional tests pass before relocation (142 total): seven source/CSS fingerprints, wrapper/metadata bodies and retained bytes; actual Orders picker → original HTTP query/create/link; actual Shipment list/detail → original HTTP read/abort flow. Existing Shipment callback and HTTP expectations then run against the relocated components and unchanged client.

The new pre-move fixture records all seven requested source destinations with `api.ts` explicitly marked deferred. Structural tests require exactly the six actual module files, no duplicates/retired implementations, the four exact wrapper imports, and no relocated client. The older Orders/Shipment fixtures change path strings only: every prior expected body/CSS/type/function hash stays intact. To preserve inherited raw wrapper/Orders-lint fingerprints, the test reverses only the four reviewed wrapper import specifiers and the three moved consumer scope prefixes before comparing original hashes. Additional pre-move non-import wrapper hashes and exact destination-import assertions protect the permitted changes; no baseline is regenerated to bless new bodies.

ESLint now covers all `modules/shipments/ui/**/*.{ts,tsx}`, with a narrowly scoped exact app client exception for the list/detail screens only. Relative alternatives and unrelated app imports are rejected. The retained app client's own override permits only erased imports of Shipment contracts and disallows forwarding exports/runtime implementation imports. The pure enum leaf and public contract restrictions are preserved. Orders lint changes only three consumer file locations; its browser bans and exact legacy exceptions are unchanged. Positive/negative tests cover all four relocated TS/TSX files, future glob paths and the retained client.

Existing resolved browser graphs now allow only the exact app client and pure legacy enum leaf; no runtime/type-only file cycles or server implementation reachability are allowed. Additional ownership tests collapse intermediate app/legacy files, assert the runtime direction, expose the precise pre-existing type reverse trace, and prove a relocated client plus shim would introduce a runtime module cycle. They do not exempt the proposed cycle to manufacture a passing migration.

## What remains unchanged and unverified

`contracts.ts`, Orders code, all Shipment services, Sheets classes/headers/ranges/modes, API handlers, DTOs/enum identity, package/env/lockfiles and provider implementations remain untouched. Both CSS modules retain original bytes. Component bodies, JSX, hooks, state, messages, formatting, navigation and browser request logic retain their pre-move fingerprints. Existing service/HTTP tests preserve A:M creation, A:G links, M1-before-A2:M status operations, B:M updates, costs, duplicates, Drive cleanup and partial-write behavior.

Final commands/counts and the route-manifest comparison are in [verification](verification.md). Synthetic component tests do not run React DOM or Ant Design validation and cannot establish real-browser visual equivalence, layout/focus or native upload dialog behavior. No live Sheets, Drive, LINE, Loyverse, credentials, production data, concurrency/provider permissions, deployment or production scripts were exercised. No business fix, use-case extraction, repository adapter, Supabase, authentication, tenancy, billing or decoupling is included.

## PR 8 — completed browser client move

Base: `a3241ecd7ae3bdf14b0c1ede8681bf28e80e850a` (merged PR 7); branch `refactor/shipments-browser-client`. The only production changes are the byte-identical `src/app/shipments/api.ts` → `src/modules/shipments/ui/api.ts` rename and three import specifiers: Shipment list `./api`, Shipment detail `../api`, Orders app client composition `@/modules/shipments/ui/api`. All original imports, declarations, defaults, guards, errors, fetch/JSON/FormData construction and five runtime/seven type exports in the client remain unchanged. No app client file, shim or duplicate remains.

The original client SHA-256 is `7aa8e27b7928a27637ad8fcc0480c4c471bd4deeee25b7c4c314a95f709eb379`; non-import body hash is `64c6c72f42853451eb087a5db681a628d9db304c0755281da8099b63ca3f669e`. Both match at the destination. A pre-move fixture additionally captures all thirteen public/private function declarations and seven type declarations, three consumer body hashes and retained contract/port/wrapper/CSS bytes. Existing golden hashes are not replaced: the seventh moved flag changes to true, the old source body lookup follows the new path, and the original raw hash is read at the destination while its historical key remains intact. Orders picker AST fingerprints remain unchanged.

Shipment module UI has no app-import allowance. The client is protected by the module UI glob and a narrow exact-path override allowing only erased imports from its public contract, browser fetch, and its original local exports; server/provider/config/Node/dynamic/unapproved type imports and forwarding exports are prohibited. App Orders composition's exact whitelist now names the relocated client. Orders feature UI receives no Shipment exception. Runtime/type-only file graphs remain acyclic and browser-safe; actual module ownership is Shipments → Orders. The previous virtual relocation check now checks the real graph, retaining a negative case for a reintroduced Orders direct import through a hypothetical app forwarder.

The unchanged stable Orders adapter still delegates linkable query/create/link and awaits real response validation. All three consumers execute the actual moved client with synthetic fetch in tests. Additional pre-move tests cover default/optional fields, encoded IDs, JSON/multipart headers, zero-byte File behavior, omitted multipart deliveryFee, shallow guards, empty error messages, network/AbortError/JSON rejection identity and no retries, plus real-client list retry and detail status JSON/multipart callbacks. Existing picker and Shipment component/service/HTTP assertions are retained. Exact final test/build/route-manifest results are in [verification](verification.md).

Both contracts, the single legacy ShipmentStatus definition, Orders picker port/detail, every page/loading wrapper, APIs, CSS and server/provider/write implementation remain unchanged. No physical enum transfer, server projection seam, use-case/adapter extraction or full-milestone completion is claimed. Real React DOM/Ant Design validation, browser visual equivalence and live provider behavior remain unverified; no production data, credentials or integrations were accessed.
