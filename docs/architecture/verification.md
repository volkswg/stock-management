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

## Orders-owned Shipment picker seam

Main was confirmed at exactly `c58669b7a00e8c9169423228fa6f18ab782c358a`, the PR 6 merge commit, with no intervening changes or unrelated pending edits. Branch: `refactor/orders-shipment-picker-port`. [Exact interface, composition and reviewed structural changes](orders-shipment-picker.md).

| Check | Baseline | Final |
| --- | --- | --- |
| `npm test` | All 148 inherited tests pass; thirteen new real-client picker tests then pass before production edits (161 total) | 175 pass, including all inherited tests with documented required port/structure changes and 27 added tests |
| `npm run lint` | Pass | Pass; Orders browser exceptions removed, pure-port/client-composition scopes added; Shipment rules unchanged |
| `npm run typecheck` | Pass | Pass, including required port prop, four-field Orders projection, input/status and void-result assertions |
| `env -i PATH="$PATH" CI=1 NEXT_TELEMETRY_DISABLED=1 npm run build` | Pass with no application env files | Pass in isolated source checkout with Node 24.22.1 and existing installed dependencies, no application env files and cleared inherited environment |
| Page/API route fixture | 23 pages / 35 API route source contracts | Unchanged, fixture not regenerated |
| Next app-paths manifest | Saved base build manifest | Byte-identical |
| Orders server page | Original metadata, params and orderId render | Only import/render target changes to app client composition; original metadata/params fingerprint retained after exact tag substitution; only serializable orderId prop |
| Orders detail UI | Captured all original statement fingerprints | Required port and reviewed three-function plumbing only; all original statement hashes retained after surgical AST comparison; unrelated JSX/CSS/functions unchanged |
| Browser dependencies | Runtime Shipments → Orders; inherited reverse type-only Orders trace | Runtime and type-only module ownership only Shipments → Orders; no reverse exception; file graphs acyclic and browser graphs free of server IO |
| Contracts/client/backend/data | Merged PR 6 bytes | Shipment client, public/legacy enum/DTO files, Orders contracts, Shipment UI, services, APIs, providers/worksheets, schema/package/env/lockfile unchanged |

No baseline or final failures remain. The isolated build's runtime/config files were compared byte-for-byte with final sources. Both checkout roots were checked by filename for application env files, without reading credentials. No new packages, empty layers, client copy/forwarding shim or physical enum transfer is introduced.

Thirteen new tests execute original picker callbacks with the actual Shipment HTTP client and fake fetch before edits, preserving selection/no-selection/duplicate behavior, exact exclusion order/query, headers/cache/signals, abort/retry/no-auto-retry, loading/disabled states, create/link requests/errors/guards, modal state and notifications. After injection they execute the same expectations through the real production app adapter. Additional tests use fake Orders-owned ports, check module-scope stable adapter identity and replacement abort, await real link response validation, exercise network error identity and malformed responses, assert temporary PO/form reset behavior, and verify server-only serializable props/no DOM wrapper plus runtime/type graphs. Existing Shipment/Orders HTTP, enum identity, service/cost/status/upload/partial-write tests remain intact.

Original golden fixtures are not regenerated. Necessary structure changes are explicit: one new pure port file is added to the Orders UI inventory; Orders detail's three functions are compared after reversing only reviewed prop/call/effect plumbing; the route allows only the component target rename; obsolete whole-file lint equality becomes unchanged static-selector parity and stronger actual rule fixtures. Raw snapshots remain authoritative for every unchanged file. The harness drops obsolete direct Orders client/enum mocks and supplies ports explicitly; real-client tests continue executing production request and guard logic.

Current scope stops after the browser picker seam. Client relocation is now unblocked at the browser ownership level but remains unimplemented. Legacy Orders server detail projection/service coupling, enum physical ownership and the full Shipments milestone remain future work. App composition can depend on both features; no feature imports it. A virtual regression case restores the old direct import plus forwarding shim to expose the prohibited cycle; a separate virtual-only case confirms the future client move now preserves one-way ownership without shipping it.

Limits: synthetic hooks/element descriptors execute production callbacks but do not render React DOM, run Ant Design validation, or verify browser visuals, focus, layout or native dialogs. Project graphs exclude third-party internals/unrelated legacy server dependencies. No real Sheets/Drive/LINE/Loyverse, credentials, production data, provider permissions, concurrent writes, operational scripts, deployment, approval or merge were exercised. Original routes, financial/status/image/upload behavior and all provider/schema/write semantics remain unchanged.

## PR 8 — completed Shipment browser-client relocation

Main was verified at exactly `a3241ecd7ae3bdf14b0c1ede8681bf28e80e850a`, the merged PR 7 commit, with no intervening changes or unrelated pending edits. Branch: `refactor/shipments-browser-client`. The seventh requested implementation file moves from `src/app/shipments/api.ts` to `src/modules/shipments/ui/api.ts`; no shim, copy, proxy or placeholder remains. The seven-file Shipment UI/client relocation slice is complete. The full Shipments milestone remains incomplete.

| Check | Before move | Final |
| --- | --- | --- |
| `npm test` | All 175 inherited tests pass; eleven added characterization tests also pass against the original location (186 total) | 188 pass: all inherited behavior plus thirteen added fingerprint/wire/consumer/structure/boundary tests |
| `npm run lint` | Pass | Pass; both Shipment app-client exceptions removed; narrow client rule retargeted and app composition whitelist updated |
| `npm run typecheck` | Pass | Pass, inherited client/port/DTO compatibility retained |
| `env -i PATH="$PATH" CI=1 NEXT_TELEMETRY_DISABLED=1 npm run build` | Pass, Node 24.22.1, no application env files | Pass in isolated source checkout with existing dependencies, no application env files and cleared inherited environment |
| Client raw bytes | SHA-256 `7aa8e27b7928a27637ad8fcc0480c4c471bd4deeee25b7c4c314a95f709eb379` | Identical at destination; also compared directly with original main blob |
| Client non-import body | `64c6c72f42853451eb087a5db681a628d9db304c0755281da8099b63ca3f669e` | Identical; five runtime exports, all thirteen public/private function declarations and seven type declarations retain captured original values |
| All seven moved files / consumers | Original golden body/CSS/raw hashes | All match; client flag changes false → true only, source lookup follows destination; original raw hash/history not regenerated; all three consumer bodies unchanged |
| Source route fixture | Reviewed 23 page / 35 API route contracts | Unchanged; fixture not regenerated |
| Next app-paths manifest | Saved baseline build | Byte-identical to final isolated build |
| Page/UI/port/contracts/backend | Merged PR 7 source | All page/loading wrappers, metadata/params, Orders picker port/detail, CSS, contracts/enum, APIs, services/providers/worksheets, schema/package/env/lockfile unchanged |
| Dependency ownership | One-way runtime/type browser ownership after picker seam | Still Shipments → Orders, no reverse Orders feature edge, no module/file cycle, no browser server reachability; app composition may depend on both modules |

No baseline or final test/lint/type/build failures remain. Built runtime/config files were compared byte-for-byte with final sources. The only production differences are the client rename and three import paths: list `./api`, detail `../api`, Orders app client composition `@/modules/shipments/ui/api`. Structural tests resolve exactly those three consumers, one `getShipments` implementation, and no retired production import/file. Existing `from/to/hash` history, six other move expectations, original client raw hash, Orders surgical AST baselines and unrelated CSS values are retained.

The same production HTTP implementation executes through every relocated-client test. New pre-move characterization checks default/optional fields, exact GET/POST/PATCH URLs/methods/headers/cache, encoded IDs, multipart boundary-header omission, original deliveryFee omission, zero-byte File behavior, shallow guard acceptance, empty/non-string error fallbacks, network/AbortError/JSON rejection identity and no retries. New list/detail consumer tests execute real client reads, retry/abort, status JSON and shipping-bill multipart callbacks. Existing Orders picker tests execute the unchanged production app adapter through the actual relocated client, preserving exclusions/order, signal identity, preselection/deduplication, create/select/link/messages and response-guard completion before void resolution. All inherited service/status/cost/Drive/error/partial-write tests remain.

Shipment module UI now forbids every app import; no screen override survives. The exact client override allows only erased public Shipment contracts and browser fetch, rejecting provider/config/Node/server/application/infrastructure/unapproved types/dynamic/re-export bypasses. Orders app composition names the new path only, and Orders feature UI has no Shipment exception. Actual runtime/type graphs replace the former virtual relocation check; the negative old direct-import/forwarding scenario remains virtual test data only. The pure legacy enum leaf remains the documented browser exception behind public contracts, with one unchanged runtime object.

Limits: fake hooks/descriptors do not establish real React DOM/Ant Design validation, visual layout, focus or native-dialog equivalence. Project graph checks exclude third-party internals and unrelated legacy server dependencies. No real Google Sheets/Drive/LINE/Loyverse, production data/credentials, provider permissions, concurrency or operational scripts were exercised. Financial/status/image/upload/cleanup/worksheet range/mode semantics remain untouched. No server projection refactor, physical enum transfer, application/use-case/adapter migration, new package, approval, merge or deployment was performed. See [completed relocation and remaining debt](shipments-ui-relocation.md).

## PR 9 — Shipment creation use case and Sheets writer

Main was confirmed at exactly `7900bc93c8de47cf435fa14b07a76eb8710b9348`, the PR 8 merge commit, with no intervening changes or unrelated pending edits. Branch: `refactor/shipments-create-seam`. Only server creation is extracted. [Exact ownership, sequencing, compatibility and historical evidence](shipments-create-seam.md).

| Check | Baseline | Final |
| --- | --- | --- |
| `npm test` | All 188 inherited tests pass; eleven added characterization tests pass against the original legacy function (199 total) | 212 pass: inherited tests with exactly two reviewed creation fingerprint cases, plus 24 new characterization/application/adapter/transport/boundary tests |
| `npm run lint` | Pass | Pass; new server scopes registered, existing browser/Orders boundary files unchanged |
| `npm run typecheck` | Pass | Pass, including original direct/barrel/server input/return equality and consumer-owned port types |
| `env -i PATH="$PATH" CI=1 NEXT_TELEMETRY_DISABLED=1 npm run build` | Pass on clean main; also pass from an isolated archive of the exact base | Pass from isolated source checkout, Node 24.22.1, existing dependencies, no application env files/inherited integration credentials |
| Next app-paths manifest | Saved baseline and isolated-base manifest match | Byte-identical to isolated final build |
| Source routes | Reviewed 23 page / 35 API route contracts | Unchanged; fixture not regenerated; every API/page/loading wrapper stays in place |
| Creation behavior | Original source, type text, field order, synthetic results and append payloads captured before edits | Same PO validation before any clock/ID/sheet access; one clock then one original ID generation; original object/actor/carrier/null/empty fields; one awaited A:M append and original errors/no retry |
| Sheets transport | Original worksheet classes/headers/ranges/modes | Actual adapter → ShipmentsSheet → BaseGoogleSheet → GoogleSheetsClient with fake auth/fetch: one thirteen-field A:M USER_ENTERED/INSERT_ROWS append |
| Legacy compatibility | Direct create function and barrel exports | Same composed function identity through direct and unchanged barrel; API POST remains byte-identical with web actor/201 and original validation/500 behavior |
| Fingerprints | All existing expected hashes retained | Only createShipment/getShipmentsAppendRange location assertions receive explicit migration handling; original source/hash fixture preserved, mapping/validation/object/range AST comparisons added; every other fingerprint assertion unchanged |
| Dependencies | Existing one-way browser graphs and closed loader | New runtime/type-only creation closure acyclic and exact; browser graphs still Shipments → Orders with no server reachability; single enum identity unchanged |
| Unrelated code/data | Merged PR 8 implementation | List/detail/link/status/Drive, all UI/client/CSS/Orders picker/contracts, API/provider/worksheet classes, original ID utility, env/package/lockfile and schemas/data untouched |

No baseline or final test/lint/type/build failures remain. Both isolated checkout roots contain only the tracked `.env.example`; filenames were checked without reading credentials. Built runtime/config files were compared byte-for-byte with final sources. New production files are exactly the application, writer port, Sheets adapter and server composition; the only modified existing production implementation is the one-line legacy create re-export.

The eleven pre-extraction tests preserve whitespace normalization, omitted/empty/whitespace/nullish carriers, original absence of application length limits, untouched actor text, exact record key order/thirteen row values, validation/getter/clock/ID/carrier/write ordering, pending success and append/clock/ID rejection identity. Additional tests run the pure application with fake business ports and real adapters/composition with fake worksheets, verify lazy constructor and invalid-PO behavior against a throwing shipments getter, direct/barrel/server identity, await-before-success/same-record return, one-write/no-compensation failures, and real existing transport options. The inherited actual collection POST test still verifies original 201/400/500 responses.

The old `shipments-structure.json` is byte-identical. The two creation hashes now assert against the full saved original source, rather than a missing implementation body; the compatibility file must have exactly the one named re-export. Separate AST checks preserve first validation statements, business object (only generator call name injected), row array and range expression; all other service/UI/contract/route/client/Orders fingerprints stay active. No blanket service skip or snapshot regeneration is used.

The closed loader adds only four exact creation files and two explicit pure constants, stubs server-only in tests only, and preserves existing deterministic clock/ID defaults for inherited tests. It rejects arbitrary config/auth/Drive/provider/new application paths. Scoped ESLint rejects concrete IO, Date/random/env/framework/provider imports in application, enforces exact adapter/server imports and erased Sheets interfaces, and prohibits dynamic/type-import/re-export bypasses. Original browser protection files are unchanged. Creation dependency graphs cover runtime and type edges; browser graphs and ownership checks remain one-way and server-free.

Remaining work: list/detail, linking, status and Drive workflow seams/adapters; the legacy Orders server detail projection; physical enum and legacy facade cleanup after consumers migrate. The full Shipments milestone remains incomplete. Synthetic tests/graphs do not prove real Google permissions/availability, concurrency safety or real-browser behavior. No live Sheets/Drive/LINE/Loyverse, production data/credentials, operational scripts, schema changes, new packages, approval, merge or deployment were used.

## PR 10 — Shipment list/detail read seam

Base: `1d6392abfcc117de1c70a966e78cabe41c0cc9ab`, confirmed as the PR 9 squash merge and latest main with no intervening commits. Dedicated branch: `refactor/shipments-read-seam`. Initial working tree was clean. Node 24.22.1 and existing dependencies were used; no application credentials or production provider calls.

| Check | Baseline | Final |
| --- | --- | --- |
| `npm test` | 212 inherited pass; five new characterization tests separately pass on the original legacy implementation before extraction | 235 pass: 212 inherited plus 23 added, zero failures/skips |
| `npm run lint` | Pass | Pass, including exact read-specific server scopes and unchanged creation/browser restrictions |
| `npm run typecheck` | Pass | Pass; original direct/barrel/server read inputs, returns and business port compile-time assertions |
| Credential-free production build | Pass in `/tmp/read-baseline-safe`, archived from verified main | Pass in `/tmp/read-safe-build`, copied from tracked/nonignored final sources |
| Page/API source contracts | 23 pages / 35 API route files | Identical, original route fixture not regenerated; all API/page/loading source bytes unchanged |
| Next app-paths manifest | Baseline SHA-256 `32f92c7a1ef17213d7a8642ca89e3e71218984982bf1bdce66b560ef35893e1e` | Byte-identical, same SHA-256 |
| Historical read source/helpers | Full source/raw hash and thirteen declaration hashes captured before extraction | Eleven helper declarations retain exact hashes at new destinations; two orchestrations have explicit history and executable parity assertions; original fixture hashes untouched |
| Creation and unrelated production code | Merged PR 9 implementation | Creation function declaration/body byte-identical; app/writer/facade/barrel, link/status, Orders detail, enum/contracts, browser/UI/CSS, API/provider/worksheet code unchanged |
| Dependency graphs | One-way browser ownership, closed creation graph | Runtime/type-only server graphs include exact read dependencies, remain acyclic; browser ownership remains only Shipments → Orders and reaches no server/application/provider |

Both builds ran `env -i PATH="$PATH" CI=1 NEXT_TELEMETRY_DISABLED=1 npm run build` in isolated source roots with only tracked `.env.example`. Env filenames were checked without reading credentials. Installed dependencies were hardlinked from an existing isolated dependency tree; no package install or lockfile changes. Final isolated production sources were compared byte-for-byte with the implementation checkout. Ignored TypeScript incremental caches are generated check artifacts, not source changes or PR files.

Five pre-extraction tests characterize concurrent four-read launch/completion, duplicate link/image/Order/Shipment behavior, conditional worksheet getters, rejection identity/no retry and malformed-row processing order. Thirteen additional seam tests exercise fake business readers, real reader/composition, the saved original implementation, exact fixture JSON/events and malformed collection/row errors, synchronous failure short-circuiting, history/helper AST parity, unchanged creation composition, legacy identity and actual GET handlers. One of these executes the reader through all four real worksheet classes, BaseGoogleSheet and GoogleSheetsClient with synthetic auth/fetch, verifying populated fixture output, A:M/A:G/A:I/A:J read ranges, original GET options and includeOrders=false's single read. Five scoped boundary tests protect exact imports and bypasses and retain one-way ownership. Existing cost/null/quantity/floating-point tables and 200/400/404/500 HTTP/error assertions remain active.

Necessary inherited structural changes are exactly: server export expectation includes the two new named reads; creation server graph's closed allowlist includes three exact read files; historical checks recognize thirteen explicitly migrated read declarations, still checking original hashes and eleven moved helper bodies. The older creation exceptions and every unrelated fingerprint stay active. No historical route/source/CSS/client/DTO fixture was regenerated. The new historical source fixture preserves the original read file and creation composition from the verified base.

A complete source comparison found only two modified existing production files (`modules/shipments/server.ts`, `services/shipments/listShipments.ts`) and exactly three new read files. All other production source, including Orders' five-sheet detail/latest-active-link projection, remains byte-identical. No env/package/yarn.lock, worksheet header/range/mode/provider, schema or data changes. The full Shipments milestone remains incomplete; linking/status/Drive, Orders detail projection and enum ownership are future scopes. See [the focused read seam](shipments-read-seam.md).

No baseline or final test/lint/type/build failures remain. Offline tests do not verify live Google permissions, provider availability, concurrency safety, real browser rendering/interaction or deployment configuration. No live Sheets/Drive/LINE/Loyverse, production credentials/data, operational scripts, approval, merge or deployment were used.
