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
