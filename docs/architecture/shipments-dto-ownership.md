# Shipment DTO physical ownership (PR 16)

Base: `703d55f5c67dab8392fcc29a757cef4b2766a975`, verified exact latest main and PR 15 squash merge, clean initial working tree/no intervening commits. Branch: `refactor/shipments-dto-ownership`. Node 24.22.1 and existing dependencies only. Only DTO ownership is complete; legacy facade/barrel retirement remains separate, and the full Shipments milestone is incomplete.

## Exact production inventory and compatibility

Only two existing production files change; no production file is added or removed:

| File | Before | After |
| --- | --- | --- |
| `modules/shipments/contracts.ts` | Runtime status export plus eight erased legacy DTO forwards | Erased Orders OrderStatus import, runtime import/named export of ./status, eight original exported DTO declarations |
| `services/shipments/types.ts` | Eight DTO declarations, erased Orders status import and physical enum import/export | Explicit named status and eight erased DTO forwards from public Shipment contracts |

All eight complete declaration texts and printed ASTs are copied verbatim in the original declaration order: Shipment, ShipmentRelatedOrder, ShipmentRelatedProductImage, ShipmentQuantityCost, ShipmentCostSummary, ShipmentListItem, ShipmentStatusUpdate, ShipmentOrder. The obsolete two-line public ownership comment is removed; its complete text remains in both historical witnesses and reconstruction checks. No field, alias constituent, optionality, enum reference, price/fee/cost nullability, quantity string or timestamp changes. Public runtime keys remain exactly [ShipmentStatus]; DTOs disappear from emitted JS.

`modules/shipments/status.ts` stays byte-identical and remains the sole physical enum definition. Its physical/public/direct-legacy/barrel imports share one cached object with unchanged keys, values, entries and JSON. The public module owns DTO declarations and the exported enum interface; status.ts owns runtime enum initialization. The unchanged legacy barrel still exports all prior operations, error class, enum and types. Direct link/status facade DTO exports, function signatures and server/barrel identities stay compatible.

All other 301 baseline production files are byte-identical, including Orders contracts/seams, Shipment applications/ports/server/adapters, all API/page/loading/browser/UI/CSS/LINE code, providers/auth/headers/schema/ranges and ID/clock behavior. Package/lockfile/env/data are untouched. No new dependency, helper framework or domain directory.

## Consumer/import audit

The exact TypeScript AST/resolver audit covers all 278 baseline production TS/TSX files plus tracked test modules. It records 32 relevant import/re-export declarations in 29 production files and 17 in test files, with per-symbol runtime/erased flags, aliases, target resolution, role and line. Identifier references are recorded separately in 42 production/test files; quoted code examples are not misrepresented as source dependency edges. The earlier 34-file textual inventory remains historical evidence, not an exact import count. All eight DTO imports are explicitly erased where consumed; ShipmentStatus has both runtime and erased uses.

The following table records pre-move edges. Consumer implementations/imports stay unchanged except the public/legacy ownership inversion described above. No source import exists in Orders module for these Shipment symbols; Orders consumes its own picker/detail ports. The Drive adapter/bill workflow uses its existing business storage/status-result contracts, not a new DTO dependency.

| Consumer | Role | Exact original declarations |
| --- | --- | --- |
| `src/app/api/shipments/[id]/orders/route.ts` | http | runtime linkOrderToShipment, LinkOrderToShipmentError via `@/services/shipments` |
| `src/app/api/shipments/[id]/route.ts` | http | runtime getShipmentDetail, ShipmentStatus, updateShipmentStatus via `@/services/shipments` |
| `src/app/api/shipments/route.ts` | http | runtime createShipment, listShipments, ShipmentStatus via `@/services/shipments` |
| `src/app/orders/[id]/OrderDetailClient.tsx` | client-composition | runtime ShipmentStatus via `@/modules/shipments/contracts` |
| `src/features/backend/shipments/utils.ts` | server | runtime ShipmentStatus via `@/services/shipments` |
| `src/modules/shipments/application/create-shipment.ts` | server | runtime ShipmentStatus; erased Shipment via `../contracts` |
| `src/modules/shipments/application/link-order-to-shipment.ts` | server | runtime ShipmentStatus; erased ShipmentOrder via `../contracts` |
| `src/modules/shipments/application/list-shipments.ts` | server | erased ShipmentCostSummary, ShipmentListItem, ShipmentQuantityCost, ShipmentRelatedOrder, ShipmentStatus via `../contracts` |
| `src/modules/shipments/application/ports/created-shipment-writer.ts` | server | erased Shipment via `../../contracts` |
| `src/modules/shipments/application/ports/shipment-list-reader.ts` | server | erased ShipmentListItem, ShipmentRelatedOrder via `../../contracts` |
| `src/modules/shipments/application/ports/shipment-order-link-store.ts` | server | erased ShipmentOrder via `../../contracts` |
| `src/modules/shipments/application/ports/shipment-status-store.ts` | server | erased ShipmentStatusUpdate via `../../contracts` |
| `src/modules/shipments/application/update-shipment-status.ts` | server | runtime ShipmentStatus; erased ShipmentStatusUpdate via `../contracts` |
| `src/modules/shipments/contracts.ts` | public-contract | runtime ShipmentStatus via `./status`; erased Shipment, ShipmentListItem, ShipmentRelatedOrder, ShipmentRelatedProductImage, ShipmentQuantityCost, ShipmentCostSummary, ShipmentStatusUpdate, ShipmentOrder via `@/services/shipments/types` |
| `src/modules/shipments/infrastructure/google-sheets/order-detail-shipment-projection.ts` | server | runtime ShipmentStatus via `../../contracts` |
| `src/modules/shipments/infrastructure/google-sheets/shipment-list-reader.ts` | server | runtime ShipmentStatus; erased ShipmentListItem, ShipmentRelatedOrder, ShipmentRelatedProductImage via `../../contracts` |
| `src/modules/shipments/infrastructure/google-sheets/shipment-order-link-store.ts` | server | erased ShipmentOrder via `../../contracts` |
| `src/modules/shipments/infrastructure/google-sheets/shipment-status-store.ts` | server | erased ShipmentStatusUpdate via `../../contracts` |
| `src/modules/shipments/infrastructure/google-sheets/shipment-writer.ts` | server | erased Shipment via `../../contracts` |
| `src/modules/shipments/server.ts` | server | erased Shipment, ShipmentListItem, ShipmentStatus via `./contracts` |
| `src/modules/shipments/ui/ShipmentListPage.tsx` | browser | runtime ShipmentStatus; erased ShipmentListItem, ShipmentRelatedOrder via `@/modules/shipments/contracts` |
| `src/modules/shipments/ui/ShipmentMobileCard.tsx` | browser | erased ShipmentListItem, ShipmentRelatedOrder via `@/modules/shipments/contracts` |
| `src/modules/shipments/ui/[id]/ShipmentDetailPage.tsx` | browser | runtime ShipmentStatus; erased ShipmentListItem, ShipmentRelatedOrder via `@/modules/shipments/contracts` |
| `src/modules/shipments/ui/api.ts` | browser | erased Shipment, ShipmentListItem, ShipmentOrder, ShipmentStatus, ShipmentStatusUpdate via `@/modules/shipments/contracts` |
| `src/modules/shipments/ui/shipmentListFormat.ts` | browser | runtime ShipmentStatus via `@/modules/shipments/contracts` |
| `src/services/shipments/index.ts` | legacy-server | runtime linkOrderToShipment, LinkOrderToShipmentError; erased LinkOrderToShipmentResult, ShipmentOrder via `./linkOrderToShipment`; runtime updateShipmentStatus; erased ShipmentStatusUpdate, UpdateShipmentStatusResult via `./updateShipmentStatus`; runtime ShipmentStatus; erased Shipment, ShipmentCostSummary, ShipmentListItem, ShipmentQuantityCost, ShipmentRelatedOrder, ShipmentRelatedProductImage via `./types` |
| `src/services/shipments/linkOrderToShipment.ts` | legacy-server | erased ShipmentOrder via `@/modules/shipments/contracts` |
| `src/services/shipments/types.ts` | legacy-server | runtime ShipmentStatus via `@/modules/shipments/status` |
| `src/services/shipments/updateShipmentStatus.ts` | legacy-server | erased ShipmentStatusUpdate via `@/modules/shipments/contracts` |

The fixture retains the complete test/type import audit (17 declarations), including existing public/legacy type-equivalence fixtures; all remain loadable. No caller migration is hidden behind a cosmetic import rewrite.

## Resolved graph

```text
modules/shipments/contracts.ts
  -> modules/shipments/status.ts          runtime
  -> modules/orders/contracts.ts         erased OrderStatus
services/shipments/types.ts
  -> modules/shipments/contracts.ts       named runtime status / erased DTO forwards
services/shipments/index.ts
  -> services/shipments/types.ts          unchanged compatibility forwards
modules/shipments/status.ts               no dependencies
```

Both runtime and runtime-plus-erased graphs are acyclic. Public contracts no longer import/re-export legacy DTOs, so the legacy leaf can now safely forward the public contract. No module may depend back on that compatibility DTO leaf. Feature ownership remains Shipments → Orders with no reverse edge; app composition continues wiring both existing consumer-owned Orders seams. Browser graphs now reach no legacy service file even through erased dependencies, and no application/server/infrastructure/config/provider implementation. The enum leaf remains separate and dependency-free.

## Source and AST history

`tests/fixtures/shipments-dto-before.json` captures the actual post-PR15 sources/raw hashes for public contracts, legacy DTOs, pure enum and barrel; eight original texts/full ASTs/hashes; public/legacy runtime exports/identity; original resolved edges/import audit/references; original routes/build manifest hash; all 303 production fingerprints; earlier fixture fingerprints; boundary source witnesses; actual creation/list/detail JSON and worksheet events. Three new characterization tests pass on untouched production source before extraction, then run unchanged afterward.

| Original declaration | Retained SHA-256 |
| --- | --- |
| `Shipment` | `fc7733935ac5b68346393d763c428e55959ce54f1d770bcd68214a22b53620bf` |
| `ShipmentRelatedOrder` | `938d5c71d42eb48d8aea45be7623d32f8223ed903991fe7c03bc32889c5df2ee` |
| `ShipmentRelatedProductImage` | `753b690cebe1b055929ff7b4184fd9115d04d5505ace7c20837448a4de5aa9fb` |
| `ShipmentQuantityCost` | `0e2f33d0a5574563cef1aad99c50e4b989205757bebe00866a374f655d76cf23` |
| `ShipmentCostSummary` | `ad09e271a2ce8e56c66da5227a2655feae45fabac943cc666a9e4f2e38d16e10` |
| `ShipmentListItem` | `70f53cdcea37153554c6e51ffd8df9a501ac62566caf7ca3b87eb1358522e01b` |
| `ShipmentStatusUpdate` | `4ebbf06784298495703f647c9a448d7c5212301dd96efc21d9669c704dc59680` |
| `ShipmentOrder` | `8bff0c0815d2bbbaa07da9d6fba4fab03b4358080566c0bff79cc314a7cce180` |

The older shipments-enum-before.json remains byte-identical and separately proves every DTO AST/hash predates both moves. The new helper reconstructs the exact post-PR15 public contract (including its old comment/forward order) and legacy DTO source from the transferred declarations plus reviewed import/forward reversal. It compares both complete sources/raw hashes to the PR16 baseline witness. The existing enum history helper then reverses only PR15's enum forwarding source, requiring the original pre-PR15 raw contract hash `77753cb8809856586d5399999b7be5ca5ca8983a8e67897391b976cac2aacd78`. Reconstructing the pre-PR15 legacy source also retains the distinct older enum/DTO witness. No old source is overwritten or treated as a newer baseline.

Original shipments-structure.json DTO bodies are still checked, with only their physical lookup path changed. The enum characterization/ownership tests use the new owner and updated exact graph, preserving every enum/behavior assertion. Their boundary tests retain four tests with new ownership-appropriate positives/negatives; inline type-only forwarding remains rejected. Public export enumeration now includes physical exported aliases rather than only forwarding declarations. Older browser-client/UI preservation loops still use their exact same contract hash key and now prove both reviewed transformations. All earlier fixtures and PR 9–15 history remain unchanged; no blanket skip or golden regeneration.

## Harness, boundaries and evidence

Existing closed Shipment/Orders/component loaders need no changes: they already admit the exact contracts/status/legacy files and TypeScript erases the moved Orders type import. They execute the real new forwarding direction without another enum object, broader dependency allowance or provider/config loading. Browser graph checks remove the former pure legacy leaf exception in both modes, including app Orders client composition. The new saved-source-only pure loader is closed to four witnessed files and inert unrelated barrel operation placeholders; actual runtime operation identity/behavior tests use the production seam loader.

Only the two public/legacy exact-shape branches and their import allowlists change in shipments-boundaries.mjs. Public contracts require erased Orders status, exact ./status runtime import/named export and exactly eight exported aliases in original order; legacy requires one named runtime enum plus eight erased named DTO forwards from public contracts. All other statements/imports, duplicate/missing/renamed DTOs, runtime types/classes/helpers, providers/config/Node/framework/legacy reverse paths and alias/relative/re-export/dynamic/require/import-type/type-value bypasses are rejected. Original enum branch, both Shipment UI scopes and all Orders/Shipment server boundary files remain unchanged.

Added tests: three pre-move characterization, five ownership/runtime/history/graph tests and three boundary tests (11). A new compile-time fixture proves every public/legacy/barrel DTO, direct link/status DTO aliases, nominal enum/status types, nullability, quantity strings, named server function signatures and Orders-owned nested projection compatibility without modifying Orders source. All 355 inherited tests remain active; [command/build results](verification.md).

Inherited actual application/HTTP/fake transport tests continue exercising Shipment creation/list/detail/link/status, Orders nested detail/five-read ordering, browser filters/picker/abort/guards, A:M/A:G/M1-before-A2:M/B:M/USER_ENTERED, cost/null/zero/timestamps and existing Drive upload/retention/cleanup/partial failures. Only types and import forwarding move; no runtime business/provider code changes.

## Remaining compatibility and limits

The two legacy files remain compatibility surfaces. Retire types.ts/index.ts only after every direct and barrel consumer (including HTTP/backend helpers and type consumers) is separately audited/migrated with reviewed export/API/type/history parity. Broader Orders legacy cleanup, other enums, providers/persistence, LINE journeys, Purchase Order Master, SaaS/auth/tenancy/billing and concurrency/retry changes remain separate tasks. No wider milestone completion is claimed.

These are Codex-local synthetic checks, not independent GitHub/Vercel CI results. No live Google/LINE/Loyverse requests, credentials/production records, operational scripts, merge/approval/deploy or schema changes. Offline verification does not establish live permissions/availability, concurrency guarantees or real-browser visual parity.
