# Regression baseline and verification

## Run locally

Use Node 24 (verified with 24.22.1) and the existing installed dependencies. No new dependency or lockfile was added. The test runner uses Node's built-in `node:test` with `--test-isolation=none`; this avoids child-process reporting restrictions in the managed executor. Each loaded production source has its own VM context, explicit dependency stubs, no process/env object, and a throwing default fetch. This VM setup is an offline test aid, not a security sandbox for untrusted code. Do not load arbitrary files or real adapters through it.

```sh
npm test
npm run lint
npm run typecheck
```

For a safe build, use a checkout without `.env`, `.env.local`, `.env.production`, or `.env.production.local` (the tracked `.env.example` is fine). Next automatically reads these files even when the process environment is cleared. Check filenames only; do not read secrets. Do not remove someone else's env files: use a clean checkout instead if present.

```sh
env -i PATH="$PATH" CI=1 NEXT_TELEMETRY_DISABLED=1 npm run build
```

This clears all inherited integration credentials and disables telemetry. The current build prerenders UI without fetching production records. It is not a universal network sandbox: if a future page starts fetching data during prerender, supply explicit fake dependencies in an isolated verification checkout before building. Never run `setup:rich-menu` as a check. Do not start the app with live credentials to test a refactor.

## Added characterization coverage

| Area | What is checked |
| --- | --- |
| Salary advance allocation | Oldest-first recovery, cap at earnings, zero net/nonnegative pay, carry-forward, prior settlement recovery, exclusion of unpaid/future/other employees, cent precision |
| Receipt identifiers | Existing sanitization, fallback and date formatting used for stable sync IDs |
| Movement quantities | Standalone numbers in Thai notes, comma/decimal quantities, label digits excluded, positive delivery quantities |
| LINE signature | Exact raw bytes, modified body rejection, missing/invalid signatures and missing secret; fake secret only |
| Sheets transport | Quoted worksheet names, ordered batch ranges, empty/incomplete batch handling, RAW values and legacy USER_ENTERED defaults; fake auth/fetch only |
| Routes | All 23 page entrypoints and 35 API route files, dynamic segments and explicitly exported HTTP methods against a reviewed base fixture |

`tests/fixtures/route-contracts.json` was captured from the untouched audited source. The scanner includes direct function/variable HTTP exports and named re-exports. It covers the current App Router source paths; it does not model future rewrites, intercepting routes, middleware, implicit HEAD/OPTIONS behavior or query/response semantics. Keep it reviewed and extend it if routing techniques change. Do not automatically regenerate it in `npm test`. `icon.svg` and Next-generated `/_not-found` are build assets/routes rather than page entries; compare build manifests as well.

The tests execute the existing functions after transpilation with the already installed TypeScript compiler. They do not copy financial formulas into a second implementation. Only the pure salary deduction function is exercised; employee/shop dependencies throw if called. TypeScript checking remains a separate check because transpilation is not type checking. Coverage is intentionally small and must expand for each migrated slice; it does not prove payroll, stock, or integration workflows end to end.

## Phase 1 verification results

Base: `383cf5956b7e8a0705586936c78b7efd29ec6102`, confirmed against remote `main` through the GitHub connector. The shell Git fetch failed because its proxy was unavailable; this is an environment connectivity issue, not a source/build failure.

| Check | Before changes | After changes |
| --- | --- | --- |
| Existing ESLint command | Pass | Pass |
| TypeScript (`tsc --noEmit`; baseline also disabled incremental reuse) | Pass | Pass |
| Credential-free production build | Pass | Pass |
| Added offline regression tests | No existing test command/suite | 10 pass |
| Source route paths/methods | Captured unchanged base | 23 pages / 35 API routes unchanged |
| Next app-paths manifest | Saved baseline build manifest | Identical |
| Production source/config/assets/schema/env names | Audited base | No changes to `src`, public assets, Next/TS/ESLint config, `.env.example`, or `yarn.lock` |

No baseline lint/build/type failures were found. No new failures remain. The only existing file modified is `package.json`, adding test and typecheck scripts. All other additions are documentation and tests. No existing production files were moved, renamed, or rewritten; no empty target modules were scaffolded.

Not verified: browser rendering/interactions, real LINE delivery/retries, Loyverse sync, Google Sheets/Drive permissions or data, actual payroll settlement writes, concurrency behavior, deployment protection, or production configuration. These checks would require isolated fake/staging scenarios beyond this preparation task. No live integration, production data, credentials, deployment or rich-menu mutation was used.

## PR 2 — Browser-safe Orders contracts

Base: `e77ddc1ce2b73a19e218a5d20353c5b04e23ff16` (merged PR 1). The connector confirmed its tree matches the prior Phase 1 checkout; its verified signed commit was imported locally because the shell Git proxy remains unavailable. No branch was based on unmerged preparation changes.

| Check | Baseline on main | PR 2 |
| --- | --- | --- |
| `npm test` | 10 pass | 32 pass |
| `npm run lint` | Pass | Pass, including actual scoped Orders restrictions |
| `npm run typecheck` | Pass | Pass, including legacy export and nested shipment projection compatibility assertions |
| Credential-free `npm run build` | Pass | Pass |
| Route source fixture | 23 pages / 35 API routes | Unchanged; fixture not regenerated |
| Next app-paths manifest | Saved from baseline build | Identical |
| Runtime statement comparison | Base production source | All 16 modified existing production files have identical emitted statements after removing imports/exports and relocated enum declarations |

No baseline or new test/lint/type/build failures were found. No dependency/lockfile, API handler, integration implementation, env configuration or worksheet schema changed. Enum extraction retains object identity through legacy exports. The only shipment implementation-file change is a type-only import in the pure `types.ts` file.

New synthetic fixtures were captured by executing the original main order list/detail functions against fake worksheets; DTO declaration fixtures were captured from original type aliases. Tests also exercise creation IDs/status/append values with a fake writer, existing quantity UI state descriptors without rendering a browser, browser reads/writes/multipart requests with fake fetch, and actual detail HTTP response translation with fake services. No live Sheets/Drive/LINE/Loyverse calls occurred.

Remaining limitations: no real browser interaction or provider end-to-end tests, repository-wide type graph/third-party package internals are not checked by the scoped runtime graph, and the pure shipment bridge plus shipment HTTP client's legacy type-only imports remain until PR 5. See [Orders contracts](orders-contracts.md) for ownership/removal criteria. Existing authentication and Sheets concurrency issues are unchanged. No merge or deployment is performed.

## PR 3 — Orders UI restructuring

Verified latest `main` exactly matches the requested `d10d530a2052cfc10bdb71708af267ccd8db91bb`. GitHub confirmed PR 2 merged at that commit; its tree matches the prior verified checkout. A dedicated `refactor/orders-ui` branch starts at that commit. The GitHub connector is used for repository access because the shell proxy was unavailable in the preceding work. No production service access is used for verification.

| Check | Before moves | Final |
| --- | --- | --- |
| `npm test` | All 32 existing tests pass; all 9 new behavior tests also pass at original paths (41 total) | 44 pass: the same behavior tests plus 3 structural/cycle tests |
| `npm run lint` | Pass on base | Pass; all relocated TS/TSX files covered by tested import restrictions |
| `npm run typecheck` | Pass on base | Pass; PR 2 contract/legacy export assertions preserved |
| `env -i PATH="$PATH" CI=1 NEXT_TELEMETRY_DISABLED=1 npm run build` | Pass with no application env files/credentials | Pass with no application env files/credentials |
| Route source contracts | Existing reviewed fixture, 23 pages / 35 API route files | Unchanged; original route fixture not regenerated |
| `.next/server/app-paths-manifest.json` | Saved from the base build | Byte-identical |
| UI and consumers | Body/CSS fingerprints captured before moves | All 15 moves retain non-import statements, types, JSX and directives; all 4 CSS modules byte-identical; 4 route wrappers and 3 Shipments gallery consumers change imports only |
| Contracts, API handlers and integrations | Base files | Contracts byte-identical; API handlers, services, config, external/LINE implementations, public assets, env examples, package.json and yarn.lock unchanged |
| Dependencies | Recorded pre-move consumer audit | No stale browser source paths/duplicate implementations; no server implementations reachable at runtime; reachable type/value graph is acyclic |

No baseline test/lint/type/build failures were found, and no new failures remain. The same pre-move test expectations were retained after updating source paths. The nine added behavior tests cover list query/status/shipment filtering and pagination, mobile/expanded descriptors, loading/error/retry/abort, creation validation settings and required images, accepted/rejected files and navigation, product draft save payloads, shipment selection/create/link callbacks, gallery keyboard/modal controls, and browser product/shipment HTTP requests. Existing PR 2 tests preserve multipart, API error/invalid-response handling, enum identity and JSON compatibility. Expected edge cases, including different zero-byte file selection rules in creation versus add/replace, were retained.

The component harness executes actual component functions and callbacks against fake hooks, UI element descriptors and mock requests. It does **not** render React DOM, run Ant Design's validation engine, exercise browser focus/layout, or verify native file dialogs. No browser automation tool was available, so visual equivalence is not claimed. The runtime graph excludes type-only edges from browser-safety assertions; a separate graph checks cycles including type-only edges, but neither audits third-party package internals. Real integration permissions, data, delivery and concurrency remain untested. The documented shipment enum/browser-client bridges remain until PR 5. No data/schema changes, merge or deployment are performed.

## PR 4 — Initial Orders use-case seam

Latest main was confirmed at the supplied `a29396dc5d597b8ac7e40e95d9bb2ab652e59e4c`, the merged PR 3 commit. There were no intervening changes to review. A dedicated `refactor/orders-use-case-seam` branch starts there. All source callers were audited before extraction; the collection API and image workflow retain their imports through legacy compatibility exports. Detail/draft/image orchestration is not migrated.

| Check | Baseline | Final |
| --- | --- | --- |
| `npm test` | All 44 inherited tests pass; 15 added characterization tests pass against legacy code before extraction (59 total) | 68 pass with the same expectations and additional fake-port/adapter/transport/boundary tests |
| `npm run lint` | Pass | Pass, including application/server/adapter restrictions; UI protections retained |
| `npm run typecheck` | Pass | Pass, including legacy parameter/return/type compatibility |
| `env -i PATH="$PATH" CI=1 NEXT_TELEMETRY_DISABLED=1 npm run build` | Pass, no application env files | Pass, no application env files |
| Route source fixture | 23 pages / 35 API routes | Unchanged; fixture not regenerated |
| Next app-paths manifest | Saved base build manifest | Byte-identical |
| Contracts/UI/CSS | PR 3 source fingerprints | Unchanged; no UI/contract import updates needed |
| APIs and integrations | Existing routes, services, headers/transport | API files, external integrations, LINE/shipments, draft/image workflow, barrel, env/package/lockfiles unchanged |
| Project dependencies | Existing Orders reachable graph | No runtime/type-only cycle or browser-to-server leak; new application uses only contracts/ports |

No baseline failures or new failures remain. Legacy fixture cases preserve empty/populated sheets, every valid status, invalid/deleted/malformed rows, duplicate IDs/links, trimming/comma prices, image order and JSON fields. Read tests assert the exact three calls/ranges and concurrent launch, preserving failure propagation. Creation tests assert explicit/generated IDs, missing/null/zero/nonzero price, timestamp and generator invocation order, normalization, nine append values, one write and no success before append completes.

The write-adapter test goes through the existing OrdersSheet/BaseGoogleSheet/GoogleSheetsClient with fake auth/fetch: exactly one header-derived A:I append, original nine values and USER_ENTERED mode. No transport implementation changes. Application use cases also run solely against synthetic business ports, with explicit clock/ID functions and no provider credentials. Server composition supplies the original Date clock and sortable generator in production.

Unchanged image workflow tests preserve upload → order append → bill/item reference sequence, upload-failure cleanup/no-order behavior, and later storage-failure partial writes/no rollback/retry. Collection API tests exercise actual handlers with fake services for 200/201/400/500 responses and web creator; existing detail GET tests plus added PATCH tests preserve 404/409 and error shapes. Fingerprints retain the image/draft/barrel files and the getOrderDetail orchestration body. Existing 44 assertions/fixtures are retained; the legacy-source test loader was adapted for new module dependencies only.

Limitations: no live Google Sheets/Drive/LINE/Loyverse, production data, credentials, browser visuals or provider permissions were exercised. Fake transport tests cannot establish production availability/concurrency guarantees. Legacy detail and other Orders mutations remain unmigrated, as do the documented shipment UI bridges until PR 5. Server-only markers are validated by the successful Next build; the offline test loader stubs the marker intentionally. No merge, approval or deployment is performed. See [file-by-file design and removal criteria](orders-use-case-seam.md).

## PR 5 — Shipment contracts and characterization, first slice

Remote main was verified at exactly `60408c3e91ebecd0dc550bbf00464b9e6ce708d2` (merged PR 4), both before branching and before publication. No intervening commits required review. Branch: `refactor/shipments-contracts`. The GitHub connector provides repository access; shell Git's previously unavailable proxy is not needed. The full Shipments milestone remains incomplete.

| Check | Before production edits | Final |
| --- | --- | --- |
| `npm test` | All 68 inherited tests pass; 62 new characterization tests then pass against original services/handlers/UI (130 total) | 139 pass, including nine new contract/structure/boundary/graph tests; inherited assertions unchanged |
| `npm run lint` | Pass | Pass, actual scoped Shipment browser/contract rules added; Orders rule files unchanged |
| `npm run typecheck` | Pass | Pass, including public/legacy Shipment DTO and enum type equality |
| `env -i PATH="$PATH" CI=1 NEXT_TELEMETRY_DISABLED=1 npm run build` | Pass, no application env files | Pass in an isolated `/tmp` source checkout with copied installed dependencies, no application env files and cleared inherited environment |
| Source route contracts | Reviewed fixture, 23 pages / 35 API route files | Unchanged; original fixture not regenerated |
| Next app-paths manifest | Saved from baseline build | Byte-identical to isolated final build |
| UI/styles/Orders | Baseline non-import statement and raw file fingerprints captured before extraction | All five Shipment frontend bodies unchanged; Shipment CSS, wrappers, metadata, three API handlers and all Orders module files unchanged |
| Services/worksheet contracts | Original synthetic outputs and function-body fingerprints | Every Shipment service function unchanged; exact read invocation order/ranges and A:M / A:G / B:M column values retained, including M1 header-before-read side effect and failure propagation |
| Browser/project dependencies | Recorded consumer audit | No new runtime or type-only file cycle; no server implementations in reachable Shipment browser graphs; original enum object identity retained; no direct reverse Orders → Shipments module import |
| Dependencies/providers/data | Existing config, transports, worksheets and lockfile | package.json/yarn.lock, provider implementations, schemas, environment names, LINE/Loyverse/Drive and production data untouched |

No baseline or final test/lint/type/build failures remain. All runtime source and ESLint configuration files in the isolated build were compared byte-for-byte to the final working source. The original 68 tests remain intact; the existing component helper only gains Shipment contract/formatter stubs and Form method no-ops. The original route fixture and all existing Orders fixtures/expectations are retained. Additional transition-matrix, no-image quantity and malformed-link HTTP assertions extend the characterized behavior without changing expected results.

Synthetic tests execute original list/detail/cost/link/status implementations and actual HTTP handlers. They preserve null cost summaries/nested orders, duplicate/deleted rows and latest-link behavior, malformed iterable failures, original prices/quantities/floating-point semantics, error code/text/HTTP mappings, multipart file types/limits, upload-before-write, cleanup logging and partial writes with no new retries. Missing Drive remains 503; no fake test resolves a real provider factory. The status header write remains `updateRows("M1", [["shippingBillUrl"]])` before `readRows("A2:M")`, followed by the original twelve-cell B:M update only when appropriate.

Limits: component functions/hooks/callbacks run against fake hooks and element descriptors, not React DOM or Ant Design's validation engine. Layout, focus, native upload dialogs and visual equivalence were not verified in a real browser. Existing gallery keyboard/modal tests exercise the shared unchanged Orders implementation; Shipment tests verify its linked-order integration descriptors. Graph checks cover reachable project imports, including type-only edges separately, not third-party internals or all unrelated legacy code. Real provider availability, permissions, data and concurrent writes remain unverified. No live integration, credentials, deployment, approval or merge was used. The pure legacy enum/DTO leaf and unchanged Orders enum/client/server-projection bridges remain until the separately scoped decoupling step; see [exact consumers and removal criteria](shipments-contracts.md).

## Shipment UI follow-up — six safe moves; client relocation blocked

Main was verified at exactly `a0ff4127b68419d15a7836cdb130a3a33c87d21d`, and GitHub confirmed PR 5 merged at that commit. There were no intervening changes or unrelated pending edits. Branch: `refactor/shipments-ui`. Only six of the seven requested implementation/style moves are delivered; the browser client stays byte-identical in app because a forwarding entrypoint to a module client introduces a forbidden runtime Orders ↔ Shipments ownership cycle. See [the exact gate, consumers and prerequisite](shipments-ui-relocation.md). The full requested UI/client slice is not marked complete.

| Check | Before moves | Final |
| --- | --- | --- |
| `npm test` | All 139 inherited tests pass; three pre-move characterization tests also pass (142 total) | 148 pass: inherited expectations plus nine additional parity/structure/boundary/ownership tests |
| `npm run lint` | Pass | Pass, module UI glob and exact retained-client restrictions tested |
| `npm run typecheck` | Pass | Pass, inherited DTO/enum compatibility assertions retained |
| `env -i PATH="$PATH" CI=1 NEXT_TELEMETRY_DISABLED=1 npm run build` | Pass, no application env files | Pass in isolated `/tmp` source checkout, Node 24.22.1, existing installed dependencies, no application env files, cleared inherited environment |
| Route source fixture | Reviewed 23 pages / 35 API route contracts | Unchanged; fixture not regenerated |
| Next app-paths manifest | Saved from base build | Byte-identical to isolated final build |
| UI/CSS/wrappers | Pre-move body/CSS and route-wrapper hashes | All seven requested source bodies/CSS retain expected hashes; six files relocated once and client remains original; four wrappers retain metadata/JSX/params/keys/skeletons/a11y with import-only corrections |
| Shipment contracts / Orders picker / client | Merged PR 5 bytes | Byte-identical, including original enum/client imports and all browser request/response types/guards |
| Backend/provider/schema/package/env | Merged PR 5 implementation | No changes; APIs/services/worksheet classes and headers/ranges/modes unchanged; package.json, yarn.lock and .env.example unchanged |
| Browser dependency graphs | Inherited runtime/type file checks | No file cycles or server reachability; exact retained app client and enum leaf only |
| Module ownership | Existing erased Orders → app client → Shipment contracts trace | Runtime Shipments → Orders only; inherited type-only reverse trace explicitly recorded, with no extra trace allowed. A proposed forwarding module client is tested and rejected because it adds a reverse runtime edge |

No baseline or final test/lint/type/build failures remain. Built runtime/config files were compared byte-for-byte with final working sources. Existing result assertions are retained: only source locations change in the old Orders/Shipment fixtures, never expected hashes. Raw wrapper/Orders-lint fingerprints reverse only the reviewed import/scope location edits before comparison; new pre-move non-import wrapper fingerprints and exact import assertions independently protect those corrections. HTTP tests continue to load the original production browser implementation, and additional component callback tests feed those actual exports with fake fetch into Shipment list/detail and Orders picker flows.

There is no relocated client, forwarding shim, duplicate HTTP code, enum definition, new layer, use-case extraction or decoupling implementation. The two relocated screens have an explicit temporary import of the same original app client. Orders rules change only three consumer scope paths, preserving all original browser restrictions and exact exceptions. The full seven-file slice remains blocked until a separately scoped Orders-owned picker interface is injected at app composition and removes the reverse runtime consumer; existing type/projection/enum debt also needs its dedicated decoupling work.

Limits: component tests execute real functions/hooks/callbacks against synthetic element descriptors and fake HTTP, not React DOM or Ant Design validation. They do not prove browser visuals, layout, focus or native file dialog behavior. Project graph tests exclude third-party internals and unrelated legacy graphs. No real Sheets/Drive/LINE/Loyverse, provider permissions, production data/credentials, concurrency, rich-menu setup, production scripts, deployment, approval or merge were used. Offline service/HTTP characterization continues protecting original financial, upload, cleanup, failure and partial-write behavior without changing it.
