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
