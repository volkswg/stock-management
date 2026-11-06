# Orders pure Sheet type-import prerequisite

Base: `5d01209f9c241a5c6b4f07702b9684e7e2a2f79a` (merged PR19), verified exact remote main with a clean tree. Branch: `refactor/orders-sheet-type-imports`.

## Exact scope

The four existing erased imports change only their source string from `@/externals/google/sheet` to `@/externals/google/sheet/types`:

| Production file | Original complete-source SHA-256 |
| --- | --- |
| `src/modules/orders/server.ts` | `1a16141bf3fd0459aa6d060d8169257752b15f6397c013420826e43242f016c2` |
| `src/modules/orders/infrastructure/google-sheets/order-row-mapping.ts` | `31cc16bc45bd823396a6ea7c5ad66ee186907df770c441379122fd2482ca48ee` |
| `src/modules/orders/infrastructure/google-sheets/order-writer.ts` | `1cfb6961f7c2a2b72eeedd501a24a64dd541b641ffff29376370c7639c8ca917` |
| `src/modules/orders/infrastructure/google-sheets/order-list-reader.ts` | `d72d8bbb48ba861a46d917d0e0acc75c98f5aac70fcf79a0ab9b397338bef6b7` |

No worksheet is moved in this PR. No runtime import, public export, function/class body, constructor, data mapping, ID/clock behavior, financial calculation, route/HTTP/browser/UI/provider/configuration or persistence behavior changes. TypeScript emits exactly the same JavaScript for every modified file. Existing closed test loaders require no changes because these imports remain fully erased.

## Why this precedes worksheet ownership

The mixed legacy Sheets index exports the aggregate service and all worksheet implementations/headers. Orders previously imported even erased interfaces through that index. Moving Shipment worksheets behind its compatibility exports makes the whole runtime-plus-type file graph trace Orders → mixed index → Shipment implementation. Together with the intended Shipments → Orders public contract dependency, that violates the established module direction.

The pure `sheet/types.ts` leaf contains only aggregate/Movement contract declarations and erased generic root-type forwards. It imports no worksheet registry, configuration or feature implementation. The four consumers now reach that pure leaf and root generic types directly, never the mixed index. The old aggregate index, pure leaf, providers, worksheets and all public contracts remain unchanged.

A new virtual graph test models exactly the proposed ten-file Orders/Shipment worksheet move without changing production files. Current and proposed type-inclusive graphs retain only Shipments → Orders. Restoring the old import in just Orders server makes Orders → Shipments reappear, providing a negative regression rather than hiding legacy intermediaries. Existing runtime/type/browser/HTTP ownership checks remain unchanged.

## Enforcement and source history

`eslint/orders-sheet-type-boundaries.mjs` applies only to these four files, retains their exact necessary imports and permits the pure Sheet leaf only through erased imports. It rejects the old aggregate, relative variants, runtime type imports, re-exports, dynamic imports, require and import-type bypasses. Earlier Orders/Shipment boundary files remain byte-identical; the new exact override is registered after existing scopes.

`tests/fixtures/orders-sheet-types-before.json` captures the verified original four complete sources/hashes and tracked production inventory before editing. One characterization test passed on untouched production source before replacement. The history helper proves that reversing exactly one source string per file restores its original complete source, while declaration ASTs and emitted runtime text remain equal. All other production bytes remain identical.

The PR15/16/19 whole-source inventories and the older Shipment contract/browser-client retained-file loops recognize only these four named import migrations against their original expected hashes. Their existing special treatment of pre-PR14 Orders server evidence remains active. No earlier fixture is overwritten or regenerated, no broad exclusion/skip is introduced, and no runtime loader permission is expanded.

## Verification and limits

The Codex-executed baseline at this exact source is 395 tests passing, typecheck passing, lint exit zero with the inherited unused shipmentRow warning at tests/shipments-read-seam.test.mjs:6, and an isolated credential-free build passing. The clean baseline was also rerun after restoring the blocked worksheet attempt; 395 tests passed again. Final results are in [verification](verification.md#orders-pure-sheet-type-import-prerequisite).

Four new tests cover emitted-runtime/declaration parity, exact raw history/all-other-production parity, real ESLint positive/negative cases, and current/virtual worksheet ownership graphs. All inherited HTTP/Sheets/Drive/Orders/picker regressions stay enabled. No browser/runtime functionality is mocked merely to bless a new behavior.

No live Google/LINE/Loyverse, operational scripts, credentials/records, deployment or merge. Synthetic tests and isolated builds do not establish live integration permissions, browser visual parity or concurrency safety. Evidence is Codex-local, not independent GitHub/Vercel CI.

After this prerequisite merges, rebase the worksheet move on its verified merge SHA and run the full relocation characterization/build gates again. Ten worksheet/header moves, compatibility forwards, aggregate registry retirement, other feature migrations and all provider/SaaS work remain deferred.
