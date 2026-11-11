# Refactoring progress and evidence

## Local completion started — raw-image correctness failure (2026-11-11)

PR #63 execution was authorized on fresh disposable copies. Added a real-app
raw-binary intent gate plus deterministic, independently validated PNG collision
fixtures; added the bounded capacity engine and synthetic controls to CI.
The [run evidence](../database-migration.md#local-completion-started-raw-image-intent-failure-2026-11-11)
records an actual failure: different valid raw PNG bytes reused the same operation
key and received 200/replayed the old response instead of 409, because the route
wrapper hashes decoded text. No production behavior fix is included.

Two fresh local databases were prepared in a new limited container/volume. The
first stopped after 83 HTTP requests; its app was shut down and evidence retained.
The second was not exercised; application capacity was NOT RUN. All original
70,777 rows, each copy's 24 archive tables/15 security metadata and the hosted
51-table/15-metadata before/after state remain exact. Failed-checkpoint restore
matches all 51 tables/15 metadata in 3.256 seconds; a recovery app probe remains
pending. Production metadata is unchanged and storage remains Google Sheets.

All 571 existing regressions and 18 synthetic harness controls pass; typecheck
and credential-free isolated build pass. Lint has only the inherited warning.
**Full implementation remains incomplete**: other variant/fake-outcome/LINE/UI/
fault work, the actual capacity workload/observer/oracle integration, two complete
correctness runs and full recovery checks await the scoped binary-intent fix.
Receipt hash: `76ade0b3dd8850a7d274d7fa2b2e950f3461b35e7448b7ee15d560963b2be130`.

## Remaining local coverage/capacity — plan prepared only (2026-11-11)

Baseline is merged PR #62, `40cc91cd2711559a249d43163ec38008385854d0`.
Source-matched CI run 42996521762 passed; the automatic production deployment
was subsequently verified READY on that commit with unchanged Sheets storage.
Those are prior merge receipts, not fresh live-data inspection during planning.

The [completion plan](../database-migration.md#remaining-local-coverage-and-capacity-completion-plan-prepared-only)
adds a per-variant audit across all 16 families, not just the seven BLOCKED labels.
It proposes excluding hosted-only API/protection from the local denominator and
marking nonexistent Orders cancel/delete and Shipment unlink/cancel writes N/A
only after explicit scope review. Current unsupported-action rejection and
synthetic legacy history still require tests; no new feature is implied by a
status enum. Original copied rows remain immutable; all editable legacy fixtures
must be newly synthetic.

Proposed work covers upload size/uncertainty/cleanup, full signed LINE/photo
journeys, per-method intent/rollback/concurrency, ten trials per browser/crash
boundary, two clean campaigns, immutable concurrent provider fixtures and paired
attempt/outcome ledgers. Local capacity uses one then five clients, 2-minute
warmups and ten measured minutes each, a sealed 60/25/15 read/simple/compound mix,
2/3/5-second warm p95 limits, 10-second maximum, explicit pacing/sample counts and
20% resource headroom. No limit/pool tuning is hidden in a passing result.
Generated checkpoints need full 51-table/15-metadata restore plus a read-only
provider-denied app probe and protected-state comparison. LOCAL PASS is separate
from deferred hosted/full-platform/production acceptance.

This update changes documentation/status only. No harness implementation,
fixture/write/fault/load/restore run, resource or database change, production
setting, live provider request or fresh live-data inspection occurred. All new
execution results remain NOT RUN. A later owner instruction and a sealed local
execution packet are needed before implementation/execution; merging the plan
alone starts no private campaign. Production remains Google Sheets.

Verification of this documentation-only update: all 571 existing regression
tests, typecheck and an isolated credential-free production build pass. Lint
has no errors and retains the existing unused `shipmentRow` warning. The diff
changes only this ledger, the canonical migration plan and phase-3 status;
application/build inputs, fixtures, schema, grants, environment and dependencies
are unchanged. These checks do not execute the planned private write/load tests.

## Cost-override deletion fix — two implemented local runs pass (2026-11-11)

The owner authorized fixing the WT12 binding defect and rerunning local writes.
Commit `4aac657b705720a386336d655aa47da731207aea` opts only cost overrides into
the existing archive-on-clear behavior. Deletion preserves the SQL identity and
business cells while hiding the archived row; common identity protections,
schema, privileges and normal Sheets behavior remain unchanged. A dedicated
real-SQL regression fails before and passes after the fix, including nonblank-ID
refusal, repeated deletion and a distinct replacement identity. The immutable
source fixture is retained with one exact bounded witness adjustment.

Both clean-copy runs completed all 16 implemented families without a new failure:
**455 HTTP requests each**, all **31** ordinary mutation proofs, 20 same-key pairs,
20 stale-edit pairs, ten multi-table rollbacks, ten lost-commit-acknowledgement
trials, one mobile response-loss/reload/replay and one post-effect-claim crash per
copy. Actual HTTP cost deletion retains ID/cells, increments the row once and
makes a fresh-key repeat a no-op. Receipt overlap/conflict checks still pass.
The [canonical results](../database-migration.md#cost-override-deletion-fix-and-two-local-reruns-2026-11-11)
distinguish implemented-case success from full mandatory acceptance: nine families
pass implemented checks, seven have outstanding variants, and capacity/hosted
write acceptance are NOT RUN. No full acceptance or production readiness claim.

Every original copied business record (70,777 per copy), all 24 archive tables
and 15 metadata sections remain unchanged. Both generated checkpoints restore
with all 51 table hashes/15 metadata sections equal (3.717 / 3.127 seconds),
with zero checkpoint loss and no provider replay. The previous failed copy and
both completed runs are preserved; the test app is stopped. Protected hosted
staging's full before/after snapshot and production environment metadata match;
Google Sheets remains production's store. No hosted write, real provider call,
production-data request, original recovery-resource change, merge or cutover.

571 regression tests, nine harness checks and the new real-SQL regression pass;
lint/typecheck and credential-free production build pass with only the inherited
shipmentRow warning. Routes, schema, grants, dependencies and historical fixtures
are unchanged. Draft PR #62 contains the scoped fixes/results. Harness `943f870`
and private receipt
`b114a943afd42221ef464410128626013b90097fac1aacbbec4fae2b9261f77a`
pin the operational evidence; raw records, credentials and backups are not published.
Complete remaining coverage/repetitions/capacity before considering separately
approved hosted acceptance or production activation.

## Receipt-overlap fix — local rerun stopped at WT12 (2026-11-11)

The owner authorized fixing the overlap blocker and rerunning disposable local
writes. Commit `ff7c997ed6452a20b068762103c589ddd4f0b502` normalizes identical
receipt-number payloads after pagination/date filtering, preserving first-seen
order and values. Conflicting payloads or missing identities reject before any
receipt reaches the writer. The normal Sheets and SQL paths share this client;
no existing rows, constraints, roles, schema or storage settings are changed.
Six focused regression cases and an actual-client/Sheets-compatible write oracle
prove exact unique-receipt totals and conflict atomicity. Historical fixtures are
unchanged, with a hash-pinned inverse for original-source witnesses only.

Both task-owned copies matched all 51 clean table hashes and 15 metadata sections
before writes. The new private app passed real SQL/HTTP overlap, sale/refund/stock
totals, provider-page failure rollback, conflict rejection and same-key corrected
retry. The receipt issue is resolved. Thirteen families / 281 HTTP requests were
attempted, including 69 entry checks and 25 mutation replay/concurrency proofs.
The broader campaign then stopped at **WT12 cost-override deletion**: its SQL
binding does not support the adapter's blank-row removal, so the business-identity
guard refuses it (HTTP 500). No command or revision delta commits. This separate
defect remains unfixed; later cases, second clean run and capacity are BLOCKED.
See the [canonical rerun evidence](../database-migration.md#receipt-overlap-fix-and-local-rerun-2026-11-11).

All 70,777 original copied business rows, 24 archive tables and 15 metadata sections
remain unchanged. Generated-state recovery matched all 51 tables/15 metadata
sections in 4.38 seconds without provider replay. The second copy is pristine and
the app stopped. Protected hosted staging's 51 tables/15 metadata sections match
before/after; production environment metadata is unchanged and Google Sheets
remains active. Existing recovery containers and prior evidence are preserved.
No hosted write, real provider/production-data request, merge or production switch.

571 regression tests and nine harness checks pass; lint/typecheck and credential-free
production build pass with only the inherited shipmentRow warning. Routes, schema,
immutable fixtures, dependencies and lockfile are unchanged. Draft PR #62 now covers
the receipt fix and stopped rerun, not full write acceptance. Operational harness
`141bc9c` and private receipt
`3984fae4a052a04e9f6f71d8c95f7006705b502f681c7b6d52af8889ebc59298`
pin the results. Fix the cost-override binding and complete both clean campaigns
before considering any separately approved hosted test or production cutover.

## Disposable local write rehearsal — stopped at WT06 (2026-11-11)

The owner authorized a separate local copy and write harness after merged
[PR #61](https://github.com/volkswg/stock-management/pull/61), baseline
`dff802bfddf5c522c013262ba8e56ba9532a8221`. A new bounded PostgreSQL 17 cluster,
volume, TLS identity, UUID and restricted runtime login were prepared without
reusing the two existing recovery containers. The independently recovered
post-audit backup matched all 51 tables/15 metadata sections and 70,777 business
records. Only the copy identity and enumerated login metadata changed in setup.
Two clean databases were created. The real Next app uses test-only provider
composition plus independent outbound denial; production source is unchanged.

**Acceptance failed at WT06 and further writes stopped.** Overlapping fake pages
repeat one receipt: SQL rejects the duplicate identity (`sales_receipts_pkey`,
HTTP 502) and rolls back all business rows, command/effect state and revision.
The unchanged in-memory Sheets-compatible path instead stores three receipt rows
for two identities and reports synthetic net sales 180 instead of 80. This is an
existing overlap-handling defect and a migration compatibility blocker, not a
successful write rehearsal. No business-rule fix or weakened constraint was included in the initial
harness commit `c7288b3`; the subsequent authorized fix is above. The [canonical result](../database-migration.md#local-execution-result-2026-11-11)
records the scope and follow-up.

Local role/TLS/production refusal gates and 69 HTTP entry checks pass. Earlier
exploratory copies exercised orders/images, shipments, expenses, HR/payroll,
movements/stock and nonoverlapping sync/replay. Five fixture-development attempts
are preserved and are not counted as clean passing campaigns. The stopped run
has zero complete passing campaigns; full concurrency, fault/restart/browser
repetitions, capacity and remaining mandatory variants are BLOCKED. The second
clean copy is pristine; the task app is stopped and evidence/resources retained.

A preserved generated checkpoint was backed up and independently restored into
a fresh local database: all 51 tables/15 metadata sections match (3.2 seconds),
including command/effect state, with no provider replay. Hosted staging's full
51-table/15-metadata before/after comparison is exact. Production environment
metadata is unchanged with no `STOCK_*` overrides; Google Sheets remains active.
No hosted write, existing recovery-resource mutation, real provider request,
production data request or cutover occurred. Hosted write acceptance is NOT RUN.

565 regression tests and eight harness self-tests pass; lint/typecheck and
credential-free production build pass, with only the inherited shipmentRow
warning. Existing routes, fixtures, schema, application rules and lockfile remain
unchanged. The secret-free CI job now also runs the harness self-tests, not the
private real-data rehearsal. Operational harness commit `1eb8769` and private
receipt `8a70527cd5fe0b49a6bcdf8b5853c2963937cb4df149e1692061efada304983a`
pin the evidence; subsequent formatting has a retained syntax-equivalence proof.
Raw data, credentials, manifest, backup, provider logs and screenshots are not
published. Receipt-policy remediation, two clean reruns and all outstanding
acceptance gates precede any separately approved hosted test or production switch.

## Private Supabase app — read-only acceptance (2026-11-11)

PR #60 adds an explicit read-only staging flag, mutation-route/transaction blocks
and a server-only outbound provider guard. A separate protected Vercel preview
uses a dedicated SELECT-only database login through the dashboard-confirmed IPv4
session pooler with TLS verification. The first direct-endpoint preview failed
its reads and was superseded; protection was retained throughout. The production
domain still resolves to `dpl_Gzd8hJXHywXx3ntTHA8dW7TpU1Zb` at merged PR #59,
and production remains on Google Sheets. No production setting was changed.

The final hosted run passed 166 API checks (130 reads, 32 mutation refusals and
four authorization/validation/not-found responses), 20 browser pages and five
mobile views. Saved source application outputs match historical order details,
inventory, attendance/payroll, sales/profit, expenses, adjustments, advances and
sync history. All successful reads report revision 70,778. Missing/wrong bearer,
Vercel protection and runtime provider refusal also pass. Browser tests attempted
no mutations and blocked foreign requests. Private screenshots/bodies and complete
receipts remain outside Git; no business values or credentials are published.

All 51 table fingerprints remain identical to the pre-test snapshot and the
verified post-audit backup. The only metadata changes are the dedicated login,
25 SELECT policies/grants, 26 ACL entries and PostgreSQL's creator-admin grant
(without SET/INHERIT). The previous 15 metadata sections match after precisely
removing those additions. The login can mutate zero private tables, assume no
other role, create no schema and execute no privileged private-schema function.

All 565 regression tests, two targeted safety tests, lint/typecheck and both
isolated credential-free and read-only staging builds pass; 113 client chunks
contain no staging secrets. Lint retains the inherited unused `shipmentRow`
warning. Three initial local/direct report failures under overlapping reads are
retained as evidence; isolated pooler-backed stock/profit checks match. Final
hosted read latencies were p50 227 ms, p95 1,648 ms and maximum 1,839 ms, with no
peak-load claim. The canonical migration runbook records access boundaries and
the exact acceptance scope. Write/provider tests, realistic capacity, source
refresh/freeze and production authorization/activation remain pending. No
business row, command, side effect, revision value or production source changed.

## Hosted audit removal — applied and verified (2026-11-11)

The owner explicitly authorized applying only the audit-removal migration to
isolated hosted staging. Backup checksums, independent-restore receipts and the
current 51-table/15-metadata fingerprints were rechecked first and matched.
The migration dry run listed only `20261111034402_remove_operational_audit.sql`.
It was applied through the migration system; the ledger now contains exactly the
four prior versions plus `20261111034402`. A result-log filename collision occurred
after the command completed; no migration retry occurred. Read-only schema/ledger
inspection and complete verification established the committed outcome.

Hosted staging now matches the successful local rehearsal in every table hash
and all 15 metadata sections. The audit table, identity sequence, logging function
and 23 audit triggers are gone. One revision row starts at 70,778, with 23 statement
triggers and the reviewed RLS/column grants. All 50 unaffected tables, all 70,777
business records, unrelated permissions and roles remain unchanged; 66 offline
application comparisons passed against the hash-identical verified projection.
Live application/provider acceptance and production cutover are not certified.

The fresh post-change two-schema backup was encrypted, privately uploaded,
independently downloaded and decrypted using freshly recovered owner-held key
material, then restored to a fresh isolated local database. All 51 table hashes
and 15 metadata sections match. Both pre-change and post-change backup generations
and local evidence are retained. Security/health checks show no new problems;
known informational archive-RLS/unused-index notices remain without remediation.
Production was not switched and remains on Google Sheets. No application setting,
LINE/Loyverse action, business-data write, paid resource or cleanup was performed.

## Hosted pre-change recovery — bounded verification fix

The original 150-second fingerprint preflight stopped before capture. Read-only
investigation measured connection/guard setup around 1.45 seconds per connection
and approximately 82 MB of audit-row JSON. Two readers alone still timed out.
The explicit version 2 full-row SHA256 stream plus two bounded readers completed
all 51 tables and 15 metadata sections in 90.91 seconds under the unchanged limit.
All 23 business-table reconciliation proofs and the original schema/security
metadata matched. No hosted migration or business write was performed.

The fix retains legacy fingerprints and one-reader defaults, adds explicit audit
versus revision layout selection, and records/rejects fingerprint format mismatches.
Independent Python/full-row PostgreSQL oracles, 71 migration unit tests, synthetic
capture/restore and tamper detection pass. The hosted pre-change capture and
independent restore/rehearsal evidence are retained privately outside Git.

On 2026-11-11, authorized pre-change capture completed at 11:27 Bangkok. The
encrypted off-site backup was independently downloaded, checksum-checked and
decrypted with freshly retrieved owner-held key material. Both pre-change local
restores matched all 51 table hashes and 15 metadata sections. A separate local
copy passed the exact merged audit-removal migration: 50 unaffected table hashes
and unrelated security metadata remained identical; revision/runtime-write probes
rolled back cleanly. Its new-schema backup and fresh restore also matched. All
23 business tables reconcile and all 66 offline application comparisons passed.
The final hosted comparison at 11:31 Bangkok matched the backup in all 66
sections, roles and the four-version ledger; audit remains hosted and revision
is absent. Three fresh local databases were retained in existing infrastructure,
with no new container/role/password or OOM event. No hosted DDL/write or cutover.

Backup scope is the two private schemas plus supplemental password-free role
and migration-ledger evidence, not full Supabase Auth/Storage/platform recovery
or Drive images. Reconfirm writer freeze, source/backup freshness and exact
target approval before any future hosted audit removal.


## Audit removal — merged implementation and local proof (historical)

The owner requested removal of operational audit history. The proposed migration
replaces the audit table and 23 logging triggers with one transactional revision
counter and statement triggers. HTTP conflict checks, command replay, business
versions/archives and side-effect journals remain. Recovery and promotion tools
expect the replacement revision table. Historical migrations/fixtures are retained.
PR #57 verification used disposable synthetic PostgreSQL databases only. The
separately authorized real-data backup/local rehearsal is recorded above; hosted
audit removal, application activation and production cutover remain unexecuted.
See the [removal procedure](../database-migration.md#audit-history-removal-applied-to-hosted-staging)
for coordinated deployment, destructive-history semantics and old-backup tooling.

Validation: 565 application regression tests, 65 migration unit tests, 27 actual
PostgreSQL application/transaction tests, one real-browser/API test and five
offline application-parity tests passed. Populated synthetic upgrade preserves
all business/archive/journal records, removes audit objects and retains revision
rollback/conflict behavior. Complete two-schema capture/restore matches; altered
records, table grants and revision-column grants are detected. Lint and typecheck
pass (one inherited unused-variable lint warning); the isolated credential-free
production build preserves routes and browser bundle privacy. Earlier migration
files and historical fixtures remain unchanged. PR #57 used no real business data.

## Database migration — current operational status (2026-11-11)

Hosted import baseline: merged [PR #55](https://github.com/volkswg/stock-management/pull/55),
`65ed6f65256e59f7f6fce44bcd4fb88a819ae95c`. The latest saved hosted
reconciliation completed on **2026-11-11 at 08:46 Bangkok / 01:46 UTC**.
The separately authorized pre-change backup/final hosted comparison is current
to 11:31 Bangkok, with local migration/recovery rehearsal completed at 11:33.
Production still uses Sheets; no new live Sheet export was performed.

| Workstream | Latest verified state |
| --- | --- |
| Hosted schema | Audit-removal migration applied and ledger verified; one private revision counter replaces audit history. Business schema/security invariants retained. |
| Latest source and import | Latest approved original-Sheet export generated 23 business-table CSVs; owner manually imported **70,777 records** into `stock_operational`. This path bypassed the hosted archive/import-batch step. |
| Record reconciliation | All 23 operational business tables reconcile against that saved source after one approved product-name encoding correction; one row updated and one audit row added. Private row IDs and values remain outside Git. |
| Application calculations | **66 offline application comparisons passed** against saved source/target artifacts. This does not certify live hosted API/browser/provider behavior. |
| Sequences | No alignment required; no explicit sequence writes performed. |
| Recovery | **Pre-change two-schema backup and independent recovery verified.** Encrypted private off-site download, fresh key recovery, two exact old-schema restores and local new-schema capture/restore passed. Earlier backups remain retained; broader platform recovery is not certified. |
| Application activation | **Not ready; no cutover performed.** Production still uses Google Sheets. No production storage setting was switched by these operations. |
| Cleanup | Superseded export/build/import artifacts retired; latest source/CSVs, verification/audit evidence, credentials/TLS and recovery dependencies retained. Only the explicitly approved failed Docker rehearsal and its dedicated volume were deleted; two recovery containers and shared TLS remain. |

Hosted audit removal and its post-change recovery verification are complete.
Before application activation, resolve hosted runtime,
security/performance and business acceptance, and review changes since the
saved export. Later Sheet activity is not covered by this reconciliation; any
refresh or delta handling requires a reviewed procedure and approval. Do not
replay schema migrations or regenerate/retry retired import SQL as a next step.

The [machine-readable status](../../tools/migration/phase3-status.json) records
these aggregate outcomes and the private result receipt's SHA-256. The owner
retains detailed records, workbook identity, mappings and artifacts privately;
none are published here. Credentials in a previous Mac or Cloud session are not
assumed available to a future operator. The
[execution runbook](../database-migration.md#phase-3-real-data-validation-and-controlled-cutover)
remains the source of acceptance and separately approved operational steps.

## Historical architecture snapshot and single-workbook account configuration

At this architecture milestone, verified main was `689d02c93326a1831c38c583c464524644c72e66` (merged PR44), with the external/features retirements and PR43 account source complete. The tree matches the previously verified PR44 head with 550 passing tests and successful lint/typecheck/isolated build.

Branch `fix/loyverse-single-workbook` makes sheet mode read `loyverse_accounts` only from the existing GOOGLE_SHEETS_SPREADSHEET_ID. The dedicated account-workbook variable/AppConfig field and separate-workbook restriction are removed. No workbook/JSON fallback is added; env-mode rollback, six-column validation, ordering and server-only credential handling remain. Historical source inverses preserve old fixture bytes and assertions. See [verification](verification.md#loyverse-single-workbook-support) and [owner instructions](../../README.md#loyverse-configuration), including workbook-wide token visibility. No production migration, ACL/Vercel change or deployment is performed.

## Migration assertion performance correction (merged PR #55)

Merged [PR #55](https://github.com/volkswg/stock-management/pull/55), based on
merged PR54, changes only import-plan row lookup:
an equality predicate on the validated non-null primary key precedes all existing
null-safe field comparisons. It reuses existing indexes; source values, snapshot
encoding, database schemas, roles, permissions, recovery fingerprints and timeout
guards stay unchanged. Synthetic PostgreSQL coverage checks index planning,
identical replay and rejection of changed values; see the
[migration guide](../database-migration.md#export-dry-run-and-import). This code
change does not authorize a hosted retry or replace its full constrained rehearsal.

## Historical HR completion evidence (PR #33)

At the start of PR #33, verified main was merged PR32, `f90e7bdeb3d7c9815148c3011d217e07b1a80b19`. The requested PR31 SHA was stale: GitHub confirmed PR32 merged, its tree matched the reviewed financial implementation exactly and no conflicting implementation PR was open. Work therefore starts from that audited main on `refactor/hr-application-completion`, preserving the merged work.

This completion owns employee/compensation list/create/update/history/effective dates and all attendance list/clock/leave/update operations in HR applications/rules, with semantic ports and one feature-owned workforce adapter. Public server composition supplies the payroll workforce readers; the legacy bridge no longer imports legacy HR business services. Original full-service callable types, argument getter order, runtime export keys and enum/error/function identities remain through typed aliases. All prior financial behavior, schemas/providers/UI and the closed cycle/browser safeguards remain intact. Necessary compatibility stays for PR36.

The limited hr-application-before witness captures the two original implementations, old public composition and eight route sources. Every inherited fixture is unchanged. Existing guards reconcile exact aliases/imports before older history and validate the precise added HR closure without changing historical counts/expectations. Seven operation/HTTP tests and three boundary tests compare actual original/current applications/adapters, real Sales refund-driven payroll, partial failures, pending writes, all eight HTTP routes and compile-time callable signatures. See [verification](verification.md#hr-application-completion) for exact results and limits.

## Merged implementation ledger

Counts below are the original Codex-local final reports, traced to the original verification record and linked PRs; this documentation task did not independently rerun every historical checkout or certify external CI. Each row retains the exact merge SHA, not an unmerged implementation head. Current execution is recorded separately in [verification](verification.md#external-namespace-retirement-issue-39).

| PR / merged SHA | Delivered slice | Original test count (inherited + added) |
| --- | --- | --- |
| [#1](https://github.com/volkswg/stock-management/pull/1) · `e77ddc1ce2b73a19e218a5d20353c5b04e23ff16` | Preparation: rules, audited targets, offline tests; no production migration. | 10 = 0 + 10 |
| [#2](https://github.com/volkswg/stock-management/pull/2) · `d10d530a2052cfc10bdb71708af267ccd8db91bb` | Orders browser-safe contracts and original enum/type compatibility. | 32 = 10 + 22 |
| [#3](https://github.com/volkswg/stock-management/pull/3) · `a29396dc5d597b8ac7e40e95d9bb2ab652e59e4c` | 15 Orders UI/client/style moves, unchanged route wrappers. | 44 = 32 + 12 |
| [#4](https://github.com/volkswg/stock-management/pull/4) · `60408c3e91ebecd0dc550bbf00464b9e6ce708d2` | Orders list and simple creation application/ports/Sheets adapters. | 68 = 44 + 24 |
| [#5](https://github.com/volkswg/stock-management/pull/5) · `a0ff4127b68419d15a7836cdb130a3a33c87d21d` | Shipment public contracts and original behavior characterization; temporary legacy definitions. | 139 = 68 + 71 |
| [#6](https://github.com/volkswg/stock-management/pull/6) · `c58669b7a00e8c9169423228fa6f18ab782c358a` | Six safe Shipment UI/style moves; browser client deliberately held pending picker dependency. | 148 = 139 + 9 |
| [#7](https://github.com/volkswg/stock-management/pull/7) · `a3241ecd7ae3bdf14b0c1ede8681bf28e80e850a` | Orders-owned browser picker and stable client app composition. | 175 = 148 + 27 |
| [#8](https://github.com/volkswg/stock-management/pull/8) · `7900bc93c8de47cf435fa14b07a76eb8710b9348` | Seventh Shipment UI/client move; original client bytes, no app shim. | 188 = 175 + 13 |
| [#9](https://github.com/volkswg/stock-management/pull/9) · `1d6392abfcc117de1c70a966e78cabe41c0cc9ab` | Shipment creation use case, writer port and A:M adapter. | 212 = 188 + 24 |
| [#10](https://github.com/volkswg/stock-management/pull/10) · `d4e512bc2f3d5273231f174dd117ea507ccb4850` | Shipment list/detail use cases, four-sheet reader and original cost formulas. | 235 = 212 + 23 |
| [#11](https://github.com/volkswg/stock-management/pull/11) · `ffb14fa63842efdc705de6709ae1efd3df13cd25` | Shipment linking, deferred business snapshot/A:G writer and original error identity. | 261 = 235 + 26 |
| [#12](https://github.com/volkswg/stock-management/pull/12) · `c1f5678b88b162856f7754b889bf4667c22fccf1` | Shipment status use case/opaque target; M1→A2:M→conditional B:M. | 291 = 261 + 30 |
| [#13](https://github.com/volkswg/stock-management/pull/13) · `b16df0fff494b01357c318b65cc5e586656c028b` | Shipping-bill coordination/cleanup seam; existing Drive provider unchanged. | 317 = 291 + 26 |
| [#14](https://github.com/volkswg/stock-management/pull/14) · `d405fa9333780d6b32abd3df8efaccabf7fc7d20` | Orders detail deferred projection port, Shipment adapter and flat five-read app injection. | 339 = 317 + 22 |
| [#15](https://github.com/volkswg/stock-management/pull/15) · `703d55f5c67dab8392fcc29a757cef4b2766a975` | Physical single ShipmentStatus definition in pure status leaf; DTOs temporarily legacy. | 355 = 339 + 16 |
| [#16](https://github.com/volkswg/stock-management/pull/16) · `7dbf3d4824a2b6d5cd38ee6b959c2c9f805f30b2` | Eight DTO declarations move verbatim to public contracts; legacy leaf becomes forwards. | 366 = 355 + 11 |
| [#17](https://github.com/volkswg/stock-management/pull/17) · `37005935dcbfd0e32f50d7a84543ddfcdcee13dc` | Backend validation helper import only: public contract replaces mixed Shipment barrel. | 370 = 366 + 4 |
| [#18](https://github.com/volkswg/stock-management/pull/18) · `9388f8a89f23e7547731ee649baf84af92c892e6` | Three Shipment route imports use public server/contracts; original error class exported. | 375 = 370 + 5 |
| [#19](https://github.com/volkswg/stock-management/pull/19) · `5d01209f9c241a5c6b4f07702b9684e7e2a2f79a` | Shared Google auth/JWT/Sheets/Drive physical owners, generic types, explicit legacy forwards. | 395 = 375 + 20 |
| [#20](https://github.com/volkswg/stock-management/pull/20) · `77fb645e08a98d8fa6fe38028d6791b3396da41f` | Orders pure Sheet type-import prerequisite; **no worksheets moved**. | 399 = 395 + 4 |
| [#21](https://github.com/volkswg/stock-management/pull/21) · `b0926e1321ce55869f87d3fa72852cc5e55ed693` | Five Orders/Shipment class/header pairs physically moved with ten legacy forwards. | 410 = 399 + 11 |
| [#22](https://github.com/volkswg/stock-management/pull/22) · `d59ea160309f92feed88878cc3f05811222db21d` | Five Sales class/header pairs physically moved with ten legacy forwards; services remain legacy. | 419 = 410 + 9 |
| [#23](https://github.com/volkswg/stock-management/pull/23) · `71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb` | Inventory employee-directory prerequisite via HR public query; **no HR worksheet move**. | 429 = 419 + 10 |
| [#24](https://github.com/volkswg/stock-management/pull/24) · `02506658dd79a6432824df7c15b0292be4d15886` | Documentation consolidation only: canonical ownership/decisions/roadmap/evidence, 35→14 Markdown files; no source/test changes | 429 = 429 + 0 |
| [#25](https://github.com/volkswg/stock-management/pull/25) · `2e9fe4a6cb734a1d796d91f8e0805febf7273b70` | Three HR core worksheet/header pairs with six named forwards; no payroll/other business extraction | 435 = 429 + 6 |
| [#26](https://github.com/volkswg/stock-management/pull/26) · `4952644f06fcfc216c9351c347dcc806d887bb09` | Stock Counts worksheet/header and Movement worksheet, three legacy forwards; no business extraction | 442 = 435 + 7 |
| [#27](https://github.com/volkswg/stock-management/pull/27) · `72204e095d4b1e9425eb4f573bbe23c620bc99a7` | Movement worksheet-schema prerequisite; direct session coupling removed, no worksheet relocation | 447 = 442 + 5 |
| [#28](https://github.com/volkswg/stock-management/pull/28) · `48cf8d6d011544206cafa7ac35eeeafde5f22be9` | Inventory/Sales query dependency prerequisite | 452 = 447 + 5 |
| [#29](https://github.com/volkswg/stock-management/pull/29) · `57064008a0add0603e790f64983b797eaf4e92de` | LINE user-state worksheet/header ownership | 458 = 452 + 6 |
| [#30](https://github.com/volkswg/stock-management/pull/30) · `5c72e122b54d296cedc3d0f16a1e466128d63aaf` | Remaining Inventory/Expenses/HR worksheet ownership with shared constructor and browser prerequisites | 465 = 458 + 7 |
| [#31](https://github.com/volkswg/stock-management/pull/31) · `b3b55a806c7dcf2fe636b10f56d5db90ff19ebc3` | Expenses business ownership, public contracts and HR/Sales consumer cleanup | 477 = 465 + 12 |
| [#32](https://github.com/volkswg/stock-management/pull/32) · `f90e7bdeb3d7c9815148c3011d217e07b1a80b19` | HR payroll/advance/settlement ownership, type-cycle and browser closure | 490 = 477 + 13 |
| [#33](https://github.com/volkswg/stock-management/pull/33) · `9ab9f2095342c66f30acf9612d79ed92063b8597` | HR employee, compensation and attendance application completion | 500 = 490 + 10 |
| [#34](https://github.com/volkswg/stock-management/pull/34) · `ff2e11167a686dee048ed1b26cace3b24b60b316` | Sales and Inventory business ownership | 510 = 500 + 10 |
| [#35](https://github.com/volkswg/stock-management/pull/35) · `efb73eb65100c1784283cad2b2b78225a97b24de` | Orders and LINE workflow ownership | 520 = 510 + 10 |
| [#36](https://github.com/volkswg/stock-management/pull/36) · `3b6a344c43fc4b027a900fffc20568ce5a549648` | LINE and Loyverse transport moved to root infrastructure | 526 = 520 + 6 |
| [#37](https://github.com/volkswg/stock-management/pull/37) · `5867348d86d57cc98322362fa175140626c7f5d7` | Final composition and compatibility cleanup | 531 = 526 + 5 |
| [#40](https://github.com/volkswg/stock-management/pull/40) · `3c870ef122c640c6ed8958dadb83ae714094dfb5` | Remove entire external compatibility namespace; migrate canonical consumers | 534 = 531 + 3 |

Historical reports record successful baseline/final lint/typecheck and isolated builds with unchanged 23-page/35-API contracts and app-paths manifests. Later reports retain one unused shipmentRow import warning in `tests/shipments-read-seam.test.mjs:6`. Details, intermediate corrected failures, original limitations and precise baseline/head provenance remain in the immutable [original verification record](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/verification.md). Do not treat those past reports as substitutes for executing checks at a new base.

## Historical evidence

Historical test fixtures remain in [tests/fixtures](../../tests/fixtures) unchanged. They contain complete original sources, raw SHA-256 values, printed TypeScript AST declarations, JSON samples, consumer inventories and event traces. Existing `tests/helpers/*-history.mjs` helpers retain exact, named inverse-source reconciliation; no fixture regeneration, broad inventory exclusion or skipped inherited test is authorized.

| Migration | Authoritative original evidence / treatment |
| --- | --- |
| Initial routes/Orders contracts/UI/list/create | route-contracts.json, orders-type-shapes.json, orders-read-model.json, orders-ui-structure.json, orders-seam-list.json and orders-seam-preserved.json; original body/CSS/export assertions remain |
| Shipment UI/picker/client | shipments-structure.json, shipments-ui-relocation.json, shipments-browser-client.json, orders-picker-seam.json; original raw/body/CSS values retained, only reviewed injection/import structures reconciled |
| Shipment creation | shipments-create-before.json: exactly createShipment/getShipmentsAppendRange history cases; original inputs/clock-ID/append parity, other declarations unchanged |
| Shipment reads | shipments-list-before.json and shipments-read.json: thirteen original declarations retained; eleven helpers exact, two orchestration declarations behaviorally reconciled |
| Shipment linking | shipments-link-before.json: five original declarations retained; four helpers exact, one orchestration parity case, single unchanged error class |
| Shipment status | shipments-status-before.json: exactly updateShipmentStatus/isValidTransition/toNumber history cases; two pure helpers exact, original orchestration/event parity |
| Shipment Drive | shipments-drive-before.json: original route raw source/PATCH and unchanged/moved helper AST witnesses; exact route-only migration case |
| Orders detail | orders-detail-before.json plus orders-seam-preserved.json: original getOrderDetail body `7a863b4ebdd1220a8e7f250978f5fc644f19656f95a286b2fe88e3abdadff293` remains authoritative; moved helpers/server/PATCH witnesses retained |
| Enum then DTO ownership | shipments-enum-before.json and shipments-dto-before.json: exact original enum/eight aliases, prior contract raw fingerprint reconstructed through two reviewed stages; all other source inventory keys stay active |
| Validation and HTTP imports | shipments-validation-before.json, shipments-http-before.json: exact inverse import substitution restores full original helper/routes, including original helper hash `5a7eee8047a280c4c01df65457cd809de71b581ae565d1bbae1034a298e4d4df`; real handler parity/class identity remains |
| Shared Google transport | google-infrastructure-before.json and google-infrastructure-consumers.json: original providers/generic/aggregate types, production inventories and sixteen physical paths; exact restoration/identity/transport tests |
| Orders pure Sheet types | orders-sheet-types-before.json: four exact type-import substitutions and emitted-runtime equivalence; old mixed-index negative reverse-edge check remains |
| Orders/Shipment worksheets | worksheet-ownership-before.json: ten original files/headers, exact import restoration, class/prototype/header/index/registry identity; virtual move test now resolves actual owners, negative reverse edge retained |
| Sales worksheets | sales-worksheets-before.json: ten exact sources, consumer/operational-script/type/browser audit, original/current fake-transport traces; no service rewrite |
| Inventory core worksheets (PR26) | inventory-worksheets-before.json: exact three complete sources/raw hashes/ASTs, original headers/calls, production/previous-fixture inventories, 79 resolved direct/aggregate edges, original/proposed runtime/type module graphs, three script paths and four inherited erased client roots. Only three exact history cases/new owners. |
| HR core worksheets (PR25) | hr-worksheets-before.json: exact six original sources/raw hashes/declarations/header arrays, synthetic calls, 84 resolved direct/aggregate consumer edges, three operational-script paths and four inherited erased browser roots. Original fixtures unchanged; six exact history cases and six new owners only. |
| Inventory employee directory | inventory-employee-directory-before.json: four changed legacy source witnesses, two verbatim DTOs, original directory body/error/async/HTTP behavior, seven exact new files; PR15–22 inventories reconcile only this named delta |

The fixtures still embed `docs/architecture/shipments-contracts.md` inside two captured original-source strings (enum/DTO history). They remain immutable; that original document is preserved by the pinned link in the index below. No executable source/test reads the removed Markdown paths. Old fixture references describe historical source and must not be rewritten to the new guide.

## Document consolidation index

Before: 35 tracked Markdown files, 29 in architecture. After: 14 total, five in architecture and three in refactoring; four operational guides stay at their original paths byte-for-byte. Twenty-five old architecture documents are consolidated/removed; four new canonical documents are added (decisions, roadmap, progress, verification), and existing authoritative ownership paths are reused.

The original descriptions below are retained at the verified immutable base commit, including full per-file maps/hashes, old proposal/audit tables and historical caveats. **Current** rules are the canonical destinations, not superseded statements inside an old PR note. This avoids duplicating a second full archive in the working tree.

Published PR bodies were audited across #1–23. They contain old document path references. Those PR bodies/comments were not rewritten: branch-relative/default-main URLs to removed paths can stop resolving, while commit-pinned links and PR file/diff views preserve evidence. Use this complete index to recover the old text. Do not claim external historical links were all rewritten or that these notes can be discarded from Git history.

| Original document at immutable base | Canonical destination / disposition |
| --- | --- |
| [README.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/README.md) | [Architecture guide](../architecture/README.md) |
| [audit.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/audit.md) | [Current map](../architecture/migration-map.md), [dependency rules](../architecture/dependency-rules.md) and [roadmap](roadmap.md); original snapshot only in history |
| [dependency-rules.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/dependency-rules.md) | [Dependency rules](../architecture/dependency-rules.md) |
| [eslint-boundaries.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/eslint-boundaries.md) | [Scoped enforcement](../architecture/dependency-rules.md#scoped-enforcement) |
| [folder-rules.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/folder-rules.md) | [Folder rules](../architecture/folder-rules.md) |
| [google-shared-infrastructure.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/google-shared-infrastructure.md) | [Shared transport](../architecture/decisions.md#shared-google-transport-and-feature-worksheets), [map](../architecture/migration-map.md) |
| [inventory-employee-directory.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/inventory-employee-directory.md) | [Directory prerequisite](../architecture/decisions.md#inventory-employee-directory-prerequisite), [completed HR ownership](../architecture/migration-map.md) |
| [migration-map.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/migration-map.md) | [Current ownership map](../architecture/migration-map.md); original whole-repository proposed paths in history |
| [orders-contracts.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/orders-contracts.md) | [Public contracts](../architecture/decisions.md#public-contracts-and-single-enum-identity) |
| [orders-detail-shipment-projection.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/orders-detail-shipment-projection.md) | [Detail projection](../architecture/decisions.md#orders-detail-and-shipment-projection) |
| [orders-sheet-type-imports.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/orders-sheet-type-imports.md) | [Shared transport/worksheet boundary](../architecture/decisions.md#shared-google-transport-and-feature-worksheets) |
| [orders-shipment-picker.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/orders-shipment-picker.md) | [Browser picker](../architecture/decisions.md#orders-browser-picker-and-ui) |
| [orders-shipments-worksheet-ownership.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/orders-shipments-worksheet-ownership.md) | [Actual worksheet owners](../architecture/migration-map.md#physical-worksheet-owners) |
| [orders-ui-migration.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/orders-ui-migration.md) | [Folders](../architecture/folder-rules.md) and [UI/picker](../architecture/decisions.md#orders-browser-picker-and-ui) |
| [orders-use-case-seam.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/orders-use-case-seam.md) | [Orders list/creation](../architecture/decisions.md#orders-list-and-simple-creation) |
| [refactoring-plan.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/refactoring-plan.md) | [Single roadmap](roadmap.md) and merged ledger above |
| [sales-worksheet-ownership.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/sales-worksheet-ownership.md) | [Actual worksheet owners](../architecture/migration-map.md#physical-worksheet-owners), [pending Sales work](roadmap.md) |
| [shipments-contracts.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/shipments-contracts.md) | [Contracts/enum](../architecture/decisions.md#public-contracts-and-single-enum-identity) |
| [shipments-create-seam.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/shipments-create-seam.md) | [Shipment creation](../architecture/decisions.md#shipment-creation) |
| [shipments-drive-seam.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/shipments-drive-seam.md) | [Bill upload/cleanup](../architecture/decisions.md#shipping-bill-upload-and-cleanup) |
| [shipments-dto-ownership.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/shipments-dto-ownership.md) | [Contracts/DTO ownership](../architecture/decisions.md#public-contracts-and-single-enum-identity) |
| [shipments-enum-ownership.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/shipments-enum-ownership.md) | [Contracts/enum identity](../architecture/decisions.md#public-contracts-and-single-enum-identity) |
| [shipments-http-boundary.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/shipments-http-boundary.md) | [Public server surfaces](../architecture/dependency-rules.md#actual-public-surfaces-and-directions), historical import restoration above |
| [shipments-link-seam.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/shipments-link-seam.md) | [Linking](../architecture/decisions.md#shipment-order-linking) |
| [shipments-read-seam.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/shipments-read-seam.md) | [Shipment reads/costs](../architecture/decisions.md#shipment-list-and-detail-reads) |
| [shipments-status-seam.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/shipments-status-seam.md) | [Status update](../architecture/decisions.md#shipment-status-update) |
| [shipments-ui-relocation.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/shipments-ui-relocation.md) | [UI/picker](../architecture/decisions.md#orders-browser-picker-and-ui), [actual map](../architecture/migration-map.md) |
| [shipments-validation-import.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/shipments-validation-import.md) | [Public surfaces](../architecture/dependency-rules.md#actual-public-surfaces-and-directions), historical witness above |
| [verification.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/verification.md) | [Safe procedure/current results](verification.md) and original ledger evidence above |

Retained operational/user guides: [expenses](../expenses.md), [movement migration](../movement-migration.md), [LINE rich-menu links](../rich-menu-links.md), [shop stock adjustments](../shop-stock-adjustments.md). Root README retains the existing movement-mode and salary-advance/settlement guidance. These are instructions for separately authorized operations, **not** verification commands.

## Documentation debt and tradeoffs

The original 244-TS-file preparation audit and huge proposed destination inventory are historical snapshots, not a live repository-wide graph/status report. Current canonical docs cover verified owners and known debt without pretending every unmigrated file has been reclassified. Preserve the immutable full map for future file-level planning and refresh only the slice being migrated.

Historical branch-relative URLs are a compatibility tradeoff of removing obsolete documents; this index gives immutable replacements. External operational URLs were not contacted. No new CI/browser/integration/concurrency evidence is inferred from documentation cleanup. Future changes must update current canonical ownership/roadmap and append evidence here rather than reintroducing one note per small PR.


## PR25 — HR core worksheet ownership

Verified base: `02506658dd79a6432824df7c15b0292be4d15886`, merged PR24, clean initial tree; branch `refactor/hr-core-worksheet-ownership`. Three original classes and three mutable header arrays move from `externals/google/sheet/sheets/{employees,employee-compensations,employee-timesheets}` to `modules/hr/infrastructure/google-sheets/<same directory>`. All six old leaves become explicit named forwards. Only class import paths change to root BaseGoogleSheet/generic erased types/range helper and local headers; class bodies/header declarations reconstruct exactly.

One table-driven characterization passed on the untouched worksheets before moving. Six added tests cover original default/explicit ranges, identity/mutability/pending/sync-async failures, full source/declaration/previous-fixture preservation, physical/legacy/both-index/registry identity, actual original/current GoogleSheetsClient fake-fetch traces, the real worksheet through unchanged directory/stock-adjustment HTTP, and exact lint/consumer/browser audits. Compile-time fixtures preserve nominal class/constructor/instance/header types. The existing PR23 runtime/type graph tests now traverse actual moved files/forwards and retain negative direct/legacy/mixed-barrel Inventory→HR cases.

The 84-edge source/test consumer audit resolves alias/relative/type/re-export/dynamic/import-type syntax and records all three operational scripts without executing them. Module graphs remain acyclic with only Shipments→Orders; root transport is feature-agnostic. The four inherited client erased paths remain exactly salary advances, payroll, expense master and expenses; no runtime provider reachability or new erased debt. The unchanged directory import follows its same-feature legacy header forward. HR never imports Inventory's private error class.

Prior PR15–23 source inventories recognize only these six named changes through inverse-source reconstruction and six exact additions. Closed loaders admit only the six reviewed paths; all earlier fixtures/hashes and negative checks stay authoritative. No aggregate registry/factory/index, production consumer, directory application/reader/error/async behavior, payroll/attendance/financial/status/Drive/HTTP/UI/provider/env/package/schema changes. PayrollRecordsSheet, RecordsSheet, other worksheets, broader HR/Inventory use cases, four browser type-only debts, compatibility retirement, SaaS and concurrency remain deferred. Final Codex-local results: 435 tests = 429 inherited + 6 new, zero failures/skips; lint exits zero with only the inherited unused shipmentRow warning, typecheck and isolated credential-free build pass. Routes remain 23/35 and app-paths manifest is byte-identical. [Full execution record](verification.md#pr25-hr-core-worksheet-ownership).


## PR26 — Inventory core worksheet ownership

Verified base `2e9fe4a6cb734a1d796d91f8e0805febf7273b70`, merged PR25, exact remote main and clean initial tree; branch `refactor/inventory-core-worksheet-ownership`. Exactly StockCountsSheet.ts and its const.ts plus MovementSheet.ts move from legacy worksheet directories to Inventory infrastructure. Three named forwards retain callers. Only necessary root import paths change; all unrelated production and prior fixture bytes remain exact. No Movement const.ts, aggregate registry/factory/index change or consumer migration.

Three added characterizations pass on untouched production before the move: worksheet arguments/defaults/mutability/await/failure behavior, actual stock-count/movement/adjustment/HTTP outcomes, and original partial failures. Four further tests cover exact source/AST/fixture inventory, physical/legacy/available-index/real registry identities and batch mapping, actual old/current client transport including deletion, and lint/runtime/type/browser/consumer graphs. Compile-time assertions preserve class/header/method/row-number signatures.

The 79 affected resolved import/export edges and three operational-script paths are recorded without executing scripts. Both module graph modes retain only Shipments→Orders, no Inventory→LINE/private dependency or cycle. Mixed-barrel negative tests catch an actual file cycle rather than treating the intermediate registry as a firewall; direct private HR/LINE and erased legacy-service imports also reject. All client graphs retain exactly the four inherited erased debts and no provider runtime path. Existing HR/directory and earlier ownership guards stay active.

Inventory's legacy business service still references LINE quantity helpers; this PR does not move that dependency into modules. StockAdjustmentsSheet, RecordsSheet, PayrollRecordsSheet, UserStateSheet, business-use-case extraction, compatibility/registry retirement and SaaS/provider/concurrency work remain deferred. Final Codex-local checks: 442 tests = 435 inherited + 7 new with zero failures/skips, lint exit zero with the one inherited warning, typecheck and isolated credential-free build pass. Routes remain 23/35 and app-paths manifest is byte-identical. [Execution evidence](verification.md#pr26-inventory-core-worksheet-ownership).


## PR27 — Movement worksheet-schema prerequisite

Base `4952644f06fcfc216c9351c347dcc806d887bb09`, merged PR26; branch `refactor/movement-worksheet-schema-prerequisite`. This supersedes the blocked two-file user-state relocation scope for this PR. Only state.ts and manageMovements.ts change, plus new legacy-local worksheet-schema.ts. Original header arrays/function move verbatim; state keeps shared aliases/export identity and business operations consume the leaf directly. No UserStateSheet or header relocation.

`tests/fixtures/movement-schema-before.json` retains both original complete sources/raw hashes/declarations, three moved AST hashes, pre-edit public export keys, real service/event golden, production inventory and all prior fixture hashes. The new history helper reconstructs exact source and composes the earlier PR23 type-import change only where required; old hashes/fixtures remain authoritative. Closed test imports are explicit. Tests retain identities, descriptor/export order, pending/failing ensure/read/write behavior and actual delivery/deletion/count outputs.

Actual and virtual future user-state graphs show the direct Inventory movement path and two movement client erased paths removed, with protected runtime/type module direction still Shipments→Orders. Four mixed-registry browser debts remain. Stock counts still reaches the aggregate registry through unchanged legacy Sales queries; that path is explicitly asserted, not treated as a firewall or silently migrated. Worksheet relocation, RecordsSheet hierarchy, wider services/DTOs/quantity helper/registry retirement remain deferred. Final checks: 447 tests = 442 inherited + 5 new, zero failures/skips; lint exits zero with the inherited warning, typecheck/build pass, routes remain 23/35 and manifest is byte-identical. [Verification](verification.md#movement-worksheet-schema-prerequisite).


## PR28 — Inventory Sales-query dependency prerequisite

Verified exact main `72204e095d4b1e9425eb4f573bbe23c620bc99a7`, merged PR27, clean initial tree; branch `refactor/inventory-sales-query-dependency`. Mandatory virtual relocation preflight confirms the recorded runtime and erased stock-counts→Sales→registry→LINE private edge. Scope therefore switches only to the permitted prerequisite; UserStateSheet and its header remain physically legacy and relocation is deferred to PR29.

Only three existing production files change: stock-counts' one Sales import; the existing read query's explicit header/pure type imports; and the override service's erased type compatibility forward. New modules/sales/contracts.ts owns the exact original SalesProfitCostOverride alias with zero runtime exports. No function body, Sales barrel, registry/factory/index, worksheet/provider, HTTP/UI, PR27 helper or other business algorithm changes.

`inventory-sales-query-before.json` captures the original three sources/hashes/declarations, single DTO AST/hash, production/older-fixture inventories, 86 affected resolved edges, three script paths, blocked runtime/type traces, original runtime export keys and actual daily/dashboard/profit/read-event golden. One original query characterization passes before edits. New tests execute real queries/Stock Counts HTTP with synthetic Sheets, preserving read order, nullable/financial/refund results, pending/errors and legacy callable/header identity. Exact inverse witnesses compose the earlier PR23 stock-count change only where necessary; all previous fixture bytes remain authoritative.

Runtime/type current and virtual-next-move graphs remove the registry path from stock counts. Restoring the Sales barrel, query mixed import or either erased implementation/barrel import reintroduces it and fails a targeted regression. Protected module direction stays Shipments→Orders, root infrastructure remains feature-neutral, and four inherited browser erased debts stay exact. Existing PR27 trace assertions are reconciled against the saved original source, not skipped. Final Codex-local checks: 452 tests = 447 inherited + 5 new with zero failures/skips, lint exits zero with the inherited warning, typecheck and isolated build pass. Routes remain 23/35 and manifest is byte-identical. [Execution evidence](verification.md#pr28-inventory-sales-query-dependency-prerequisite).


## PR29 — LINE user-state worksheet ownership

Verified base `48cf8d6d011544206cafa7ac35eeeafde5f22be9`, exact GitHub main after merged PR28; clean initial tree, branch `refactor/line-user-state-worksheet-ownership`. Git transport could not reach the configured proxy; GitHub's connector independently confirmed the signed merge commit/tree and the local commit was reconstructed and hash-verified. PR27/28 production prerequisites are unchanged.

UserStateSheet.ts and const.ts move to `modules/line-workflows/infrastructure/google-sheets/user-state/`; the two old leaves become exact one-line named forwards. Only three external class import paths change. Original method/header declarations reconstruct exactly; constructor/prototype/header identities remain strict across owners/leaves/available index exports/real service instances. No aggregate registry/factory/index or business consumer changes.

The original-source witness records both complete files, declaration text/hashes, header contents, synthetic worksheet/session events, all production hashes/prior fixture hashes, resolved import/export forms and scripts without execution. Six targeted tests cover original/current worksheet arguments/mutability/pending/errors, actual session/header recovery, real SheetsClient/fake-fetch deletion/transport, exact source/history, identities and actual runtime/type/browser/lint graphs. Previous virtual-move regressions now also assert their reviewed future source equals the actual physical move, retaining restored-import and forbidden reverse-edge negatives.

The fresh full-source graph audit found no runtime cycle. It records one inherited erased cycle between calculateEmployeePayroll and manageSalaryAdvances; before/after paths are identical. Migrated module closures are acyclic with only Shipments→Orders; Inventory/Sales do not reach LINE-private persistence and all client reachable sets/four erased debts remain exact after the two-path canonicalization. No blanket allowlist or earlier fixture update.

Final Codex-local results are recorded in [verification](verification.md#pr29-line-user-state-worksheet-ownership). RecordsSheet/payroll/stock-adjustment ownership, LINE business-use-case/quantity-rule extraction, compatibility/registry retirement, inherited payroll type cycle and erased browser debts remain deferred. No whole LINE or repository milestone is marked complete.

## Sales + Inventory business ownership — completion stack, milestone 1

Base: merged PR33, main `9ab9f2095342c66f30acf9612d79ed92063b8597`; GitHub merge/no-conflict checks repeated before publication. Branch: `refactor/sales-inventory-application`. Sales reports, receipt sync/status/projections/IDs and cost overrides now have owned applications/ports/adapters and public server composition. Inventory owns counts/reconciliation, adjustments/reversals/replacements, movements and public quantity rules. HR payroll receives the public Sales dashboard reader through its unchanged consumer port. Relevant HTTP imports and three movement browser imports use the new public surfaces; route/UI logic is unchanged. Legacy callable/schema/helper paths remain identity forwards for the final audit.

Original implementation witnesses and exact import-reversal hashes are scoped to the affected source; route/UI bodies are hash-verified without duplicate large snapshots. All inherited fixture bytes remain untouched. Six new financial/stock behavior comparisons execute actual original/current applications and adapters with fake providers, including pending sync writes/live counts, partial failures, stock accounting/retries and error propagation. Four new architecture/identity/lint tests cover complete current runtime/type graphs, public composition and browser isolation. Existing payroll, HTTP, historical witnesses and restored forbidden-path negatives remain enabled. Historical graph/count checks use precisely verified overlays of subsequent owners; independent current graph checks forbid private edges even within an otherwise allowed module direction.

Final Codex-local results: **510 = 500 inherited + 10 new**, no failures/skips; lint exits zero with only the inherited shipmentRow warning; typecheck passes with callable compatibility fixtures. Pristine baseline and final isolated credential-free builds pass. Source contracts remain 23 pages/35 APIs; app-paths manifests are byte-identical with SHA-256 `32f92c7a1ef17213d7a8642ca89e3e71218984982bf1bdce66b560ef35893e1e`. All 422 production source files match the final build copy (generated TypeScript caches excluded). No provider/schema/env/package/lockfile/auth changes, live integrations, production data, operational scripts, merge or deployment. Existing partial-write/concurrency limits are preserved; independent CI/provider permissions/browser visuals are not claimed verified.

Next authorized work in the same assignment: Orders + LINE journeys, then external protocol ownership and final compatibility/aggregate audit, each on a stacked branch with separate verification and review.

## Orders + LINE workflows — completion stack, milestone 2

Parent: PR34 head `4bafdb693d5ff39684ceaba58fae452d5a432802`; branch `refactor/orders-line-workflows`, targeting its parent branch. Orders now owns remaining mutations, attachments/images and filename rules. LINE owns commands, sessions/context validation, order coordination, movement journeys/replies and webhook orchestration. Inventory owns reusable journey quantity/master/item decisions. Pure shared protocol/message prerequisites and neutral batch/header repair preserve the same persistence path. Legacy mixed helpers forward their actual owner; no Orders→LINE or private cross-feature import.

Six executable original/current comparisons cover both LINE modes, retries, HTTP/auth/JSON/status/counters, exact reply payloads, all order edits/transitions, image cleanup and partial writes; four current ownership/history/identity/lint/header-retry guards supplement inherited tests. The original descriptor guard caught a forwarding difference, corrected with identity bindings. The filesystem inventory guard now sorts both complete inventories, avoiding platform ordering of a same-stem file/directory; it retains every expected entry. Older fixtures are byte-identical.

Final Codex-local gates: **520 = 510 inherited + 10 new**, zero failures/skips. Lint passes with only the inherited shipmentRow warning; typecheck and corrected isolated credential-free build pass. All 463 production source files match the build copy; the 23-page/35-API contract and manifest remain unchanged. Full runtime/type graphs and browsers pass. Existing concurrency/partial-write limits remain; live delivery/permissions, browser visuals and independent CI are unverified. [Verification](verification.md#orders--line-workflow-completion). Continue external clients, then final compatibility/composition cleanup without merging or deploying.

## External infrastructure — completion stack, milestone 3

Parent: PR35 head `3f62dee11ed3a174eb8c99246926d4710e4cba7f`; branch `refactor/external-infrastructure`. Seven LINE/Loyverse client/protocol/constant/factory files move byte-for-byte to `infrastructure/external`, with named legacy forwards and canonical named indexes. Module/HTTP import changes are exact string inverses. Constructor/prototype/factory identities and original provider-native report projections remain unchanged. The operational rich-menu script/client was audited, not executed.

Four original-source/provider characterizations pass before movement; two additional current ownership/identity/lint guards supplement all inherited tests. Final **526 = 520 inherited + 6 new**, no failures/skips. Lint passes with only the inherited warning; typecheck and isolated credential-free build pass. All 472 source files match the build copy; route contracts/manifests remain identical. Tests cover every LINE HTTP operation using fake fetch (including 404-only alias fallback), HMAC, empty-token no-ops, Loyverse pagination/date projections/refunds/cost rounding/repeated cursor/error behavior and deferred network failures. No live calls, operational setup, production data, schema/config/dependency changes, merge or deployment. [Verification](verification.md#external-infrastructure-completion). Continue the final composition/compatibility audit in this assignment.

## Final architecture cleanup — completion stack, milestone 4

Parent: PR36 head `4d786cedab11842940346e009684539a114820b3`; branch `refactor/final-architecture-cleanup`. Main and all three published parent heads were rechecked unchanged/open. Nine remaining physical implementations relocate: aggregate Sheets construction/factory, HR payroll/shop wiring, Inventory directory compatibility, Orders detail/Shipment projection wiring, sortable IDs, Shipment HTTP validation and the standalone operational LINE client. Services/backend paths now contain named compatibility bindings only. Active API runtime graphs reach no legacy services/externals/backend implementations; adapters use canonical header/transport leaves.

The aggregate remains one unchanged composition object because existing callers require its service shape/construction/check behavior. Pure full-service type declarations, old indexes and supported callable/enum/error/header/client forwards remain intentionally. No retirement is justified merely by a production import switch. Standalone RichMenuRequest was proven identical and now shares the canonical protocol type; native Node imports confirm both client paths share one constructor without executing client operations/setup.

Three pre-move characterizations and two final ownership/lint guards supplement inherited coverage. Actual original/current ID rollover/clock rollback, aggregate configuration/real worksheet health/batch traces and standalone fake LINE HTTP errors remain identical. Current full runtime/type file cycles are empty; public module directions and provider-free browser graphs pass. New independent lint rules supplement inherited scopes; exact positive import/owner assertions follow canonical paths, including the one new public Shipment HTTP leaf. Historical fixtures remain byte-identical, with exact inverse source/body/hash checks and original negative guards retained.

Final Codex-local results: **531 = 526 inherited + 5 new**, zero failures/skips; lint exit 0 with only inherited shipmentRow warning; typecheck and isolated credential-free build pass. All 482 production source files match final build copy; 23 pages/35 APIs and manifest remain identical. Canonical current-state docs are consolidated and local links verified. No product/schema/provider/config-key/env/package/lockfile/auth/UI change, production access/live provider calls, setup scripts, merge or deployment. Existing concurrency/partial-write limitations remain. [Final verification](verification.md#final-architecture-cleanup). All four authorized milestones are prepared for independent System Architect review in dependency order; no further implementation PR is automatically authorized.

## Database migration preparation (2026-11-08)

Separately authorized migration implementation; no architectural refactoring or
runtime persistence change. Source audit: 23 business worksheets plus the excluded
credential configuration worksheet. Private SQL schema, offline/export planning,
append-only transactional import SQL, exact reconciliation, synthetic integrity
and PostgreSQL backup/restore verification are in the
[database migration runbook](../database-migration.md). All existing application
ports/composition and prior fixtures remain unchanged. Hosted inspection is
read-only; no production/live record import or Supabase DDL was performed.

Local acceptance evidence: `npm test` 553/553 pass; migration suite 11/11 pass;
real PostgreSQL 17.7 extraction/reconciliation reports `match: true` with no
differences; repeated imports, conflicting identity rollback, FK/unique checks,
RLS/grant checks and 24-table logical backup/restore fingerprints pass.
`npm run typecheck` passes; lint has only the inherited unused `shipmentRow`
warning. Credential-free isolated Next build passes using a copied dependency
folder (initial isolation attempts rejected an external symlink/cross-filesystem
hardlinks; corrected by copying). An unnecessary package script briefly caused
two historical hash tests to fail; package.json was restored unchanged and the
full suite then passed. Existing Supabase project inspected read-only; security
advisor returns no findings. Live source inventory, hosted DDL/import/restore and
production recovery time remain unverified. Network policy blocked direct
changelog retrieval; current import/backup documentation was read via Supabase MCP.

## Phase 2 operational PostgreSQL (2026-11-09, Bangkok)

Baseline: merged PR48 / `57882d2989d5d8d1156c7dc7bdeb5a694050e7ad`.
Branch `migration/postgres-operational`. The owner approved Supabase-only stable
operation keys, retained across retries/reload, saved-response replay and
missing-key rejection; original Sheets behavior remains the default.

Implemented 23 private operational business tables plus commands, audit,
side-effect attempts and target-isolation metadata; immutable staging protection;
transactional exact promotion into an empty target; feature-owned PostgreSQL
bindings reusing existing port mappers; request-wide transactions/replay/stale
checks; bounded server-only pooling, nonprivileged role/TLS/target guard and
staging authorization. LINE journals individual events, archives cleared sessions,
and records reply attempts. Drive remains the image provider. The browser key
script is loaded only for an explicitly built Supabase staging deployment.
No feature application/domain body, business calculation or prior fixture changes.

Export now preserves formatted text identities (including leading zeros), exact
unformatted numerical tokens and both original renderings/types/formulas. Two
three-rendering batch captures plus metadata use seven read requests rather than
per-tab quota exhaustion. Mocked HTTP verifies this without Google access. The
offline profiler flags duplicate IDs, invalid dates/numbers, orphans, formulas
and incompatible numeric display formats without repairing records.

Evidence is Codex-local: full suite 564/564 passes, Python migration/profile/export
checks 18/18 pass, and isolated PostgreSQL acceptance has 23 passing cases covering all seven modules,
concurrent retries, actual lost-COMMIT acknowledgement, handled-error rollback and closed-context protection against late asynchronous writes,
LINE regrouping/failure counters, Loyverse history, payroll snapshots, stale
revisions and access denial. Exact archive promotion and two-database backup/
restore compare complete data, grants, policies and constraints. Typecheck and
credential-free isolated build pass. Lint retains only the inherited unused
shipmentRow warning. The app-paths manifest is unchanged:
`32f92c7a1ef17213d7a8642ca89e3e71218984982bf1bdce66b560ef35893e1e`.
All 113 built client JS chunks exclude private SQL/configuration strings; actual
build source/public bytes match the implementation.

Prior immutable fixtures remain byte-identical. An additive transition witness
and exact wrapper/composition proofs retain old source/hash assertions. Closed
Sheets harnesses explicitly choose their original engine; separate current-source
and actual-PG tests cover the new branch. Temporary failures exposed missing void
response journaling, positional single-cell/session handling, stale source
inventories and test-volume cleanup. They were fixed without changing business
calculations. Test cleanup now removes anonymous volumes; leftover task-created
volumes were explicitly identified and removed after an ENOSPC restore failure.

No live export, Google/LINE/Loyverse request, hosted Supabase schema/data write,
production environment edit, cutover, merge or manual deployment occurred. Live
profiling, hosted capacity/reconciliation and recovery/security acceptance remain
owner-approved gates. Full-table projections/global serialization and uncertain
Drive/reply effects are explicit limitations, not production-readiness claims.

### PR49 acceptance review and Phase 3 preparation

All corrections remain in [PR49](https://github.com/volkswg/stock-management/pull/49)
on `migration/postgres-operational`, based on verified main/PR48. Review identified
and corrected three boundaries: SQL read requests now use READ ONLY and reject
nested mutation upgrades; the signature-only exception requires explicit LINE
entrypoint registration; browser command identity includes query parameters and
foreign responses cannot change local revision state. No-content responses also
replay correctly. No original application/domain algorithm or prior immutable
fixture changed; the Phase 2 witness updates only exact current-source hashes.

Fresh local acceptance: **565 regression tests, 22 Python checks, 25 real-PG
cases plus one real Chromium/API acceptance case**, zero failures/skips;
lint exits 0 with the same inherited shipmentRow warning, typecheck and isolated
credential-free production build pass. Routes/manifest remain identical and all
113 client JS chunks pass private-database-string checks. The browser fixture
executes the actual Orders route and real SQL: denied requests, Node-scoped bearer,
post-commit response loss, same-key reload replay, new intentional create and
foreign-origin denial. It does not establish full hosted/UI/provider acceptance.

Archive and operational CLI snapshots reconcile exactly with synthetic input;
import/promotion/idempotency and backup/restore pass. Restore comparisons now also
include indexes, triggers, functions and sequence definitions/values. Local
Chromium transparently retried an initial dropped socket, so deterministic
post-commit delivery failure is injected at the browser network boundary. The
final test passes without weakening the duplicate-record assertion.

A secret-free GitHub `Migration acceptance` workflow runs current-source regression,
Python, PostgreSQL/Chromium, recovery and isolated build checks with pinned actions
and isolated browser tooling. Independent evidence is the source-matched run and
artifact linked from PR49, not the Vercel preview or this local report.

The canonical [Phase 3 checklist](../database-migration.md#phase-3-real-data-validation-and-controlled-cutover)
now covers source/target approvals, secure artifacts, profiling, hosted access,
full record/business reconciliation, quotas/region/performance, recovery,
module/security acceptance, final write freeze/full-load and rollback/monitoring.
New offline delta review and readonly operational extraction support those gates;
no automatic changed-row CDC, production switch or reverse sync is claimed.

Hosted metadata-only READ ONLY inspection found no stock_migration/stock_operational
schemas, zero public tables, an empty migration ledger and no security advisories.
No hosted schema/data write, live Google export/read/mutation, provider action,
production environment change, merge or manual deployment was performed. These
checks establish our actions and current schema state, not a global audit of
unrelated operators. Real-data/hosted acceptance and production authentication,
monitoring, capacity and recovery sign-off remain separate owner-approved gates.

## Phase 3 real-data migration preparation (2026-11-09)

Verified main `e97a1c9ad9ca9402de33a9796933fece38a92eeb`, with PR48 and PR49
merged. Branch `migration/phase3-validation`. This milestone completes independent
operator preparation and synthetic validation; **no real-data migration occurred**.
The [historical preparation status](https://github.com/volkswg/stock-management/blob/65ed6f65256e59f7f6fce44bcd4fb88a819ae95c/tools/migration/phase3-status.json)
listed all 23 real source/archive/operational counts as unknown, with explicit
blocked actions. See the current operational status above for subsequent execution.

Audit fixed a migration blocker: parsing historical JSONB numbers via binary
float could round payroll snapshots. Decimal-aware canonical JSON now preserves
number types/precision in plans and extraction, including values beyond 2^53;
PostgreSQL import/promotion/restore proves exact preservation. No source cells,
application/domain code, runtime selector, production guard or merged SQL migration
changed. Prior immutable fixtures and dependency lockfiles remain byte-identical.

Export verifies headers before reading business rows, rejects credential mappings
and redirects, retains locale/timezone, and detects formula/rendering drift. Archive
extraction requires/verifies the complete original batch, including formulas and
empty-workbook identity. Operational target and TCP TLS checks precede business
reads. Explicit PGSERVICE is required; plugin identity is never assumed in Cloud.
Reconciliation writes private exclusive 0600 reports with status-only stdout.

New tools provide an exact-Tokyo deployment manifest, metadata-only inspection,
private full 23-table acceptance, original-application snapshot comparison with
frozen clocks/account/month coverage, and consistent exported-snapshot backups.
Recovery compares 51 complete tables plus schema/columns/indexes/constraints,
functions/triggers/sequences, effective privileges, RLS and runtime roles/grants.
Actual altered records/grants on expendable restored databases are rejected.
Equivalent NULL/default ACL representation differences are normalized without
relaxing effective permission checks. An initial container-path dump inspection
and ACL-representation mismatch were diagnosed before recovery acceptance passed.

Local evidence: **565 application tests, 44 Python checks, 26 real-PostgreSQL
application/concurrency cases, 4 offline application-parity cases and 1 Chromium/
actual-API case pass**. Both archive and operational reconciliation and recovery
runners pass. Lint/typecheck pass (only the inherited shipmentRow warning); isolated
credential-free production build retains 23 pages/35 APIs, the original manifest
and 113 clean client JS chunks. The first build copy hit local disk limits; an
obsolete task-created build copy was removed and the final build passed. Synthetic
capacity accounting now counts each table and its indexes once; no real workload
or hosted capacity claim follows from this small sample. Source-matched independent
CI and its synthetic artifact are recorded on the Phase 3 PR.

Read-only hosted metadata: exact stock-management project, Tokyo/ap-northeast-1,
PostgreSQL 17.11, 10,917,555 bytes, max_connections=60, no migration schemas/public
tables/runtime role, empty migration ledger and no security advisories. The plugin
role bypasses RLS and is unsuitable for app use. No hosted DDL, business row read,
export/import/restore, provider mutation, production environment change, cutover
or merge was performed. Cloud has Google application config but no approved
PostgreSQL/CLI connection or readonly export token; Supabase network access and
owner isolation/backup/billing checks remain pending.

The canonical runbook now pins locally help-verified CLI 3.0.0 commands: explicit
--remote target and --skip-vault, replacing old --linked assumptions and preventing
unrelated Vault updates. Only help/version ran. Separate approval is still needed
for exact frozen source reads and hosted DDL/import/restore, private credentials,
real profiling/application parity/reconciliation, hosted role/pooler performance,
capacity and recovery. Production auth/authorization/monitoring, final fresh target,
write freeze/provider hold and preservation/recovery of post-cutover writes remain
cutover blockers. Existing production Supabase guard stays enabled.
