# ShipmentStatus physical ownership (PR 15)

Current state after PR 16: [all eight DTO declarations now live in public Shipment contracts](shipments-dto-ownership.md); the legacy leaf forwards them and the enum from that public file. The enum's sole physical owner remains status.ts, byte-identical to PR15. The historical PR15 graph/source/counts below are retained as evidence; only DTO ownership/forwarding direction is superseded. Both original and PR15 raw contract sources/hashes remain checked through exact reconstruction. Legacy types/barrel retirement remains future work.

Base: `d405fa9333780d6b32abd3df8efaccabf7fc7d20`, verified exact latest main and merged PR 14 squash commit. Clean initial working tree; no intervening commits. Branch: `refactor/shipments-status-enum-ownership`. Node 24.22.1 and existing installed dependencies only. This completes physical enum ownership only; eight legacy DTO declarations and the mixed legacy service barrel remain for compatibility.

## Exact ownership and consumers

| Production file | Change |
| --- | --- |
| `modules/shipments/status.ts` (new) | Single original exported ShipmentStatus enum declaration, unchanged members/order/values and emitted initialization |
| `modules/shipments/contracts.ts` | Only the runtime enum forwarding source changes to `./status`; eight explicit erased DTO exports remain |
| `services/shipments/types.ts` | Original enum declaration replaced by import/named re-export from the physical leaf; all eight DTO declarations stay exact |

Every other existing production file is byte-identical. The source audit covers all 277 baseline TS/TSX files (302 total tracked src files), aliases/relative imports, types/re-exports and all reviewed symbols. The new leaf raises TS/TSX inventory to 278. The historical fixture records the 34 matching consumer files and their original lines: public/legacy contracts/barrel; creation/read/link/status application/ports/server and Sheets adapters (including Orders projection); backend validation/Shipment routes; app Orders client composition; Shipment UI/formatter/client. Orders module detail/picker/contracts remain independent, with no Shipment imports. Existing services and UI keep their old import specifiers transparently.

Public, legacy direct leaf, unchanged legacy barrel and physical leaf all expose the same runtime object. Repeated imports share that object. Object.keys/values/entries retain Draft/draft, ReadyToShip/ready_to_ship, Shipping/shipping, Delivered/delivered, Canceled/canceled in that order. Contracts' only runtime export remains ShipmentStatus. Existing application operations, API error classes, transitions, status filters, nested OrderShipment wire strings and DTO nullability are unchanged. No provider/clock/IO runs during leaf import.

## Acyclic forwarding graph

```text
modules/shipments/contracts.ts
  -> modules/shipments/status.ts                       (runtime)
  -> services/shipments/types.ts                      (type exports only)
services/shipments/types.ts
  -> modules/shipments/status.ts                       (runtime)
  -> modules/orders/contracts.ts                       (type import only)
modules/shipments/status.ts                            (no dependencies)
```

The legacy DTO leaf must never import the public Shipment contract: defining the enum in contracts.ts while forwarding retained DTOs through that leaf would create a type-only contracts → types → contracts cycle. The independent status leaf avoids this without relocating DTOs or defining another enum. Runtime and runtime-plus-type graphs resolve with tsconfig aliases and remain file-acyclic; complete Orders/Shipment module ownership stays Shipments → Orders, without a reverse Orders edge. Browser graphs reach only the pure enum/DTO/Orders contracts and UI, never server/application/provider/config implementations. App composition still wires the consumer-owned Orders picker and detail projection; no feature imports app composition.

## Source history and DTO declarations

`tests/fixtures/shipments-enum-before.json` records verified base, original complete enum/source/AST/hash, three original contract/barrel sources/raw hashes, eight full DTO declaration ASTs/hashes, original export identities/keys/values, runtime/type graph, route contracts, representative JSON, consumer lines and all production byte hashes. Five characterization tests ran against unchanged original code before the move. An isolated saved-source graph remains executable afterward.

The enum declaration SHA-256 is `3fa4112e08310b9befd6fe42888e95c1cba2f2875daff98d79dc5c08a10c6890`. The moved full declaration and CommonJS emitted runtime initialization are equal to original. All eight full DTO declaration hashes remain:

| Declaration | Original and retained SHA-256 |
| --- | --- |
| `Shipment` | `fc7733935ac5b68346393d763c428e55959ce54f1d770bcd68214a22b53620bf` |
| `ShipmentRelatedOrder` | `938d5c71d42eb48d8aea45be7623d32f8223ed903991fe7c03bc32889c5df2ee` |
| `ShipmentRelatedProductImage` | `753b690cebe1b055929ff7b4184fd9115d04d5505ace7c20837448a4de5aa9fb` |
| `ShipmentQuantityCost` | `0e2f33d0a5574563cef1aad99c50e4b989205757bebe00866a374f655d76cf23` |
| `ShipmentCostSummary` | `ad09e271a2ce8e56c66da5227a2655feae45fabac943cc666a9e4f2e38d16e10` |
| `ShipmentListItem` | `70f53cdcea37153554c6e51ffd8df9a501ac62566caf7ca3b87eb1358522e01b` |
| `ShipmentStatusUpdate` | `4ebbf06784298495703f647c9a448d7c5212301dd96efc21d9669c704dc59680` |
| `ShipmentOrder` | `8bff0c0815d2bbbaa07da9d6fba4fab03b4358080566c0bff79cc314a7cce180` |

The inherited public contract raw hash `77753cb8809856586d5399999b7be5ca5ca8983a8e67897391b976cac2aacd78` stays authoritative in both browser-client and UI-relocation fixtures. Only that exact key gains migration-aware checks: saved original source matches the old hash; reversing only `export { ShipmentStatus } from "./status"` restores the complete original contract bytes, including eight DTO forwards; the physical enum matches original AST. No old hash/fixture is regenerated. The original contract's two-line temporary-ownership comment is retained as historical text so its only changed bytes are the requested forwarding source; this document records current ownership. Earlier PR 9–14 history checks remain active. DTO structure is independently compared in the original shipments-structure.json and the new full-declaration witness.

## Tests, loaders and boundaries

Five characterization tests preserve originals and execute real creation/list/status code. Seven ownership/history/graph tests assert singular physical declaration, original emitted enum, four-path runtime identity, unchanged barrel exports, all other production bytes, route contracts, both original contract witnesses, resolved graphs/browser isolation and actual link eligibility. Four exact-boundary tests protect positive production shapes and alias/relative/type/re-export/dynamic/require/import-type bypasses. Type checking proves nominal enum equivalence through all four import paths, all eight DTO public/legacy equivalences, and unchanged Orders-owned Shipment wire union. No any cast or second enum object is introduced.

Closed Shipment and Orders loaders admit exactly `modules/shipments/status.ts` as one added pure path. The component harness now evaluates the real public contract and its physical leaf instead of directly evaluating the former self-contained legacy file; it does not mock a second enum. The server graph admits only that exact additional leaf. Inherited browser graph expectations now correctly distinguish erased DTO forwarding: runtime does not reach the old DTO leaf; type graph still does. Historical tests change only the exact contract key in two loops; inherited result assertions are unchanged.

Scoped ESLint protects the status leaf as exactly the original exported enum with no other statements/imports, contracts as exactly one runtime status export and eight erased DTO forwards, and legacy types as erased Orders dependency, physical enum import/re-export and eight retained aliases. A local exact-shape rule supplements existing static import/global/dynamic bans; no dependency/plugin package is added. All prior Orders and Shipment application/adapter/server/browser scopes remain byte-identical, apart from the two narrowly replaced Shipment contract/legacy browser scopes and the new pure-leaf scopes in shipments-boundaries.mjs. No global relaxation.

## Verification and remaining work

Baseline: 339 tests pass; lint exits 0 with the inherited unused shipmentRow import warning in tests/shipments-read-seam.test.mjs; typecheck and isolated credential-free production build pass. Final results are recorded in [verification.md](verification.md). All 339 inherited tests remain active alongside 16 added tests. Original/new enum/DTO/source/graph evidence supplements inherited actual HTTP and fake provider transport tests: list/detail GET, creation POST, linking POST, JSON/multipart PATCH and Orders nested detail GET remain covered. A:M creation, A:G linking, M1-before-A2:M/B:M status writes, USER_ENTERED, Drive upload-before-status, successful retention and best-effort cleanup/logging remain unchanged.

Only enum ownership is complete. DTO physical relocation, retirement of services/shipments/types.ts and index.ts, legacy HTTP consumers/facades, Orders broader cleanup and ID utilities remain separate reviewed work. Retire each compatibility export only after a caller audit and independent type/runtime/API/graph/history coverage demonstrates no consumer requires it. The full Shipments milestone is not complete.

No providers, auth, persistence/schema/data, package/lockfile/env, browser/UI/CSS or routes change. No live integrations/records/credentials, operational scripts, merge/approval/deploy. These are Codex-local synthetic checks, not independent GitHub/Vercel CI evidence; they do not establish live permissions/availability, real-browser visuals or concurrency safety.
