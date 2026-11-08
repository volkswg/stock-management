# Verification procedure and historical results

Safe commands and compatibility checks are below. The latest merged architecture milestone is [PR #40](https://github.com/volkswg/stock-management/pull/40); its [external namespace retirement evidence](#external-namespace-retirement-issue-39) reports 534 passing tests and successful lint/typecheck/credential-free build **from Codex-local execution**. Older sections are historical snapshots, not current branch status; Vercel preview success is not independent CI or production acceptance. Production access-control, staging and browser/live-provider checks remain open in [issue #38](https://github.com/volkswg/stock-management/issues/38).

## Offline checks

Use Node 24 (verified 24.22.1) and existing dependencies/`yarn.lock`. Do not introduce another lockfile or install new dependencies for a structural move.

```sh
npm test
npm run lint
npm run typecheck
```

The test command uses built-in node:test with `--test-isolation=none` for managed-executor compatibility. Source loaders transpile with installed TypeScript, execute actual production functions in separate VM contexts with explicit fake dependencies, no process/env and throwing default fetch. This is an offline test aid, not a security sandbox; keep exact closed dependency allowlists, stub server-only only there, never load arbitrary config/providers. Transpilation is not type checking; retain compile-time fixtures and the separate TypeScript command.

Run baseline **before** implementation and final checks, recording actual counts/failures/skips and introduced vs inherited issues. Characterize original affected source with synthetic cases first. Do not claim independent GitHub/Vercel CI from Codex-local output or infer test/type/lint success from a preview deployment.

## Isolated credential-free production build

Next reads application .env files even with a cleared process environment. Inspect filenames only; never read/delete someone else's secrets. Build a clean source archive/copy in a separate directory, exclude ignored/untracked credentials and generated outputs, and allow only tracked `.env.example`. Reuse existing dependencies (a separate hardlinked node_modules tree is acceptable); do not run operational scripts or live integrations.

One way to prepare a committed source copy:

```sh
# From the reviewed checkout; choose a new, empty destination.
git archive HEAD | tar -x -C /tmp/stock-verification
# Provide the existing installed dependencies in that isolated directory.
# Inspect .env filenames; do not print their contents.
cd /tmp/stock-verification
env -i PATH="$PATH" CI=1 NEXT_TELEMETRY_DISABLED=1 npm run build
```

Create the destination first. For uncommitted final changes, copy only the reviewed tracked/new files instead, excluding deletions and all application .env files; verify copied source bytes against the implementation checkout. Do not use an archive of the old HEAD and claim it built uncommitted changes. Do not copy `.next`, TypeScript caches or ignored app env files. The tracked .env.example is documentation, not a credential requirement.

The build currently prerenders UI without fetching production records. Clearing credentials is **not** a network sandbox; if a future page performs prerender IO, use explicit fake dependencies in an isolated checkout. Never run setup:rich-menu, LINE/Loyverse imports, production startup or provider permission checks as regression validation.

## Compatibility and history gates

- Capture original complete source/raw hashes, TypeScript declarations, runtime export keys/identity and synthetic JSON/event traces before moving code. Keep fixture values immutable; use exact named inverse import/declaration reconciliation for reviewed migrations. [Evidence registry](progress.md#historical-evidence) maps existing witnesses.
- Run actual application + actual adapter + server/HTTP code with fake ports/Sheets/auth/fetch. Use deferred promises to prove pending read/write/upload/cleanup timing, synchronous call/getter short-circuiting, asynchronous rejection identity and no retries. Do not satisfy every test by mocking the use case itself.
- Check default vs explicitly passed ranges, exact payload ordering/types, RAW/USER_ENTERED/INSERT_ROWS, partial writes, clock/ID ordering, enum/error/constructor/header identity and old direct/barrel signatures. Preserve money/quantity/nullability/floating-point quirks and Bangkok dates.
- Run actual flat-config positive/negative import fixtures, TypeScript-resolved runtime **and** type-inclusive file/module graphs, re-export/alias resolution and browser reachability. Preserve known named legacy erased debt, not broad exemptions. Scoped graphs do not audit every package internals or unextracted legacy aggregation.
- Compare `tests/fixtures/route-contracts.json` without regenerating it: 23 page entries / 35 API files, dynamic segments and explicit HTTP exports/re-exports. It does not model future rewrites/intercepting routes/middleware/implicit HEAD/OPTIONS or full response semantics. Compare build manifests too; Next-generated _not-found/icon entries are not extra page sources.
- Compare original/final `.next/server/app-paths-manifest.json` byte-for-byte. Current expected SHA-256: `32f92c7a1ef17213d7a8642ca89e3e71218984982bf1bdce66b560ef35893e1e`.
- Review diff for unapproved route/UI/CSS/provider/schema/env/package/lockfile changes. Report unverified paths and discovered defects separately. Structural changes must not silently repair business behavior.

## Documentation consolidation results

Base: `71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb`, GitHub-verified latest main after merged PR23; tree matches the initial clean checkout. Dedicated branch `docs/consolidate-architecture`. Node 24.22.1, existing dependencies. Results here are Codex-local, not independent CI.

| Check | Baseline | Final |
| --- | --- | --- |
| npm test | 429 pass, zero failures/skips | 429 pass, zero failures/skips |
| npm run lint | Exit 0, one inherited unused shipmentRow import warning at tests/shipments-read-seam.test.mjs:6 | Exit 0, same inherited warning only |
| npm run typecheck | Pass | Pass |
| Isolated credential-free build | Pass in /tmp/docs-baseline-safe | Pass in /tmp/docs-final-safe |
| Page / API contracts | 23 / 35 | Unchanged 23 / 35; original fixture retained |
| App-paths manifest | Expected SHA-256 above | Byte-identical; same SHA-256 |
| Tracked Markdown count | 35 (29 architecture) | 14 (5 architecture, 3 refactoring) |
| Source/tests/fixtures/packages/env/assets | Reviewed unchanged base | All non-Markdown tracked files byte-identical to base |
| Internal links/references | Audited old paths and PR1–23 bodies | 92 internal links/fragments pass; 29 immutable document paths verified; PR1–23 fetched |

Original per-PR results, limitations, source witnesses and removed-document links are in the [progress ledger](progress.md). Tests remain 429 inherited + zero added; no test or fixture changes are needed for documentation cleanup.

Final review: only Markdown changes (six modified existing files, twenty-five removed obsolete notes, four new canonical documents); four operational guides retain original paths/bytes. Every removed document is mapped to its canonical section and immutable original source in progress. Repository-wide reference search finds only that history index and two unchanged original-source fixture strings referring to removed paths. There are no executable source/test references to removed docs.

All 53 unique external Markdown link destinations were classified: 29 original GitHub document paths verified against the GitHub-confirmed base tree, 23 PR URLs verified through GitHub metadata, and the existing localhost development URL (not probed). Published historical PR bodies were audited but not edited, so old unpinned links can remain stale; the history index supplies immutable replacements. No operational/provider endpoint was requested. No important evidence is deleted from Git history or historical fixtures; original full audit/proposal/verification records remain pinned. No baseline or final test/type/build errors, new lint warnings, source/fixture changes or unexplained skips.

## Limits of evidence

Fake-hook component tests exercise callbacks/state/request descriptors, not React DOM/Ant Design validation, focus/layout or native dialogs. Fake-auth/fetch provider tests do not establish live Google permissions/availability. No real browser visual equivalence, LINE delivery, Loyverse production sync, production payroll/stock writes, concurrent correctness, deployment or authentication security is established by this suite. No production credentials/records, live integrations, operational scripts, merge or deploy are used.


## PR25 HR core worksheet ownership

Base: `02506658dd79a6432824df7c15b0292be4d15886`, exact GitHub main / merged PR24 and clean initial tree. Branch `refactor/hr-core-worksheet-ownership`; Node 24.22.1, existing dependencies only. Codex-local execution, not independent CI.

| Check | Baseline | Final |
| --- | --- | --- |
| npm test | 429 pass; one new original worksheet characterization separately passes before move | 435 = 429 inherited + 6 new; zero failures/skips |
| npm run lint | Exit 0; inherited unused shipmentRow warning at tests/shipments-read-seam.test.mjs:6 | Exit 0; same inherited warning only |
| npm run typecheck | Pass | Pass |
| Isolated credential-free build | Pass, /tmp/hr25-baseline-safe | Pass, /tmp/hr25-final-safe |
| Page/API source contracts | 23 / 35 | Unchanged; original fixture retained |
| App-paths manifest | Existing SHA-256 above | Byte-identical; same SHA-256 |

Source witness: tests/fixtures/hr-worksheets-before.json. Exact inverse import substitutions restore all six complete originals; header/class declarations remain exact. All unrelated production bytes and prior fixtures remain unchanged. Real SheetsClient/worksheet tests use fake auth/fetch and compare original/current URLs/methods/modes/payloads/errors. Existing stock-adjustment GET/POST, employee eligibility/idempotency/error race and Orders/Shipment/Drive regressions stay active. No live provider/production credential/data/operational access, deployment, browser visual or concurrency verification.

Both isolated builds used only tracked .env.example, existing hardlinked dependencies and `env -i PATH="$PATH" CI=1 NEXT_TELEMETRY_DISABLED=1 npm run build`; no application env files or inherited provider credentials. Filename checks only; no secrets read/deleted. Final built production source is byte-identical to this branch. All 23 page/35 API source contracts and the original route fixture remain unchanged; app-paths SHA-256 stays `32f92c7a1ef17213d7a8642ca89e3e71218984982bf1bdce66b560ef35893e1e`.

There were no baseline or introduced test/type/build errors or new lint warnings. The targeted original/current tests and actual post-move runtime/type graph checks pass. PR15–23 inventories retain their old expected hashes, reconciled only through six exact source witnesses and six new owners. All earlier fixture bytes, aggregate registry/factory/indexes, existing production consumers and other business/provider/UI/API sources remain unchanged. Seventy-four local links/fragments in changed canonical Markdown resolve; no standalone PR document is added. Independent GitHub/Vercel checks, live integration permissions, browser visuals and concurrent correctness were not verified.


## PR26 Inventory core worksheet ownership

Base: `2e9fe4a6cb734a1d796d91f8e0805febf7273b70`, exact GitHub main after merged PR25; clean initial tree. Branch `refactor/inventory-core-worksheet-ownership`; Node 24.22.1 and existing dependencies. These are Codex-local results, not independent CI.

| Check | Baseline | Final |
| --- | --- | --- |
| npm test | 435 pass; three new original characterizations separately pass before move | 442 = 435 inherited + 7 new; zero failures/skips |
| npm run lint | Exit 0, inherited unused shipmentRow warning at tests/shipments-read-seam.test.mjs:6 | Exit 0; same inherited warning only |
| npm run typecheck | Pass | Pass |
| Isolated credential-free build | Pass, /tmp/inv26-baseline-safe | Pass, /tmp/inv26-final-safe |
| Page/API source contracts | 23 / 35 | Unchanged, original fixture retained |
| App-paths manifest | Existing SHA-256 above | Byte-identical; same SHA-256 |

Source witness: tests/fixtures/inventory-worksheets-before.json. Exact inverse import substitutions reconstruct all three complete original files/declarations, preserving the old hashes. Prior inventories reconcile only three named cases and three exact new destinations. Closed loaders add only these named paths. All older fixtures, unrelated production and aggregate/consumer/provider/HTTP/UI/package/env/schema files stay unchanged. No standalone architecture document is added.

Original characterization corrected test-only wiring: MovementSheet and StockAdjustmentsSheet are not aggregate exports and must be loaded through their actual leaves. A new negative mixed-registry assertion correctly detects a file cycle before the ownership assertion; its expected diagnostic now names that cycle. These are new-test assumptions, not baseline failures or production fixes. Actual stock equations, stable count IDs, reversals, delivery/delete partial failures and HTTP parity are exercised with real services/worksheets and fake dependencies. Live permissions/availability, production data, real-browser visuals and concurrency safety remain unverified.

Both builds used clean isolated source copies, only tracked .env.example, existing hardlinked dependencies, and `env -i PATH="$PATH" CI=1 NEXT_TELEMETRY_DISABLED=1 npm run build`. Only filenames were inspected; no application env files or inherited integration credentials, no secret reads/deletions, no install/lockfile change. Final built production bytes match the implementation checkout. App-paths manifest is byte-identical with SHA-256 `32f92c7a1ef17213d7a8642ca89e3e71218984982bf1bdce66b560ef35893e1e`; all 23 page/35 API source contracts and old fixtures remain unchanged.

Seven added tests cover worksheet/default/delete/mutability/await/error parity, actual stock-count/movement/adjustment/HTTP success and partial-failure scenarios, exact source/AST/history inventories, constructor/header/index/registry identities and unchanged batch mapping, actual original/current GoogleSheetsClient requests, and exact lint/runtime/type/browser/consumer audits. The source audit records 79 affected edges and three operational-script paths without execution. Both graph modes are acyclic, retain only Shipments→Orders and no Inventory→LINE/private edge; four inherited erased client debts remain exact. Seventy-five changed-doc local links/fragments resolve. No baseline or final test/type/build errors, unexplained skips or new lint warnings remain. Results are Codex-local, not independent GitHub/Vercel CI; live integration, browser visual and concurrent correctness are not claimed.


## Movement worksheet-schema prerequisite

Verified base: `4952644f06fcfc216c9351c347dcc806d887bb09`, merged PR26. Branch `refactor/movement-worksheet-schema-prerequisite`; Node 24.22.1 and existing dependencies. The unchanged clean base's commands were already executed during the immediately preceding worksheet audit; their matching SHA/results are reused instead of rerunning identical checks. No independent CI claim.

| Check | Executed base | Final |
| --- | --- | --- |
| npm test | 442 pass, no failures/skips | 447 = 442 inherited + 5 new; zero failures/skips |
| npm run lint | Exit 0; inherited unused shipmentRow warning | Exit 0; same inherited warning only |
| npm run typecheck | Pass | Pass |
| Isolated credential-free build | Pass, /tmp/line27-baseline-safe | Pass, /tmp/schema-final-safe |
| Routes / app-paths | 23/35; expected original manifest hash | Unchanged routes, fixture and byte-identical manifest |

One original helper characterization passes before edits. The source witness and original real workflow golden are captured before implementation. New tests distinguish removal of the direct mixed-state path from unchanged stock-count/Sales aggregate debt; an initial new assertion expecting the latter to disappear was corrected to verify its precise inherited trace. No production expansion or guard relaxation was used. Final results below are Codex-local; no live provider/credential/data/operational/browser/concurrency verification.

Final build ran `env -i PATH="$PATH" CI=1 NEXT_TELEMETRY_DISABLED=1 npm run build` in a clean source copy with only tracked .env.example and existing hardlinked dependencies. No application env files/inherited provider credentials, credential reads/deletions or installs. Final built production bytes match this branch. App-paths SHA-256 remains `32f92c7a1ef17213d7a8642ca89e3e71218984982bf1bdce66b560ef35893e1e`. All 23 page/35 API source contracts and previous fixture bytes remain unchanged. Seventy-seven changed-document local links/fragments resolve.

Only two existing production files change and one legacy-local schema leaf is added; every other production byte is identical to base. Five added tests cover original header/await/error behavior, exact full-source/AST/history restoration, shared arrays/function/export descriptors, original real workflow golden, and actual/virtual graphs plus strict import bypasses. No inherited test is removed or skipped. No baseline or final test/type/build error or new lint warning. UserStateSheet relocation remains deferred pending a fresh main/consumer audit, including the explicitly retained legacy Sales/registry aggregation.


## PR28 Inventory Sales-query dependency prerequisite

Verified base `72204e095d4b1e9425eb4f573bbe23c620bc99a7`, exact main / merged PR27, clean starting tree. Branch `refactor/inventory-sales-query-dependency`; Node 24.22.1, existing dependencies. The physical worksheet move is not implemented: preflight found the forbidden Inventory/Sales/registry/LINE edge and selected the separately authorized prerequisite.

| Check | Baseline | Final |
| --- | --- | --- |
| npm test | 447 pass; one added original characterization separately passes before edits | 452 = 447 inherited + 5 new; zero failures/skips |
| npm run lint | Exit 0, inherited unused shipmentRow warning | Exit 0; same inherited warning only |
| npm run typecheck | Pass | Pass |
| Isolated credential-free build | Pass, /tmp/pr28-baseline-safe | Pass, /tmp/pr28-final-safe |
| Route contracts / app-paths | 23/35; original expected hash | Unchanged fixture/routes and byte-identical manifest |

The immutable inventory-sales-query-before fixture preserves original source/AST/output/read-order and export evidence. Current/legacy queries and actual stock-count HTTP run with fake Sheets; runtime/type and negative regression graphs include the proposed future worksheet move. Existing baseline warning is separate; checks are Codex-local, not independent CI. No live providers, credentials, production records, operational scripts, deployment or browser/concurrency verification.

Both isolated builds used existing hardlinked dependencies, only tracked .env.example and `env -i PATH="$PATH" CI=1 NEXT_TELEMETRY_DISABLED=1 npm run build`, excluding application env files and inherited provider credentials. Filenames inspected only; no credential reads/deletions or installs. Final production bytes match the built copy. Manifest SHA-256 remains `32f92c7a1ef17213d7a8642ca89e3e71218984982bf1bdce66b560ef35893e1e`; all 23 page/35 API source contracts and original fixtures stay unchanged. Seventy-eight changed-doc local links/fragments resolve.

Five added tests cover original/current daily/dashboard/profit outputs and four-read/error/pending parity, exact source/DTO/declaration/fixture preservation, legacy function/header identity and import evaluation, actual stock-count HTTP 200/500 behavior with real queries, and runtime/type/browser/negative import graphs. No inherited test removed or skipped. All unrelated production bytes, PR27 fix, physical worksheets and provider/config/env/package/schema/UI/API sources remain unchanged. No baseline or final test/type/build errors or new lint warnings. Independent GitHub/Vercel CI, live provider permissions, real-browser visuals and concurrency safety are not claimed.

## PR29 LINE user-state worksheet ownership

Verified base `48cf8d6d011544206cafa7ac35eeeafde5f22be9`, exact main after merged PR28; clean initial tree. Branch `refactor/line-user-state-worksheet-ownership`; Node 24.22.1, existing dependencies. Git fetch failed at the configured proxy; GitHub connector metadata verified the exact signed commit/tree instead. No main changes. Results are Codex-local, not independent GitHub/Vercel CI.

| Check | Baseline | Final |
| --- | --- | --- |
| npm test | 452 pass, zero failures/skips | 458 = 452 inherited + 6 new; zero failures/skips |
| npm run lint | Exit 0; inherited unused shipmentRow warning | Exit 0; same warning only |
| npm run typecheck | Pass | Pass |
| Isolated credential-free build | Pass, /tmp/pr29-baseline-safe | Pass, /tmp/pr29-final-safe |
| Page / API source contracts | 23 / 35 | Unchanged; original fixture retained |
| App-paths manifest | Original expected hash | Byte-identical |

Both builds use only tracked .env.example and existing dependencies with `env -i PATH="$PATH" CI=1 NEXT_TELEMETRY_DISABLED=1 npm run build`. The initial hardlink attempt from the mounted repository dependency directory hit a cross-device boundary; it was replaced by hardlinks from the existing isolated dependency tree on the same filesystem. No install, new lockfile or application secret access. Only environment filenames were inspected. Final built production source matches the reviewed branch byte-for-byte.

Manifest SHA-256 stays `32f92c7a1ef17213d7a8642ca89e3e71218984982bf1bdce66b560ef35893e1e`. Only the two legacy worksheet leaves and their two physical destinations change under src. PR27 schema aliases and PR28 direct query/pure imports remain exact. All prior fixture hashes are unchanged; historical inventories reconcile just these two named moves through inverse import reconstruction.

Six new tests exercise actual original/current worksheet and client functions, mutable call-time A:H ranges, explicit arguments/payload identity, deleteRow indices, pending/error behavior, real movement session creation/read/update/delete, header repair and original conditional retry/provisioning, strict class/header/index/registry identity, source/AST/history, compile-time compatibility and exact lint/resolved graph guards. A new-test assumption that the inner worksheets index exported the header was corrected to assert its original absence; the index remains untouched. No inherited test was removed, skipped or weakened.

Protected module closures are runtime/type file-acyclic with only Shipments→Orders, no new Inventory→LINE/private or root→feature edge. Full browser closure sets match after canonicalizing only the two relocated paths, retaining exactly four erased debts and no runtime provider path. The full-source audit separately records an inherited erased cycle: calculateEmployeePayroll → manageSalaryAdvances → calculateEmployeePayroll. Its exact before/after trace is asserted; no cycle is introduced or silently excused. Broader legacy cycle/debt cleanup is deferred.

No live Google/LINE/Loyverse requests, production credentials/data, operational scripts, deployment, real-browser visual or concurrency verification. Synthetic session/transport tests do not establish live permissions/availability or stronger failure atomicity. All changed canonical Markdown links/fragments are validated; no standalone PR report is added.

## Remaining worksheet milestone

Base: merged PR29, main `57064008a0add0603e790f64983b797eaf4e92de`; dedicated branch `refactor/remaining-feature-worksheets`. Node 24.22.1, existing dependencies/lockfile. Baseline checks ran in a pristine source archive; final checks ran against the completed branch. Results are Codex-local.

| Check | Baseline | Final |
| --- | --- | --- |
| npm test | 458 pass, zero failures/skips | 465 = 458 inherited + 7 new; zero failures/skips |
| npm run lint | Exit 0; inherited unused shipmentRow warning | Exit 0; same warning only |
| npm run typecheck | Pass | Pass, including legacy/root/feature constructor compatibility fixture |
| Credential-free production build | Pass, /tmp/worksheets-baseline | Pass, /tmp/worksheets-final |
| Page/API contracts | 23/35 | Unchanged; original fixture retained |
| app-paths manifest | Original expected hash | Byte-identical, SHA-256 `32f92c7a1ef17213d7a8642ca89e3e71218984982bf1bdce66b560ef35893e1e` |

Both builds excluded application env files and ran with `env -i PATH="$PATH" CI=1 NEXT_TELEMETRY_DISABLED=1 npm run build`. Existing dependencies were copied, without installation. All production source bytes match the isolated final build. No config/provider/package/lockfile/API/schema changes, live integration calls, production data, deployment or operational scripts. The sole UI change is the adjustment panel's public-contract import.

Seven new tests cover row ranges/payload identity/pending/error behavior; legacy/feature/root/registry constructor and prototype equality; real SheetsClient requests with fake fetch; mutable schema/export identity and exact inverse source restoration; runtime/type ownership and forbidden import fixtures; actual Expense filtering/cents/order/idempotency/delete/failures through original/current record classes; and actual payroll ledger/deductions/export order through original/current payroll classes. Existing Inventory adjustment/reversal/idempotency/HTTP, HR financial, architecture, browser and historical regression guards remain enabled. Every inherited fixture remains byte-identical. The new witness is limited to affected sources; historical tests reconcile exact transformations rather than updating old hashes.

Runtime and type-inclusive migrated graphs retain only the existing Shipments→Orders module direction. Root transport reaches no feature implementation. New worksheet closures reach no legacy service or other feature's private infrastructure. No client reaches any new worksheet or header leaf at runtime; the adjustment panel consumes pure public contracts. Existing payroll's erased cycle and four legacy erased browser debts remain recorded and unchanged. No scope blocker remains. Browser visuals, real provider permissions, production concurrency and independent external CI are not claimed verified. Recommended next milestone: extract Expenses shop/category read contracts and consumer ports for HR/Sales before reducing aggregate registry composition.

## Expenses business milestone

Base: merged PR30, main `5c72e122b54d296cedc3d0f16a1e466128d63aaf`; dedicated branch `refactor/expenses-business-layer`. Node 24.22.1 and existing dependencies/lockfile. Results are Codex-local, using synthetic records and fake providers.

| Check | Pristine baseline | Final |
| --- | --- | --- |
| npm test | 465 pass, no failures/skips | 477 = 465 inherited + 12 new; no failures/skips |
| npm run lint | Exit 0; inherited unused shipmentRow warning | Exit 0; same warning only |
| npm run typecheck | Pass | Pass; includes exact DTO/legacy callable and port fixtures |
| Isolated credential-free build | Pass, /tmp/pr31-baseline | Pass, /tmp/pr31-final |
| Page/API contracts | 23/35 | Unchanged; original fixture retained |
| app-paths manifest | Original expected hash | Byte-identical, SHA-256 `32f92c7a1ef17213d7a8642ca89e3e71218984982bf1bdce66b560ef35893e1e` |

Both builds used source-only copies excluding application env files, existing dependencies and `env -i PATH="$PATH" CI=1 NEXT_TELEMETRY_DISABLED=1 npm run build`. All production source bytes match the final isolated build. No live integration/production-data calls, operational scripts, dependency installs, provider/auth/schema/worksheet changes, merge or deployment. The only browser source changes are the two Expenses pages' erased contract imports; their React logic/rendering remains exact. Changed-document local targets resolve.

Nine behavior tests compare saved-original/current actual Expenses operations and HTTP, including cents/filter/order/reference projection, request idempotency/conflicts, soft deletion with extra cells, inactive references, truncated records, validation-before-IO, getter failure phases, concurrent rejection precedence, pending writes, retained master sheet selection and master mapping exceptions. They also execute actual HR advance creation/GET/POST/PATCH with the injected/default shop reader and actual Sales profit HTTP/query/refund calculations through real Expenses reads. Three architecture tests cover exact DTO/rule/helper preservation, legacy function/error identity, full runtime/type graphs, public HR contract direction, browser isolation and real flat-config bypass rejection. Existing HR financial, Sales golden/refund, Inventory, HTTP, historical and worksheet guards all remain enabled.

All inherited fixture bytes remain unchanged. The new witness stores only affected original sources; historical guards reverse exact new facade/import/injection changes before earlier source reconciliation. The old Expense-barrel regression still restores its original implementation when proving the historical forbidden registry path; current legacy facades resolve only to the new feature owner. Exactly two old browser debts are removed (ExpensesPage and ExpenseMasterPage), with explicit source-backed expectations. The two HR erased roots and original payroll type cycle remain. Runtime module direction stays Shipments→Orders; type-inclusive graphs add only HR→Expenses via the pure ExpenseShop contract. No Expense application/adapter closure reaches legacy services, the aggregate registry or another feature implementation.

No scope blocker remains. Existing nontransactional financial-write/concurrency limits are preserved. Independent CI, real provider permissions and browser visuals are not claimed verified. Recommended next milestone: separate HR payroll/advance public contracts and application seams to close the two remaining erased browser paths/type cycle, then migrate Sales reads and reduce aggregate composition through actual consumer ports.

## HR financial milestone

Base: merged PR31, main `b3b55a806c7dcf2fe636b10f56d5db90ff19ebc3`; dedicated branch `refactor/hr-payroll-advances`. Node 24.22.1, existing dependencies/lockfile. All results are Codex-local, synthetic/offline.

| Check | Pristine baseline | Final |
| --- | --- | --- |
| npm test | 477 pass, no failures/skips | 490 = 477 inherited + 13 new; no failures/skips |
| npm run lint | Exit 0; inherited unused shipmentRow warning | Exit 0; same warning only |
| npm run typecheck | Pass | Pass, including exact legacy/HR DTO and consumer-port fixtures |
| Credential-free production build | Pass, /tmp/pr32-baseline | Pass, corrected /tmp/pr32-final |
| Page/API source contracts | 23/35 | Unchanged; original fixture retained |
| app-paths manifest | Original expected hash | Byte-identical, SHA-256 `32f92c7a1ef17213d7a8642ca89e3e71218984982bf1bdce66b560ef35893e1e` |

Builds used source-only copies excluding application env files, existing dependencies and `env -i PATH="$PATH" CI=1 NEXT_TELEMETRY_DISABLED=1 npm run build`. The final build includes the settlement evaluation-timing correction; all production source bytes match that copy. No production data/live provider calls, operational scripts, dependency installs, schema/worksheet/provider/auth changes, merge or deployment. Existing Expenses implementation, SalaryAdvanceShops seam, aggregate registry and unrelated HR read/write bodies stay unchanged. Browser changes are only two erased contract imports. Seventy-seven changed-document local targets resolve.

Ten financial tests compare original/current payroll, advances, deductions, revision hashes, settlements and complete read/write/clock traces. Coverage includes daily/monthly/effective compensation, half/full/leave/employment boundaries, bucket/refund thresholds, capped recovery/carry-forward, unpaid/stale/retry/duplicate behavior, header initialization, malformed/conflicting snapshots and over-recovery, missing-range recovery, sequential partial failures, pending reads/appends, oversized snapshots and actual payroll/settlement/advance HTTP. A real employee/compensation/attendance worksheet test preserves their initialization and read order through injected composition. A deferred header-preparation test retains original payment-field evaluation after sheet/method lookup rather than silently changing an inherited mutation/concurrency boundary.

Three architecture tests verify exact DTO/enum/legacy export/error identities, literal original numerical body/helpers, salary-rule and read/header/hash function preservation; full runtime/type graphs, restored historical cycle/browser negatives and real lint bypass fixtures. Existing critical HR/Sales/Expenses/Inventory, HTTP, financial and historical guards remain enabled. Every inherited fixture remains byte-identical. The new 37 KB witness captures only financial originals, relevant routes/type blocks and exact import-edit hashes; older guards reverse these transformations before prior reconciliations.

Current full-source file cycles are empty in both modes. Restoring the three original financial implementations reproduces the exact old Payroll↔Advance erased cycle. SalaryAdvancesPage and PayrollPage/payrollPdf now reach no legacy service/server/provider path in either mode; restoring each old import reproduces its old provider path. Runtime module direction remains Shipments→Orders; types add only the existing HR→Expenses public contract edge. HR financial core has no legacy/config/provider/other-feature implementation dependency. Legacy employee/compensation/attendance and direct Sales reads are injected from explicit lazy composition outside modules, never imported by HR core.

No financial-scope blocker remains. Existing financial concurrency/nontransactional partial-write limitations are preserved. Independent CI, browser visuals and live provider permissions are not claimed verified. Recommended next large milestone: HR employee/compensation/attendance business ownership plus the public Sales payroll-dashboard seam, followed by an audit to retire the reader bridge and reduce aggregate composition.

## HR application completion

Requested baseline: PR31 `b3b55a806c7dcf2fe636b10f56d5db90ff19ebc3`. Actual audited main: merged PR32 `f90e7bdeb3d7c9815148c3011d217e07b1a80b19`, whose tree matched the earlier reviewed financial implementation exactly. GitHub reported no open conflicting PR. Branch: `refactor/hr-application-completion`. Node 24.22.1 and existing dependencies; evidence is Codex-local.

| Check | Pristine actual-main baseline | Final |
| --- | --- | --- |
| npm test | 490 pass; zero failures/skips | 500 = 490 inherited + 10 new; zero failures/skips |
| npm run lint | Exit 0; inherited unused shipmentRow warning | Exit 0; same warning only |
| npm run typecheck | Pass | Pass, including exact full-service callable and enum namespace fixtures |
| Isolated credential-free production build | Pass, /tmp/hr-completion-baseline | Pass, /tmp/hr-completion-final |
| Page/API contracts | 23/35 | Unchanged; original fixture retained |
| app-paths manifest | Expected original hash | Byte-identical; SHA-256 `32f92c7a1ef17213d7a8642ca89e3e71218984982bf1bdce66b560ef35893e1e` |

One fresh baseline and one final build used source-only copies excluding app env files, existing dependencies and `env -i PATH="$PATH" CI=1 NEXT_TELEMETRY_DISABLED=1 npm run build`. No provider/production calls, operational scripts, new dependencies, schema/provider/auth/UI/env/package/lockfile changes or deployment. The prior merged financial body and SalaryAdvanceShops implementation are unchanged. All inherited fixtures remain byte-identical; current history guards reverse exact new aliases/import changes before previous reconciliation. The Inventory graph guard preserves its original overlay/counts and checks exactly the added HR closure, rather than widening a global exception.

Seven new operation/HTTP tests exercise actual old/new employee creation, status/compensation updates and partial writes; history/effective-date/tie/future decisions; half/full attendance, leave/conflicts, open shifts, updates and repeated clock-out; pending append/failure propagation; argument getter order; all eight HR HTTP routes, malformed JSON, 400/404/409/500 translation; and real existing Sales refund queries through payroll and settlement success/retry/later-month blocking. Three architecture tests verify strict legacy/index/public function, enum and error identities/export order, original parser/header/date bodies, semantic ports, complete runtime/type graphs and real flat-config bypass negatives. Existing financial, historical and other-feature guards stay enabled.

Current runtime/type file cycles remain empty. HR application/domain has no legacy/config/provider/other-feature private dependency. Browser graphs remain clean in both modes. Runtime module direction remains Shipments→Orders, with only the existing erased HR→Expenses public-contract edge. Payroll uses HR-owned workforce readers; only concrete Sales composition remains in its compatibility bridge. Necessary aliases/index/service-shaped signatures and the aggregate registry remain for the PR36 audit. No material regression or scope blocker remains; inherited concurrency/nontransactional-write limits are preserved. External CI, real provider permissions and browser visuals are not claimed verified. Recommend SA review; the next large milestone is Sales business ownership and its public payroll-dashboard seam, without automatically proceeding to it.

## Sales + Inventory business completion

Verified base: PR33/main `9ab9f2095342c66f30acf9612d79ed92063b8597`. Branch `refactor/sales-inventory-application`. Node/dependencies are the existing environment; all evidence is Codex-local, synthetic and offline.

| Check | Pristine baseline | Final |
| --- | --- | --- |
| npm test | 500 pass, zero failures/skips | 510 = 500 inherited + 10 new; zero failures/skips |
| npm run lint | Exit 0, inherited unused shipmentRow warning | Exit 0, same warning only |
| npm run typecheck | Pass in pristine isolated copy | Pass, including public/legacy full-service callable fixtures |
| Isolated credential-free build | Pass, /tmp/refactor-chain-baseline | Pass, /tmp/sales-inventory-final |
| Page/API source contracts | 23/35 | Unchanged original fixture |
| app-paths manifest | Original expected SHA-256 | Byte-identical; `32f92c7a1ef17213d7a8642ca89e3e71218984982bf1bdce66b560ef35893e1e` |

Both builds exclude application env files, reuse existing dependencies and run `env -i PATH="$PATH" CI=1 NEXT_TELEMETRY_DISABLED=1 npm run build`. The final copy matches all 422 production source files, excluding generated TypeScript cache artifacts. All inherited fixtures are unchanged. No live providers/data, operational scripts, merge or deployment.

Original/current executable comparisons cover daily/dashboard/profit/refunds, payroll integration, sync projections/IDs/retries/live counts/partial writes, cost overrides/status, movement image/item/delivery/delete/retry behavior, monthly balances/variance/count writes, adjustment integrity/reversals/replacements and HTTP errors. A rejection-order regression required preserving native composed report promises instead of adding an async wrapper. Historical overlays retain original negative/count evidence; separate actual-current runtime/type DAG, core-port/private-import and browser checks pass.

Runtime module edges are Inventory→HR, Inventory→Sales, Shipments→Orders; erased public contracts add HR→Expenses and Sales→Expenses. No file cycle in either mode or browser→server/provider reachability remains. Legacy compatibility, aggregate construction and LINE session persistence remain for the next authorized milestones. Existing nontransactional/race limits remain; external CI, live permissions and visual flows are unverified.

## Orders + LINE workflow completion

Base: exact PR34 head `4bafdb693d5ff39684ceaba58fae452d5a432802`, stacked branch `refactor/orders-line-workflows`. Its verified final source is this milestone's baseline: 510 passing tests, lint/typecheck/build pass. Final: **520 tests**, zero failures/skips; `npm run lint` exit 0 with only inherited unused shipmentRow warning; `npm run typecheck` passes with additional legacy callable/port fixtures. All evidence is Codex-local/offline.

Baseline build `/tmp/sales-inventory-final`; corrected final `/tmp/orders-line-final`, source-only copies without application env files, existing dependencies, `env -i PATH="$PATH" CI=1 NEXT_TELEMETRY_DISABLED=1 npm run build`. The descriptor compatibility correction prompted the final rebuild; all 463 production source files match it. App-paths manifests are byte-identical, SHA-256 `32f92c7a1ef17213d7a8642ca89e3e71218984982bf1bdce66b560ef35893e1e`. Original route fixture remains 23 pages/35 APIs.

New original-source witness `orders-line-before.json` captures only affected implementations and import inverses. Prior fixtures remain untouched. Tests execute actual application/adapters/providers with synthetic Sheets, clocks/IDs, images and LINE replies, including both movement modes, batch/fallback/header retry, repeated events, NaN/coercion differences, lazy configuration failures, pending uploads, missing/status/soft-delete outcomes and partial writes. Exact original runtime export descriptors are retained by movement compatibility identity bindings. Historical overlays preserve original source/negative checks; independent current graphs/lint enforce all runtime/type cycles, public-only feature edges and provider-free browsers.

Runtime adds only LINE workflows→Orders and LINE workflows→Inventory to PR34's module directions. Shared/root transport has no feature dependency. No route/UI/schema/provider/config/env/package/lockfile/auth changes, production data/live calls, operational scripts, merge or deploy. Existing nontransactional/concurrency limits persist; external CI, provider permissions and visual flows are unverified.

## External infrastructure completion

Parent baseline: PR35 `3f62dee11ed3a174eb8c99246926d4710e4cba7f`, 520 tests and successful lint/typecheck/credential-free build. Final branch `refactor/external-infrastructure`: **526 tests**, no failures/skips; lint exit 0 with the inherited unused shipmentRow warning only; typecheck passes. Existing dependencies/Node and offline synthetic providers only.

Baseline `/tmp/orders-line-final`; final `/tmp/external-final`, source-only copies excluding application env files and reusing dependencies, `env -i PATH="$PATH" CI=1 NEXT_TELEMETRY_DISABLED=1 npm run build`. All 472 production source files match final; source routes remain 23/35 and app-paths manifest is byte-identical, SHA-256 `32f92c7a1ef17213d7a8642ca89e3e71218984982bf1bdce66b560ef35893e1e`.

Original/current actual clients run against fake fetch/crypto inputs, preserving HTTP URLs/methods/headers/payloads, signature validation, binary content, every rich-menu protocol operation, exact 404-only fallback, Loyverse pagination/date/filter/refund/report projection, errors and pending-request/no-retry behavior. No operational rich-menu script runs. All seven physical implementation bodies and inherited fixture bytes are unchanged. Constructor/index/factory identities, full runtime/type/boundary/browser guards and historical forbidden-path checks pass. No feature import from root transport, new cycle, schema/provider/config/env/package/lockfile/auth change or production access. Live provider permissions, browser visuals and independent CI remain unverified.

## Final architecture cleanup

Base: exact PR36 `4d786cedab11842940346e009684539a114820b3`, baseline **526 passing tests** with lint/typecheck/isolated build successful. Final branch `refactor/final-architecture-cleanup`: **531 = 526 inherited + 5 new**, no failures/skips; `npm run lint` exit 0 with only the inherited unused shipmentRow warning; `npm run typecheck` passes. All evidence is Codex-local, using existing Node/dependencies and synthetic/offline providers.

Baseline build `/tmp/external-final`; final `/tmp/architecture-final`, source-only copies excluding application env files, reusing dependencies, `env -i PATH="$PATH" CI=1 NEXT_TELEMETRY_DISABLED=1 npm run build`. All **482 production source files** match the final copy. Route fixture remains **23 pages / 35 APIs**, unchanged; app-paths manifest is byte-identical, SHA-256 `32f92c7a1ef17213d7a8642ca89e3e71218984982bf1bdce66b560ef35893e1e`. Canonical local links/fragments pass.

Before moving, three tests capture original ID clock/random/rollover/rollback behavior, standalone LINE fake-fetch protocol/404-only fallback, and aggregate configuration/construction plus actual worksheet health/batch event order. Two additional ownership/identity/source-inverse/lint tests check the current entire runtime/type DAG, browser reachability and absence of active legacy runtime paths from every API. Native Node strip-types imports confirm the standalone legacy/canonical client share one constructor/prototype, without invoking any client method or setup entrypoint.

All inherited financial, stock, payroll, Orders/Shipment, LINE/sync, HTTP, persistence-order/error and negative architecture guards pass. The new 51 KB witness captures affected originals plus bounded import inverses; every earlier fixture byte is untouched. Canonical positive import examples and exact physical-owner assertions are updated, not removed. The Shipment route guard adds only its documented new public HTTP leaf. Independent final lint rules preserve inherited clock/dynamic/enum enforcement rather than overriding it.

Root infrastructure/shared reach no feature/composition implementation. No runtime/type file cycle or private cross-feature import is introduced. Runtime module directions remain LINE→Orders/Inventory, Inventory→HR/Sales, Shipments→Orders; erased public contracts additionally include HR→Expenses and Sales→Expenses. Every browser graph is clean in both modes. Aggregate construction is outside infrastructure and remains one implementation; active APIs use canonical composition and have no legacy runtime reachability.

Intentionally retained: pure full-service Sheets declarations, tested legacy named forwards/indexes/typed aliases and unchanged aggregate construction/health semantics. No critical scope blocker remains. Existing races/nontransactional partial writes and provider failures are preserved; live permissions/delivery, production records, browser visuals and independent CI are unverified. No merge/deploy, production credentials/data, live provider calls, operational setup, new dependency, schema/provider/auth/UI or environment-key change.

## External namespace retirement (issue #39)

Verified main/base: `5867348d86d57cc98322362fa175140626c7f5d7` (merged PR37); no conflicting open implementation PR at preflight or final audit. Branch `refactor/retire-externals`. Existing Node 24/dependencies; all evidence is Codex-local and offline.

Pristine baseline: **531 tests**, zero failures/skips; lint exit 0 with the inherited unused shipmentRow warning only; typecheck passes. Credential-free baseline build `/tmp/externals-retirement-baseline` passes. Final source-only build `/tmp/externals-retirement-final` also passes using `env -i PATH="$PATH" CI=1 NEXT_TELEMETRY_DISABLED=1 npm run build`, no application env files and existing dependencies. All **418 production files** match the isolated source (393 TypeScript files plus 25 other source/assets). The original route fixture remains **23 pages / 35 APIs**; baseline/final app-paths manifests are byte-identical, SHA-256 `32f92c7a1ef17213d7a8642ca89e3e71218984982bf1bdce66b560ef35893e1e`.

Final checks: **534 = 531 inherited + 3 new**, zero failures/skips; `npm run lint` exit 0 with only the inherited warning; `npm run typecheck` passes. The three new tests verify all 65 removals and exact production/fixture bytes, strict physical runtime/type/browser graphs with canonical resolution, and actual lint rejection of retired paths/runtime contract bypasses. All inherited tests remain enabled. Original/current financial, stock, payroll, Orders/Shipment, LINE/Loyverse, HTTP, persistence ordering/pending/error and constructor/prototype/header comparisons pass.

The new retirement witness preserves original deleted sources/export maps, consumer inventory and exact production/ESLint import inverses. Older fixtures are byte-identical. Historical resolvers read archived sources only for original/negative evidence; current loaders reject retired paths and current graph roots are physical files. No new runtime/type cycle, browser→server/provider path, private feature edge, feature→composition or root→feature dependency appears. Canonical local document links/fragments pass.

No known required external consumer blocks retirement: package private, no export map/publish workflow and all repository consumers audited. This deliberately breaks the old deep source paths; undisclosed out-of-repository consumers must migrate. Remaining services/backend/script compatibility and unchanged aggregate construction/health semantics are intentional. Existing races/nontransactional partial writes remain. Independent CI, browser visuals and live provider permissions/delivery are unverified. No live service/data access, operational setup, merge/deploy, schema/provider/auth/UI/env/package/lockfile changes.

## Private Loyverse account source

Base: `36b5cc10828c7b9c57b2201e606762ad92ec0c05` (merged PR42); branch `feat/loyverse-private-sheet-accounts`. Fresh baseline before edits: **534 total, 532 pass / 2 fail / 0 skip**. Both inherited failures are historical `.env.example` byte guards, caused by PR42 simplifying the template without reconciliation. Lint exits 0 with the inherited unused shipmentRow warning; typecheck and isolated credential-free baseline build `/tmp/loyverse-accounts-baseline` pass. Existing Node 24/dependencies, local offline evidence only.

The new account witness captures affected original sources and bounded inverse edits. Historical guards still verify their original fixture hashes, including both exact template versions; no earlier fixture or expected business result is regenerated or skipped. Current executable loaders use real new account functions with fake providers, separately from history overlays.

| Gate | Pristine main baseline | Final frozen source |
| --- | --- | --- |
| npm test | 532 pass / 2 inherited template failures / 0 skip | **547 = 534 inherited + 13 new**, no failures/skips |
| npm run lint | Exit 0, inherited shipmentRow warning | Exit 0, same warning only |
| npm run typecheck | Pass | Pass |
| Isolated credential-free build | Pass, /tmp/loyverse-accounts-baseline | Pass, /tmp/loyverse-accounts-final |
| Route sources / build manifest | 23 pages / 35 APIs; original fixture | Same contracts and byte-identical manifest |

Both source-only builds reuse existing dependencies and run `env -i PATH="$PATH" CI=1 NEXT_TELEMETRY_DISABLED=1 npm run build`, without application env files. All **421 production files (396 TypeScript)** match the built copy. Manifest SHA-256 remains `32f92c7a1ef17213d7a8642ca89e3e71218984982bf1bdce66b560ef35893e1e`. None of 113 client JavaScript chunks contains credential-source keys or the private reader. Runtime/type file cycles, module directions, private-feature exclusions and browser reachability checks pass.

Thirteen focused tests execute actual configuration, reader, composition, Sales/Expenses applications and adapters with fake providers: old/current env parsing and all affected HTTP methods; sheet-only source isolation; strict storage/order/disabled validation; denied access, pending reads and no retries/writes; credential-free metadata/capabilities and error redaction; real sync/refunds/reports/idempotent persistence traces; unchanged Shop Master schema/grandfathered mappings; exact source inverses, all 42 inherited fixtures and scoped boundary negatives. Existing financial/payroll/stock/workflow/history guards remain enabled and pass. The Sales server receipt capability accepts existing concrete clients through its structural port, without changing calculations.

[README owner instructions](../../README.md#loyverse-configuration) cover restricted workbook creation/sharing, original IDs/order/store filters, manual private copying, Vercel activation and verification, rollback and eventual JSON-variable removal. Workbook permissions, live account correctness and provider behavior require owner validation; private Google lookup availability/quota is a new dependency in sheet mode. No cross-request cache or retry/fallback is added. Independent CI, browser visuals and live integrations are unverified. No real credentials/data were accessed, private workbook or Vercel settings changed, operational setup run, merge or deploy performed. Authentication/issue #38 and existing nontransactional/concurrency limitations remain outside scope.

## Feature compatibility retirement

Base: main `2d2dc18a5c1112e9f6368599ad0d6d67defa79af` (merged PR43); branch `refactor/retire-features-compatibility`. Its tree is byte-identical to verified PR43 head `02cba30ec1d28ad1d163537843a2c32cb18cfc83`: baseline evidence is the existing 547-pass, lint/typecheck and isolated build result above, verified by tree equality rather than a redundant build. Before deletion, offline execution of all seven real forwards confirms all 15 runtime exports share exact canonical function/enum/prototype identities; three type forwards are captured.

The small new retirement witness records seven original sources/symbol destinations, 39 reference expressions, exact alias/lint inverses, all 43 prior fixture hashes and a fingerprint of every unchanged production file. Historical source/negative checks keep their original assertions; current loaders reject deleted paths and use real owners. No fixture is regenerated or negative guard removed.

| Check | Verified equivalent main baseline | Final |
| --- | --- | --- |
| npm test | 547 pass, no failures/skips | **550 = 547 inherited + 3 new**, no failures/skips |
| npm run lint | Exit 0, inherited unused shipmentRow warning | Exit 0, same warning only |
| npm run typecheck | Pass | Pass, including all three retired type contracts |
| Isolated credential-free build | Existing PR43 verified source/build | Pass, /tmp/features-retirement-final; one final build |
| Source routes / app-paths manifest | 23 pages / 35 APIs; original fixture | Same routes and byte-identical manifest |

The final build is a fresh source-only copy without application env files, using existing dependencies and `env -i PATH="$PATH" CI=1 NEXT_TELEMETRY_DISABLED=1 npm run build`. All **414 production source/assets (389 TypeScript)** match the built copy and are byte-identical to baseline. Only seven forwards are removed; no production implementation or import changes. Manifest SHA-256 remains `32f92c7a1ef17213d7a8642ca89e3e71218984982bf1bdce66b560ef35893e1e`. All 43 inherited fixtures are byte-identical and 121 canonical local links/fragments pass.

Three new tests cover physical retirement/complete source fingerprint/enum-function-prototype identities, strict actual runtime/type/browser graphs and alias resolution, and real scoped lint bypass negatives. A type fixture retains the old classifier names through canonical import aliases and verifies classification/event/session/progress signatures. Existing financial, stock, payroll, LINE/Loyverse, HTTP, worksheet/order/error, header/constructor and historical guards remain enabled. The original Inventory comparison resolves its captured quantity implementation only in an explicit original-source context; current loaders still reject removed paths. Full tests pass after that historical-loader repair without another production build.

No file cycles, private cross-feature edge, browser→server/provider reachability, route/schema/formula/provider/environment/package/lockfile or authentication change. No known supported external consumer blocks removal; unknown external deep imports deliberately need migration. Services and standalone script compatibility remain justified and unchanged. Live providers, production data/credentials, browser visuals and independent CI are not verified or accessed; no operational setup, Vercel change, merge or deployment occurs.

## Loyverse single-workbook support

Base: main `689d02c93326a1831c38c583c464524644c72e66` (merged PR44), tree-identical to previously verified head `cc5a41707b0bf8b6302a9ea9c1e6221d66bc1734` with 550 passing tests/lint/typecheck/isolated build. Branch `fix/loyverse-single-workbook`. Account workbook selection now uses only GOOGLE_SHEETS_SPREADSHEET_ID; the account-specific environment setting and AppConfig field are removed. A missing/invalid ID or inaccessible/malformed worksheet fails closed with no alternate workbook or JSON fallback. The reader, six-column validation, ordering, bound clients, redaction and env rollback remain unchanged.

Historical guards reconcile the exact new selection/template edits through an additive witness; old fixture bytes and assertions remain intact. Owner instructions explain workbook-wide token visibility, the lack of per-tab read isolation and the requirement to restrict existing-workbook access. No credentials, production records or Vercel settings are accessed or modified.

| Check | Verified equivalent main baseline | Final |
| --- | --- | --- |
| npm test | 550 pass, no failures/skips | **551 = 550 inherited + 1 new**, no failures/skips |
| npm run lint | Exit 0, inherited unused shipmentRow warning | Exit 0, same warning only |
| npm run typecheck | Pass | Pass |
| Isolated credential-free build | Existing PR44 verified source/build | Pass, /tmp/loyverse-single-workbook-final; one final build |
| Source routes / app-paths manifest | 23 pages / 35 APIs | Unchanged, byte-identical manifest |

The final build uses a fresh source-only copy, only tracked .env.example, existing hardlinked dependencies and `env -i PATH="$PATH" CI=1 NEXT_TELEMETRY_DISABLED=1 npm run build`. All **414 production files** match the built copy. Manifest SHA-256 remains `32f92c7a1ef17213d7a8642ca89e3e71218984982bf1bdce66b560ef35893e1e`. All **44 inherited fixtures** remain byte-identical; 119 canonical local links/fragments resolve. The 113 client JavaScript chunks contain no JSON credential setting, removed account-workbook setting or account-reader implementation.

Focused tests exercise actual composition/config with fake Google and Loyverse clients: main-workbook selection, ignored/unevaluated obsolete override, missing/invalid IDs, access failure without fallback, metadata confidentiality and independent env rollback. Inherited tests retain six-column validation, ordering/disabled records, Sales sync/reporting, Expenses mappings, HTTP/error parity, financial/stock/payroll behavior, exact source inverses, runtime identities and browser/runtime/type graph guards. No new cycle or private cross-feature edge; application/domain/transport/route code is unchanged. Only composition and config production files change.

Results are Codex-local, not independent CI or live integration verification. Workbook-wide reader access is an owner-reviewed operational risk; former separate-workbook deployments must copy the account tab privately before adopting this version or explicitly use env mode. No real tokens, production data, live provider calls, Vercel settings, deployment or merge were accessed/performed.
