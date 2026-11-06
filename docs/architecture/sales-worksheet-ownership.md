# Sales worksheet ownership — PR 22

Verified base: `b0926e1321ce55869f87d3fa72852cc5e55ed693`, exact main / merged PR21, clean starting tree. Branch `refactor/sales-worksheet-ownership`. Only five Sales worksheet classes and five headers move; all Sales algorithms and consumers remain unchanged.

## Physical owners and compatibility

Each old path contains exactly one explicit named forward to its single physical owner. No duplicate class, header or registry exists.

| Retained old path | Physical owner | Original complete-source SHA-256 |
| --- | --- | --- |
| `src/externals/google/sheet/sheets/sales/receipts/SalesReceiptsSheet.ts` | `src/modules/sales/infrastructure/google-sheets/receipts/SalesReceiptsSheet.ts` | `ea2bc46841d5afaaf5d1f8cf0192008eab79d8402861e5709b18878fb527d366` |
| `src/externals/google/sheet/sheets/sales/receipts/const.ts` | `src/modules/sales/infrastructure/google-sheets/receipts/const.ts` | `763f39dc2389110ec2f1d7a8b9edb22d4582d54ddca72ca24addbcfbf9f7d79f` |
| `src/externals/google/sheet/sheets/sales/receipt-items/SalesReceiptItemsSheet.ts` | `src/modules/sales/infrastructure/google-sheets/receipt-items/SalesReceiptItemsSheet.ts` | `07188f97b01008360b392be3de90d8ab14ed01329dc13fe889137fa3c6da37ba` |
| `src/externals/google/sheet/sheets/sales/receipt-items/const.ts` | `src/modules/sales/infrastructure/google-sheets/receipt-items/const.ts` | `0b4f84bf3a1ecde01a96d23be962395e5365afb47ac93b0c148bb921b7489859` |
| `src/externals/google/sheet/sheets/sales/receipt-payments/SalesReceiptPaymentsSheet.ts` | `src/modules/sales/infrastructure/google-sheets/receipt-payments/SalesReceiptPaymentsSheet.ts` | `31a53e78c9fb960b41b71e5476c7f6d2be98d9fe4ad4c3f4dcabc875118b6798` |
| `src/externals/google/sheet/sheets/sales/receipt-payments/const.ts` | `src/modules/sales/infrastructure/google-sheets/receipt-payments/const.ts` | `b6ffb27c0983929a089eccbad1ec7d9bfffeb552eb0a5219860aa78961a7a017` |
| `src/externals/google/sheet/sheets/sales/receipt-syncs/SalesReceiptSyncsSheet.ts` | `src/modules/sales/infrastructure/google-sheets/receipt-syncs/SalesReceiptSyncsSheet.ts` | `b559bb27613911da9f683bff6925054cd6562f5b5d85fceb45eebb0cfdd82e57` |
| `src/externals/google/sheet/sheets/sales/receipt-syncs/const.ts` | `src/modules/sales/infrastructure/google-sheets/receipt-syncs/const.ts` | `76d880d9d2de3f4fda54f0262f5e2ffdaf1ce5f3593a3aa2d1e98fb7be34ad5e` |
| `src/externals/google/sheet/sheets/sales/profit-cost-overrides/SalesProfitCostOverridesSheet.ts` | `src/modules/sales/infrastructure/google-sheets/profit-cost-overrides/SalesProfitCostOverridesSheet.ts` | `2c1cce2d54ee3d7be53fbaed497d22744e6e6b72154ed66a8ad90f9fe719869c` |
| `src/externals/google/sheet/sheets/sales/profit-cost-overrides/const.ts` | `src/modules/sales/infrastructure/google-sheets/profit-cost-overrides/const.ts` | `55e3b3c247836cfcf290fe59fdba4b900b8c2c86b940e1337dcd52d6f3f1340a` |

Every moved class changes only three import strings: root `sheets/BaseGoogleSheet`, erased generic `types` and `const` under `@/infrastructure/persistence/google-sheets/`. Its own `./const` remains local. All class/header declaration ASTs, bodies, signatures, prototypes, comments and evaluation/default expressions remain exact. Header files are byte-identical at the new locations; arrays remain mutable rather than becoming readonly/frozen or copied.

| Worksheet | Headers | Original header-derived default |
| --- | --- | --- |
| `SalesReceiptsSheet` | 26 | `A:Z` |
| `SalesReceiptItemsSheet` | 21 | `A:U` |
| `SalesReceiptPaymentsSheet` | 10 | `A:J` |
| `SalesReceiptSyncsSheet` | 9 | `A:I` |
| `SalesProfitCostOverridesSheet` | 8 | `A:H` |

The original `lastColumnLetter(headers.length - 1)` expressions, including multiline formatting for cost overrides, are retained. Characterization mutates each header array temporarily and proves subsequent default reads recalculate their range at call time. No new validation/caching/normalization or changed await behavior. Explicit caller ranges, field/cell order, zeros/nulls/booleans, quoted/encoded names, GET/POST/PUT, USER_ENTERED/RAW/INSERT_ROWS and no-retry/partial-write semantics remain unchanged.

## Consumers and graph audit

The saved baseline audit resolves 92 direct affected-leaf/aggregate-index import/export edges across source, tests and operational scripts using project TypeScript resolution. It records aliases, relatives, re-exports, erased imports, dynamic/import-type/require forms, imported names and all three operational script paths. Scripts are inspected only, never executed. Direct old Sales leaves are forwarded through the two existing Sheets indexes; registry construction and existing aggregate consumers are untouched.

Legacy Sales consumers remain outside this module migration:

- `syncLoyverseDailySales.ts`: four Sales headers and the erased aggregate service via the mixed index.
- `getGoogleSheetsDailySales.ts`: the same four headers, erased rows/service; original report/dashboard/profit rules.
- `manageSalesProfitCostOverrides.ts`: override headers, erased rows/service and original Node UUID generation.
- `listSalesSyncStatus.ts`: erased aggregate service.
- `getLoyverseReceiptsForSalesDate.ts`, `rowMappers.ts`, `idBuilders.ts` and Sales barrel retain their original imports, Bangkok/ID/row algorithms.
- Existing Sales API handlers, other aggregate consumers and operational scripts keep their original wiring.

New Sales infrastructure imports only root transport/types and its own header leaves; it imports no legacy mixed registry, other feature, app/UI/config or provider implementation. Root infrastructure is byte-identical and gains no Sales dependency. Runtime and type-inclusive graphs across Sales/Orders/Shipments modules are acyclic; the only cross-module edge remains Shipments → Orders. PR20's actual-move/negative mixed-index regression and PR21 class/history/identity checks remain enabled.

Sales daily-sales UI has inline browser types and only browser/library/style imports; it reaches no backend/provider in either graph. Orders and Shipments browser graphs remain clean. **The full legacy application is not claimed type-graph-clean:** before this move, six older client roots already reached every old Sales worksheet through erased legacy services/mixed-index imports:
- `src/app/employees/advances/SalaryAdvancesPage.tsx` (type-only reachability).
- `src/app/employees/payroll/PayrollPage.tsx` (type-only reachability).
- `src/app/expenses/ExpenseMasterPage.tsx` (type-only reachability).
- `src/app/expenses/ExpensesPage.tsx` (type-only reachability).
- `src/app/movements/MovementListPage.tsx` (type-only reachability).
- `src/app/movements/[id]/MovementDetailPage.tsx` (type-only reachability).

The before-move fixture retains exact traces. A new global client-graph test proves no client has runtime Sales worksheet reachability, and the erased reachable leaf set after mapping new owners back to their original identities equals the baseline exactly. These are pre-existing legacy type-boundary debts, not a new runtime path or an exception added to the migrated module/browser rules. No consumer cleanup is performed or hidden. Their pure DTO/type isolation remains separately scoped; the aggregate index is never treated as an ownership firewall.

## Tests, source history and closed loaders

Before editing production, one focused characterization loops over all five actual original classes using fake clients. The new immutable `sales-worksheets-before.json` captures all ten original full sources/raw hashes, printed declaration/hash pairs, header contents and synthetic call traces, tracked production hashes, every earlier fixture hash, resolved consumer audit and browser baseline traces.

Exact recorded import reversal reconstructs complete original class bytes. Headers remain original bytes and old files are verified as exactly one named forward. PR15–21 complete-source loops add only these ten named cases and ten new destinations; original expected hashes and earlier migration handling remain authoritative. No old fixture changes, blanket skips or regenerated snapshots. No production files beyond the ten old forwards and ten physical destinations change.

The PR19 cached provider/registry graph and common VM forward loader add only these ten recorded paths. Historical mode executes the saved original Sales implementations; current mode executes real old forwards and physical owners. Dependency stubs remain explicit and default network fails closed. Unapproved config/application/server/Sales-service loading still rejects. The legacy-service regression separately loads only its exact unchanged source files with explicit synthetic IO/crypto/clock dependencies; it does not expand the provider loader.

Nine added tests cover:

1. All five original/default/mutability/payload/await/failure behaviors in one table-driven characterization.
2. Full source/declaration/all-other-production and prior-fixture parity.
3. Strict physical/legacy/both-indexes/service-instance constructors, prototype/base identity, header object/content/mutability and runtime export keys.
4. Saved-original/current real GoogleSheetsClient/fake-auth/fetch request traces, modes/URL/body/cell order and rejection identity.
5. Unchanged actual Sales sync/refund-report/profit-cost workflows, Bangkok query bounds, deterministic original ID/clock handling, idempotent sync and partial append failure/order.
6. Runtime module/legacy-composition DAG/browser checks.
7. Runtime-plus-type module/legacy-composition DAG/browser checks.
8. Global client runtime isolation and unchanged pre-existing erased reachability.
9. Actual exact lint positive/negative bypasses and unchanged audit resolution.

Compile-time fixtures additionally prove constructor/instance/header parity without any casts. New lint entries extend the existing worksheet rule only to these ten exact Sales paths; prior worksheet/root/application/adapter/PR20 scopes remain in force. Aliases, relative/private/module/config/registry imports, value imports of erased interfaces, re-exports, dynamic/require/import-type and direct IO/time/env access are rejected. No server marker is added that would change original evaluation.

## Verification and deferred ownership

Baseline: 410 tests pass, lint exit zero with the inherited unused shipmentRow warning at tests/shipments-read-seam.test.mjs:6, typecheck and isolated credential-free build pass. Final results and counts are recorded in [verification](verification.md#pr-22--sales-worksheet-ownership). Node 24.22.1, existing dependencies only.

All inherited Orders/Shipment HTTP/Sheets/Drive/picker/financial/partial-write tests stay enabled. Every existing Sales service/API/client source remains byte-identical. No UI, provider/auth, registry/factory/indexes, other worksheets/headers, business calculations, package/lockfile/env/schema/data changes. Route contracts remain 23 pages / 35 APIs; app-paths manifests are byte-identical, expected SHA-256 `32f92c7a1ef17213d7a8642ca89e3e71218984982bf1bdce66b560ef35893e1e`.

Results are Codex-local, not independent GitHub/Vercel CI. Tests use synthetic receipts/payments/refunds, fake auth/fetch/clocks/UUID and fake worksheet operations. No live Google/LINE/Loyverse, production credentials/records, operational scripts, permissions/provider availability, real-browser visual or concurrency guarantees, merge/approval/deploy.

Only this Sales worksheet ownership slice is complete. Sales use cases/report/sync/API and aggregate imports remain legacy; no use-case extraction or barrel retirement occurs. HR, inventory, expenses/shop, movement/user-state and other worksheet ownership remain future work, as do six legacy browser type-only debts, registry/compatibility retirement, provider/persistence changes, SaaS/auth/tenancy/billing, retries/queues/concurrency and data migrations.
