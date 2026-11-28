# Release and evidence ledger

This is the single current release-status record. Operations, architecture rules,
verification commands and proposed work live in their canonical guides; completed
packets and raw output stay linked in immutable Git history. A source merge is not
a deployment, and a retained receipt is not a new live inspection.

## Latest production release

Last independently verified application release: [PR112](https://github.com/volkswg/stock-management/pull/112),
source `60df2a1e530e1a0d71430a36ed07224195fae28c`, deployment
`dpl_9EoGzftxxTqoJRwmm1A9sb4kcBYJ`, at
`https://inventra-beta-one.vercel.app`, completed 26 November 2026.
The release added synchronized mobile/desktop pagination above and below Orders.
Users were cleared to resume the app and LINE after successful checks.

The exact merged tree matched tested head `7991f4c934a414dfc9144d5c7287f9e82e7fe880`;
[CI run138](https://github.com/volkswg/stock-management/actions/runs/45691166176) passed.
Local 909 Node + 3 Python tests, types/lint (two inherited warnings), isolated build
and synthetic Chrome layouts at 320–1440 pixels passed. The protected production
build in `hnd1` was promoted after source/settings checks, then passed six HEAD
availability checks, missing-key 428, invalid-signature 401, static-helper comparison
and configuration/protection drift guards. The initial error/fatal count scan was
empty. Schema, records, pool settings, credentials, LINE cutoff and protections were
preserved. Retained recovery was rehashed; no fresh database backup, accepted write
or real-provider canary was claimed. Private receipts remain on the Mac.

### Scoped-query optimization — not deployed

The review branch scopes sales by report date/account, movement/LINE reads by
parent/user/flow, and Orders by page plus existing filters. It preserves financial
calculations, payment splits, native projections, ordering, row revisions and the
unpaged Orders response. Synthetic SQL acceptance compares complete predecessor
results and measures reduced returned data; current UI tests cover pagination,
filters, reload, debounce and request races. The
[verification guide](verification.md#scoped-query-acceptance) records the test scope
and measurement limits. This preparation makes no production change. Merge and
application deployment require separate owner approval.

## Merged documentation baseline — PR107

[PR107](https://github.com/volkswg/stock-management/pull/107), merged as
`950d31e9ce3e89dd6b76d98762112e4a0787829c`, removed raw test logs from working docs
and preserved an immutable index. Its test-only inverse restores exact historical
doc bytes without changing existing fixtures/assertions. Final head
`5aba8c011d113f7b0280aa6d1467ace4b8ae666a` passed 894 Node + 3 Python locally,
27 focused checks, types/lint and [CI run131](https://github.com/volkswg/stock-management/actions/runs/45540776339).
It did not deploy; the live release remains the PR106 checkpoint above.

This consolidation changes documentation and test-only history reconstruction.
Its exact-commit validation/CI belongs in its PR; it grants no live action.

## Released milestones

| Milestone | Status / retained evidence |
| --- | --- |
| Storage migration and physical cleanup | Complete: native columns/IDs/timestamps, cell/row/lexeme/kind retirement, shared guards and deletedAt. [Earlier milestone index](https://github.com/volkswg/stock-management/blob/950d31e9ce3e89dd6b76d98762112e4a0787829c/docs/refactoring/progress.md#database-milestone-index). |
| Native adapters and private accounts | PostgreSQL-only business storage and private Loyverse configuration released. [Original account-transfer packet](https://github.com/volkswg/stock-management/blob/950d31e9ce3e89dd6b76d98762112e4a0787829c/docs/database-migration.md#private-account-configuration-release); never rerun it as setup. |
| IDs, uploads and row edits | Bill/session/item identities converted; unused purchase reference retired; per-image uploads and row-scoped conflicts released. [Earlier release ledger](https://github.com/volkswg/stock-management/blob/950d31e9ce3e89dd6b76d98762112e4a0787829c/docs/refactoring/progress.md). |
| PR98/99 receipt payments | JSONB arrays preserve split tender; old operational table removed. Migration archive and recovery evidence retained. [Rebuild/retirement evidence](https://github.com/volkswg/stock-management/blob/950d31e9ce3e89dd6b76d98762112e4a0787829c/docs/refactoring/progress.md#legacy-operational-payment-dependency-cleanup--released-in-pr99). |
| PR100 | Order detail shipment lookup corrected; app released. [Historical evidence](https://github.com/volkswg/stock-management/blob/950d31e9ce3e89dd6b76d98762112e4a0787829c/docs/refactoring/progress.md). |
| PR101/102 | Sales/API/browser cleanup and unused integration wrappers released. Private completion receipts verify those releases; old "prepared" wrapper notes are historical. |
| PR103 | Product Master and order-item link/create released as `44ab4ac9e972b180c97fa431fb30bf679861f92c`; private completion receipt recorded 22 November 2026, 19:19 Bangkok. It is not a pending UAT-only feature. |
| PR105 | Pooling fix released as `c66bd976c36f396309037aa3d56d439694598cbe`; transaction 6543/shared pool 4/runtime limit 6. Controlled HTTP/guard checks passed, old sessions drained, system reopened. |
| PR104 (after PR105) | Shop-master IDs and explicit historical/session backfill released as `ffde7cb147e29824f5ff7d9fffe017379712f1c9`; private completion recorded 23 November 2026, 02:15 Bangkok. All53 tables/metadata/four sequences reconciled; original values/revisions/permissions preserved, system reopened. This is not a current data inventory. |
| PR106 | Seller editing/replay compatibility and Cloud workflow released; retained evidence is in its immutable PR and the historical ledger. |

Private receipts remain on the Mac. Do not publish business values, mappings,
tokens, hashes of private datasets, keys or dumps to substantiate this public index.
New auth/RBAC/shop permissions and backup automation remain deferred, not released.

## Historical document index

The original docs below are pinned at the pre-consolidation merge. Each current
path remains; retired sections are replaced by these immutable source links.
Earlier PR text and fixture strings are not rewritten. Old default-branch fragment
links may stop resolving; the exact archived file preserves its former sections.
Malformed historical Markdown may require source view/line links, not an invented
rendered anchor. No Git history or private recovery artifact is deleted.

| Original at immutable base | Current disposition |
| --- | --- |
| [README.md](https://github.com/volkswg/stock-management/blob/950d31e9ce3e89dd6b76d98762112e4a0787829c/README.md) | Current entrypoint/configuration, preserved feature workflows; obsolete Sheets setup archived |
| [docs/architecture/README.md](https://github.com/volkswg/stock-management/blob/950d31e9ce3e89dd6b76d98762112e4a0787829c/docs/architecture/README.md) | Architecture entrypoint; release status links to this ledger |
| [docs/architecture/rules.md](https://github.com/volkswg/stock-management/blob/950d31e9ce3e89dd6b76d98762112e4a0787829c/docs/architecture/rules.md) | Current ownership/dependency/lint rules; obsolete live bridge descriptions retired |
| [docs/architecture/migration-map.md](https://github.com/volkswg/stock-management/blob/950d31e9ce3e89dd6b76d98762112e4a0787829c/docs/architecture/migration-map.md) | Current module/table map and active compatibility |
| [docs/architecture/decisions.md](https://github.com/volkswg/stock-management/blob/950d31e9ce3e89dd6b76d98762112e4a0787829c/docs/architecture/decisions.md) | Current behavior invariants; historical extraction details archived |
| [docs/architecture/user-authentication-roadmap.md](https://github.com/volkswg/stock-management/blob/950d31e9ce3e89dd6b76d98762112e4a0787829c/docs/architecture/user-authentication-roadmap.md) | Planning-only security roadmap, with current storage premise |
| [docs/database-migration.md](https://github.com/volkswg/stock-management/blob/950d31e9ce3e89dd6b76d98762112e4a0787829c/docs/database-migration.md) | Active target/configuration/recovery/maintenance/rollback and Cloud procedures |
| [docs/refactoring/roadmap.md](https://github.com/volkswg/stock-management/blob/950d31e9ce3e89dd6b76d98762112e4a0787829c/docs/refactoring/roadmap.md) | Completed versus deferred work, not old release preparation |
| [docs/refactoring/progress.md](https://github.com/volkswg/stock-management/blob/950d31e9ce3e89dd6b76d98762112e4a0787829c/docs/refactoring/progress.md) | Current release/evidence index; earlier full ledgers linked below |
| [docs/refactoring/verification.md](https://github.com/volkswg/stock-management/blob/950d31e9ce3e89dd6b76d98762112e4a0787829c/docs/refactoring/verification.md) | Canonical checks and history boundaries; old run counts archived |
| [docs/movement-migration.md](https://github.com/volkswg/stock-management/blob/950d31e9ce3e89dd6b76d98762112e4a0787829c/docs/movement-migration.md) | Current LINE/shop-ID behavior, no Sheets setup |
| [docs/expenses.md](https://github.com/volkswg/stock-management/blob/950d31e9ce3e89dd6b76d98762112e4a0787829c/docs/expenses.md) | Current expense/master usage and PostgreSQL storage |
| [docs/shop-stock-adjustments.md](https://github.com/volkswg/stock-management/blob/950d31e9ce3e89dd6b76d98762112e4a0787829c/docs/shop-stock-adjustments.md) | Existing monthly ledger workflow with current storage guidance |
| [docs/rich-menu-links.md](https://github.com/volkswg/stock-management/blob/950d31e9ce3e89dd6b76d98762112e4a0787829c/docs/rich-menu-links.md) | Unchanged opt-in provider/menu procedure |

Earlier removed architecture documents retain their complete
[original consolidation index](https://github.com/volkswg/stock-management/blob/950d31e9ce3e89dd6b76d98762112e4a0787829c/docs/refactoring/progress.md#document-consolidation-index)
and [earlier historical index](https://github.com/volkswg/stock-management/blob/950d31e9ce3e89dd6b76d98762112e4a0787829c/docs/refactoring/progress.md#historical-document-index).
Full PR/commit tables, original mapping/hash witnesses and intermediate local/CI
counts remain there; they are not copied back into the current ledger.

## Archived raw test evidence — PR106

Original seller-investigation source: `a299920d3b14246dd7819cb58123d5d49e028fc6`;
baseline: `ffde7cb147e29824f5ff7d9fffe017379712f1c9`. These initial run counts are
distinct from the final PR106 counts above. All14 files and 13 log hashes were
verified before PR107 removed the working copies. The
[original command/hash manifest](https://github.com/volkswg/stock-management/blob/a299920d3b14246dd7819cb58123d5d49e028fc6/docs/refactoring/evidence/order-seller/commands.json)
retains exact commands, restrictions, working directories and exit results.

| Original file (immutable copy) | Command / recorded result |
| --- | --- |
| [base-bill-id.txt](https://github.com/volkswg/stock-management/blob/a299920d3b14246dd7819cb58123d5d49e028fc6/docs/refactoring/evidence/order-seller/base-bill-id.txt) | Isolated `node --test --test-isolation=none tests/bill-identity.test.cjs`: six passed on baseline. |
| [head-bill-id.txt](https://github.com/volkswg/stock-management/blob/a299920d3b14246dd7819cb58123d5d49e028fc6/docs/refactoring/evidence/order-seller/head-bill-id.txt) | Same isolated bill-ID command: six passed on initial seller source. |
| [base-combined-diagnostic.txt](https://github.com/volkswg/stock-management/blob/a299920d3b14246dd7819cb58123d5d49e028fc6/docs/refactoring/evidence/order-seller/base-combined-diagnostic.txt) | Grouped wrapper/bill/user-state/item/reference diagnostic: four failures from shared mock hooks. |
| [head-combined-diagnostic.txt](https://github.com/volkswg/stock-management/blob/a299920d3b14246dd7819cb58123d5d49e028fc6/docs/refactoring/evidence/order-seller/head-combined-diagnostic.txt) | Same grouped diagnostic: reproduced the baseline hook interference. |
| [base-npm-test.txt](https://github.com/volkswg/stock-management/blob/a299920d3b14246dd7819cb58123d5d49e028fc6/docs/refactoring/evidence/order-seller/base-npm-test.txt) | Canonical `npm test`: 875 Node + 3 Python passed; no failed/cancelled/skipped tests. |
| [head-npm-test.txt](https://github.com/volkswg/stock-management/blob/a299920d3b14246dd7819cb58123d5d49e028fc6/docs/refactoring/evidence/order-seller/head-npm-test.txt) | Canonical `npm test`: 885 Node + 3 Python passed; no failed/cancelled/skipped tests. |
| [lint.txt](https://github.com/volkswg/stock-management/blob/a299920d3b14246dd7819cb58123d5d49e028fc6/docs/refactoring/evidence/order-seller/lint.txt) | `npm run lint`: zero errors, two inherited warnings. |
| [typecheck.txt](https://github.com/volkswg/stock-management/blob/a299920d3b14246dd7819cb58123d5d49e028fc6/docs/refactoring/evidence/order-seller/typecheck.txt) | `npm run typecheck`: passed. |
| [isolated-build.txt](https://github.com/volkswg/stock-management/blob/a299920d3b14246dd7819cb58123d5d49e028fc6/docs/refactoring/evidence/order-seller/isolated-build.txt) | `bash tools/migration/verify-build.sh`: passed; unchanged routes, 112 client chunks checked. |
| [order-regressions.txt](https://github.com/volkswg/stock-management/blob/a299920d3b14246dd7819cb58123d5d49e028fc6/docs/refactoring/evidence/order-seller/order-regressions.txt) | Focused seller/UI/shipment/image tests: 33 passed. |
| [prior-sandbox-combined.txt](https://github.com/volkswg/stock-management/blob/a299920d3b14246dd7819cb58123d5d49e028fc6/docs/refactoring/evidence/order-seller/prior-sandbox-combined.txt) | Earlier sandbox diagnostic: execution denied/intermediate failures; not passing evidence. |
| [prior-sandbox-base-npm-test-aborted.txt](https://github.com/volkswg/stock-management/blob/a299920d3b14246dd7819cb58123d5d49e028fc6/docs/refactoring/evidence/order-seller/prior-sandbox-base-npm-test-aborted.txt) | Earlier baseline `npm test`: aborted with SIGTERM; not a completed baseline. |
| [prior-sandbox-head-npm-test-aborted.txt](https://github.com/volkswg/stock-management/blob/a299920d3b14246dd7819cb58123d5d49e028fc6/docs/refactoring/evidence/order-seller/prior-sandbox-head-npm-test-aborted.txt) | Earlier head `npm test`: aborted with SIGTERM; not a completed regression run. |


Aborted/denied runs are not passing evidence. Raw output stays in CI artifacts or
pinned Git, not a growing docs copy. PR107 reduced 27 files/1,185,527 bytes/12,915
lines to 13 files/384,198 bytes/4,332 lines; these are historical PR107 metrics.
The current consolidation's before/after measurements and checks belong in its PR.
