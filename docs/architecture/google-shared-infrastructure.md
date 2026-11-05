# Google shared infrastructure ownership — PR 19

Baseline: `9388f8a89f23e7547731ee649baf84af92c892e6`, verified exact main / merged PR18 before editing. Branch: `refactor/google-shared-infrastructure`. Only shared transport/auth ownership changes; feature business logic, adapters, routes and worksheet registry remain unchanged.

## Physical owners and compatibility

Each old path remains an explicit named runtime/type forward, with no second implementation. The new physical files preserve their complete original source except the four files requiring relative import corrections. Reversing those exact import strings reconstructs the original bytes. All constructor/function bodies, helper declarations, visibility, signatures and initialization behavior remain identical.

| Compatibility path | Physical owner | Original SHA-256 |
| --- | --- | --- |
| `src/externals/google/auth/GoogleAccessTokenProvider.ts` | `src/infrastructure/persistence/google-sheets/google-auth/GoogleAccessTokenProvider.ts` | `f7a3ee1ba8899fb5de1407bb86ea7840f23bfd564c8af83ab65f9507acdcbb1e` |
| `src/externals/google/auth/GoogleOAuthRefreshTokenAuth.ts` | `src/infrastructure/persistence/google-sheets/google-auth/GoogleOAuthRefreshTokenAuth.ts` | `449d839f4384108e79b08558a9168713aef0956a96b3c514dbd1eb3aeaf61cfd` |
| `src/externals/google/auth/GoogleServiceAccountAuth.ts` | `src/infrastructure/persistence/google-sheets/google-auth/GoogleServiceAccountAuth.ts` | `ac2a56b61ec39585043c21c4f6a869332974f794f2ddfd051561a1ade9a2d89e` |
| `src/externals/google/auth/const.ts` | `src/infrastructure/persistence/google-sheets/google-auth/const.ts` | `b5eba3848b88192b5cdc21cf22342a81337ab5211431d602cc2d5193314ae610` |
| `src/externals/google/auth/types.ts` | `src/infrastructure/persistence/google-sheets/google-auth/types.ts` | `841038036b0f40c5c83b990e960fe2225d2bc89ef718dad1f749e09dc25bbbb1` |
| `src/externals/google/utils/jwt.ts` | `src/infrastructure/persistence/google-sheets/google-auth/utils/jwt.ts` | `e37192ac88de9b1e7450c5b1f5661aaaf3c585ff5a2f5d33ba97edaa59dd4df5` |
| `src/externals/google/sheet/client/GoogleSheetsClient.ts` | `src/infrastructure/persistence/google-sheets/client/GoogleSheetsClient.ts` | `9c42cfc2230706bb54bbc8a7de05f8fe475cde490b47e471732d81a72c270e71` |
| `src/externals/google/sheet/client/index.ts` | `src/infrastructure/persistence/google-sheets/client/index.ts` | `ec19da102206f24cb335030e337635fba13e3549856136fd715531100a4a05c0` |
| `src/externals/google/sheet/const.ts` | `src/infrastructure/persistence/google-sheets/const.ts` | `c39fa41037c56506c32b8907a5828b540f342074a2f1ee0f35894a5dd0e45fc5` |
| `src/externals/google/sheet/sheets/BaseGoogleSheet.ts` | `src/infrastructure/persistence/google-sheets/sheets/BaseGoogleSheet.ts` | `0761a125b7818032dd2daa41df679b41624b6a060a42857eae401ef479a11678` |
| `src/externals/google/drive/GoogleDriveService.ts` | `src/infrastructure/files/google-drive/GoogleDriveService.ts` | `5b413f9906eb290d92c17dc3869e9591ffbf76c04143e393ac702d77dc57028c` |
| `src/externals/google/drive/const.ts` | `src/infrastructure/files/google-drive/const.ts` | `55f6116bc05c69cd8913a88aa4650b88f9460fb425c6846e3eedeea1a1604456` |
| `src/externals/google/drive/createGoogleDriveServiceFromConfig.ts` | `src/infrastructure/files/google-drive/createGoogleDriveServiceFromConfig.ts` | `e113b1ef86506ca1e8129ac8c6945e3040fa02103beb57ae0cd8460392ebaafd` |
| `src/externals/google/drive/index.ts` | `src/infrastructure/files/google-drive/index.ts` | `ac7f376eb62645bd3255b816bcaa83eb59e482fded13fe9ca330f5570e17bef9` |
| `src/externals/google/drive/types.ts` | `src/infrastructure/files/google-drive/types.ts` | `5a309170e52b0987bc3575635af7f2dd147d1727c4997eafc44e0f17158f0096` |

The six declarations `GoogleSheetCellValue`, `GoogleSheetRow`, `GoogleSheetRangeUpdate`, `IGoogleSheet`, `IGoogleRowsSheet`, and `IGoogleBatchRowsSheet` now reside verbatim in `infrastructure/persistence/google-sheets/types.ts`. The old `externals/google/sheet/types.ts` retains the unchanged aggregate `GoogleSheetsConfig`, `IGoogleSheetsService`, `MovementWorksheet` and `MovementRange` declarations, imports only three erased generic types needed by them, and explicitly forwards all six generic types. No generic module contains feature worksheet names or the feature registry.

`GoogleSheetsService`, its config factory/index, all feature worksheet classes/headers and every production consumer remain byte-identical. The old service still constructs the single root client/auth classes through compatibility paths, and worksheet subclasses still inherit the single root BaseGoogleSheet. No parallel registry, provider, SDK or domain abstraction is introduced.

## Dependency and consumer audit

The saved baseline consumer audit resolves TypeScript aliases and relative paths, including erased imports, re-exports, dynamic/import-type/require syntax, across production, tests and operational scripts without executing scripts. It records 278 production TS/TSX files, 115 direct affected import/export edges, and all three operational scripts. The scripts have no direct imports of the moved leaves; their existing indirect service/configuration wiring is unchanged.

Root Drive depends on root shared Google auth. Root Sheets client/base depend only on root transport/types. Root auth depends only on its own constants/types/JWT and Node crypto. None imports legacy externals, feature modules, applications, app routes or UI. The Drive factory retains its existing **erased** AppConfig input: the type graph traverses config's existing pure `features/backend/shared/utils` dependency, but configuration is never evaluated by importing the factory. Moving that existing config helper is outside this PR.

Resolved runtime and runtime-plus-type graphs are acyclic across the migrated files and all Orders/Shipment module roots. Shipments → Orders public contracts remains the only feature direction. Both browser graphs stay free of services, root transports, server/application implementations, config and providers. Existing strict feature rules are unchanged. New exact-path root ESLint rules admit only the audited import strings, reject legacy/feature/re-export/dynamic/type/require bypasses and permit config solely as an erased factory input. No `server-only` marker is added to moved source: that would change its original evaluation/import behavior; browser isolation is checked through resolved graph and existing UI rules.

## Behavior and identity evidence

New tests run the saved original providers and production providers with synthetic auth, fake fetch, clocks and signing primitives. Nine characterization tests passed against untouched source before moving it. Post-move checks also execute the real old named forwards, with one cached physical module per test graph, and prove identical constructors/functions, nominal TypeScript types, export names/order and repeat-import identity.

Auth tests preserve OAuth-refresh-first Drive selection, service-account fallback and Sheets service-account scope, lazy factory construction, exact required-field validation, strict 60-second cache boundary, clock order, JWT claims/RS256/base64url input, form encoding, payload errors, original network rejection identity and no retry. Existing OAuth token payload quirks are not repaired.

Sheets tests exercise the actual transport for quoted/encoded URLs, ordered/empty/incomplete batch results, default USER_ENTERED/INSERT_ROWS, RAW updates, batch payloads, row deletion indices, worksheet creation, 204 handling and original errors. Existing feature transport regressions retain Shipment A:M creation, A:G linking, M1-before-A2:M and conditional B:M status writes, and Orders five-read detail ordering.

The inherited four Drive-provider tests execute the moved real provider through the old forward, retaining exact multipart bytes/boundaries/content lengths, token/header timing, encoded upload/permission/delete/health URLs, optional public permissions, provider-internal cleanup/logging and network/error identity. All existing HTTP/Drive orchestration tests remain active, including upload-before-status and best-effort cleanup/partial failure behavior.

## Historical evidence and test harness

`tests/fixtures/google-infrastructure-before.json` retains complete original provider/type source, raw hashes, base SHA and every original production hash. `google-infrastructure-consumers.json` records the baseline resolved audit. Declaration comparisons retain all generic/aggregate type ASTs; full source restoration is stronger than helper-only fingerprint matching. No previous fixture is edited or regenerated.

Only the PR15/16 complete production inventory assertions recognize the exact 16 reviewed old paths through `assertGoogleHistory`; original expected hashes remain authoritative. The existing strict creation graph admits only four new pure constant/interface paths and verifies the one erased generic-type import in the aggregate type file.

The shared VM loader follows only the exact old → new named forward from the recorded move map and translates the four reviewed dependency-stub import corrections. It still executes both forwarding module and actual production implementation; every dependency must remain explicitly supplied, default fetch throws and unapproved dependencies reject. The feature-specific closed Shipment/Orders loaders are not widened to arbitrary providers. The new closed provider graph admits only the captured moved leaves and unchanged existing Sheet registry/worksheet source inventory, stubs crypto only for synthetic signing tests, and never evaluates config/auth SDKs or real credentials.

## Verification and limitations

Node 24.22.1 and existing dependencies. Baseline: 375 tests pass, typecheck passes, lint exits zero with one inherited unused `shipmentRow` warning at `tests/shipments-read-seam.test.mjs:6`, and isolated build passes. Final results are recorded in [verification](verification.md#pr-19--google-shared-infrastructure).

Both builds use isolated source roots with no application .env files, only tracked .env.example, and `env -i PATH="$PATH" CI=1 NEXT_TELEMETRY_DISABLED=1 npm run build`. Source route fixture remains unchanged: 23 pages / 35 APIs. Baseline/final Next app-paths manifests are byte-identical, SHA-256 `32f92c7a1ef17213d7a8642ca89e3e71218984982bf1bdce66b560ef35893e1e`.

No package/lockfile/env/schema/provider protocol, HTTP/UI/CSS, business calculations or production records change. Results are Codex-local, not independent GitHub/Vercel CI. No live Google/LINE/Loyverse, credentials, operational scripts, production records, browser visual parity, Google permissions/availability, concurrency or deployment were verified.

Only shared Google transport ownership is complete. Legacy named forwards, feature worksheets/headers, aggregate service/configuration/registry, remaining Orders facades and other legacy integrations remain until separately reviewed consumer migrations. Provider replacement, registry retirement, Supabase, SaaS/auth/tenancy/billing, data/schema migrations, retries/queues and concurrency changes are deferred.
