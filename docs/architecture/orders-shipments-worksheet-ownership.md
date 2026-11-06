# Orders and Shipments worksheet ownership — PR 21

Verified base: `77fb645e08a98d8fa6fe38028d6791b3396da41f`, exact remote main / merged PR20, clean starting tree. Branch: `refactor/orders-shipments-worksheet-ownership`. This completes only the five Orders/Shipment worksheet ownership moves and five header moves.

## Exact physical and compatibility inventory

Each old file is now one explicit named re-export to its unique new physical owner. No old path is deleted, no class/header implementation is duplicated, and no caller changes.

| Original compatibility path | Single physical owner | Original full-source SHA-256 |
| --- | --- | --- |
| `src/externals/google/sheet/sheets/orders/OrdersSheet.ts` | `src/modules/orders/infrastructure/google-sheets/orders/OrdersSheet.ts` | `88b92e05d5993cb83a0ef5a0dd062883297879f64784a129f42e33bdbdbc1d04` |
| `src/externals/google/sheet/sheets/orders/const.ts` | `src/modules/orders/infrastructure/google-sheets/orders/const.ts` | `87f9303c82199d5f279be3e23ac410260e7e49067f968a3ef1cd7534911d81cf` |
| `src/externals/google/sheet/sheets/order-items/OrderItemsSheet.ts` | `src/modules/orders/infrastructure/google-sheets/order-items/OrderItemsSheet.ts` | `84f7a14d15a6b9dfb0aeb2af881a29a379e458432d6d3afe33ddfd60d1f4c8da` |
| `src/externals/google/sheet/sheets/order-items/const.ts` | `src/modules/orders/infrastructure/google-sheets/order-items/const.ts` | `dc15a3d5c8de1a5a6ac7076a4783ce586f7c68acbbaceb8e837bfc148a9a1245` |
| `src/externals/google/sheet/sheets/order-bills/OrderBillsSheet.ts` | `src/modules/orders/infrastructure/google-sheets/order-bills/OrderBillsSheet.ts` | `7cda1f089e8dbbfece2143b6a19ec5eeb9b3786976c222265201a8adf74ecdfc` |
| `src/externals/google/sheet/sheets/order-bills/const.ts` | `src/modules/orders/infrastructure/google-sheets/order-bills/const.ts` | `e235fd27fe5bad2d652b6cb13c299141e7b7a43ff3689d096c052bbe3ae33676` |
| `src/externals/google/sheet/sheets/shipments/ShipmentsSheet.ts` | `src/modules/shipments/infrastructure/google-sheets/shipments/ShipmentsSheet.ts` | `5a37982e5790021e6796ba46a24a45f61641215039617c25d1ee44d604e7c95e` |
| `src/externals/google/sheet/sheets/shipments/const.ts` | `src/modules/shipments/infrastructure/google-sheets/shipments/const.ts` | `3b61e71c99031646a1d3e735f7136e9db82d52173a9577eb0ed8bd5afc054c4a` |
| `src/externals/google/sheet/sheets/shipment-orders/ShipmentOrdersSheet.ts` | `src/modules/shipments/infrastructure/google-sheets/shipment-orders/ShipmentOrdersSheet.ts` | `d8d193a8ef641d4c5c7d5679e9e9acf33d41fad32728c284372a8c970787963c` |
| `src/externals/google/sheet/sheets/shipment-orders/const.ts` | `src/modules/shipments/infrastructure/google-sheets/shipment-orders/const.ts` | `8053bb89b16001ca7fe8068e2d4b79facbd1f2764ff04562082cc8dbbf5ba805` |

Moved class imports alone change: BaseGoogleSheet, generic row/range/interfaces and lastColumnLetter now come directly from `@/infrastructure/persistence/google-sheets/...`. Existing `./const` imports remain local. OrdersSheet intentionally retains its explicit A:Z default and has no unused header import. Every full class/helper/header declaration, comment, constructor signature, method body and export name remains identical. Header files are byte-identical at their destinations.

## Schema and operations

| Worksheet class | Default read | Original ordered headers |
| --- | --- | --- |
| `OrdersSheet` | `A:Z` | `id`, `status`, `seller`, `totalPrice`, `remark`, `createdAt`, `updatedAt`, `deletedAt`, `createdBy` |
| `OrderItemsSheet` | `A:J` | `id`, `orderId`, `imageUrl`, `quoteQuantity`, `deliveredQuantity`, `productCode`, `createdAt`, `updatedAt`, `deletedAt`, `createdBy` |
| `OrderBillsSheet` | `A:G` | `id`, `orderId`, `imageUrl`, `createdAt`, `updatedAt`, `deletedAt`, `createdBy` |
| `ShipmentsSheet` | `A:M` | `id`, `status`, `carrier`, `poNumber`, `shippingFee`, `remark`, `shippedAt`, `deliveredAt`, `createdAt`, `updatedAt`, `deletedAt`, `createdBy`, `shippingBillUrl` |
| `ShipmentOrdersSheet` | `A:G` | `id`, `shipmentId`, `orderId`, `createdAt`, `updatedAt`, `deletedAt`, `createdBy` |

Do not derive Orders' default from its nine headers: A:Z is intentional historical behavior. The other four defaults retain the existing header-length/lastColumnLetter expression. An explicit A:I read remains an explicit caller argument. Default read/write argument counts, worksheet quoting/encoding/names, caller ranges, object/payload identities, batch ordering, empty batches and exact errors remain unchanged. OrderItems retains batchUpdateRows delegation. No new validation, caching, retry, timing or normalization is added.

GoogleSheetsService, its config factory, `sheet/index.ts`, `sheets/index.ts`, every other worksheet/header, all root transports/auth/Drive implementations and every existing consumer remain byte-identical. The registry still creates its original worksheet instances through old imports, now the same physical feature-owned classes. Inherited tests retain Orders create/list/detail/five-read projection; Shipment A:M create, A:G link, M1-before-A2:M and conditional B:M writes; financial/nullability/clock/ID behavior; and Drive upload/retention/cleanup/partial failures. USER_ENTERED/RAW and INSERT_ROWS transport behavior is untouched.

## Identity and dependency direction

Tests load actual production old forwards and new owners in a cached, closed source graph. Each class is strictly equal through its new path, legacy leaf, both unchanged indexes and real GoogleSheetsService instance constructors. Class static/prototype inheritance points to the same root BaseGoogleSheet and the prototype constructor is the same class. Header arrays have strict old/new/aggregate identity and original ordered contents. Both legacy indexes retain their original runtime export key order. Type fixtures prove exact constructor/instance and header type compatibility, including readonly tuple types.

Physical worksheets depend only on root BaseGoogleSheet/generic types/constants and their own local headers. No root infrastructure gains feature knowledge. Orders imports no Shipments module or private adapter, including erased edges. Runtime and type-inclusive graphs are acyclic and preserve only Shipments → Orders public contracts. The legacy aggregate is composition and may instantiate both modules; it is not treated as an ownership firewall. Both browser graphs remain free of application/server/infrastructure/config/providers.

PR20's four pure Sheet type imports remain byte-identical. Its virtual relocation test is now an actual post-move resolved graph test, visiting all ten physical destinations and retaining the negative case that restores the historical mixed-index import in Orders server. That negative case still produces the forbidden Orders → Shipments edge. It no longer reads forwarding source as an alleged original class or synthesizes a pretend relocation.

New exact worksheet ESLint scopes allow only these ten real files' root transport/type/local-header imports. Generic interfaces must be erased imports. They reject alias/relative cross-feature/private/provider/config imports, broad/forwarding exports, import-type/dynamic/require bypasses and direct IO/time/env access. Earlier application, adapters, pure-type prerequisite and root provider scopes remain unchanged. No server marker is added to a moved declaration because it would change original source/evaluation; server/browser entrypoints and graph boundaries remain enforced.

## Historical evidence and offline loaders

Before production edits, `tests/fixtures/worksheet-ownership-before.json` captures the exact verified base, all ten original full sources/raw SHA-256 values, printed declaration AST/hash pairs, five original header arrays and real synthetic worksheet event traces, tracked production hashes and hashes of every previous fixture. Five characterization tests passed against untouched production classes before moving them. They execute actual BaseGoogleSheet with fake clients and assert defaults/payload identity/delegation/error propagation without retries.

History handling reverses only recorded import strings and proves equality with original complete source and AST declarations. Old compatibility source is checked as exactly one named forward. PR15/16/19/20 inventories reconcile only the ten explicitly named old files and recognize exactly ten new destinations. Every other production hash, prior fixture byte and prior migration exception remains authoritative. The creation graph adds only the two exact moved Shipment header leaves to its strict dependency list. No broad exemption, skip or fixture regeneration occurs.

The common VM loader follows only the new ten exact old→owner forwards, translating their recorded root-import strings to existing explicit fake dependency bindings. Both old forward and real physical module execute. The cached Google provider/registry loader adds only these ten recorded worksheet paths; historical mode reads their saved original source. Unapproved config, application and server modules still reject. Feature-specific Orders/Shipment loaders are unchanged, and no real config/auth/provider credentials are evaluated by tests.

## Verification and remaining work

Node 24.22.1 and existing dependencies. Baseline 399 tests pass, typecheck and isolated build pass; lint exits zero with the inherited unused shipmentRow warning at `tests/shipments-read-seam.test.mjs:6`. Final: 410 tests = 399 inherited + 11 new, zero failures/skips; lint/typecheck and credential-free isolated build pass. [Executed results and manifest comparison](verification.md#pr-21--orders-and-shipments-worksheet-ownership).

New tests cover five original/default/failure worksheets, complete source/declaration/all-other-production/old-fixture parity, actual class/prototype/header/index/service identity, original/current actual client/fake-fetch transport traces, two runtime/type DAG/browser checks and exact positive/negative lint boundaries. Actual transport parity retains quoted/encoded URLs, GET/POST/PUT, USER_ENTERED/INSERT_ROWS append, update and batch bodies, empty batches and rejection identity/no retries. All inherited real-fake transport, HTTP/Drive/Sheets business regression tests remain enabled.

Route sources/fixture remain 23 pages / 35 APIs, all byte-identical. Baseline/final Next app-paths manifests remain byte-identical, SHA-256 `32f92c7a1ef17213d7a8642ca89e3e71218984982bf1bdce66b560ef35893e1e`. Isolated builds contain no application .env files/inherited integration credentials, only tracked .env.example; filenames inspected only. No package/lockfile/env/schema/data, HTTP/UI, business/provider or consumer changes.

Results are Codex-local, not independent GitHub/Vercel CI. No live Google/LINE/Loyverse, production credentials/records, operational scripts, browser visual/integration permissions/availability/concurrency verification, merge/approval/deploy. Synthetic tests do not establish stronger concurrency/idempotency guarantees.

HR, sales, inventory, expense/shop, movement/user-state and other worksheet/header ownership remain legacy. Aggregate Sheets service/configuration/indexes, feature consumers and all ten compatibility paths remain until separately reviewed migrations. Registry retirement, provider/persistence replacement, broader Orders cleanup, SaaS/auth/tenancy/billing, retries/queues and data/schema changes remain deferred. The full architecture roadmap is not complete.
