# Progress and evidence ledger

This is the single index for dated implementation, CI and production release
evidence. Current operations belong in the [runbook](../database-migration.md),
next scope in the [roadmap](roadmap.md), and commands in [verification](verification.md).
Historical counts/claims retain their original scope; this docs cleanup does not
independently rerun or recertify every old release.

## Latest production release

PR92 `fe125bb`, deployment `dpl_89Qu62n7m5EFNstxJRfWCjTqXWKQ`, is live. Its
application-only release preserved text session IDs and kept app/LINE open. A
fresh private53-table checkpoint restored all15 metadata sections, configuration
and the bill sequence's exact value/`is_called`. Prior/new actual-source reads
matched on all23 adapters and HTTP edit tokens. Six live API reads, pages and
idempotency/LINE signature guards passed; no access link was created.

The owner then approved a separate30-minute user-state conversion and confirmed
all writers/jobs paused and pending work accounted for. The full frozen state
matched recovery, and the exact locally rehearsed forward preserved all53 tables,
records/revisions/configuration and existing bill identity/sequence state. New
session sequence high-water/narrow grants and six API comparisons passed. Only
the temporary fence was removed; browser/LINE reopening and original controls
were verified, with no error/fatal function groups in the checked window. This is
retained private operator evidence, not a public hosted-write canary.

Both bill and session IDs are now bigint identity, with API string IDs retained.
Current source work prepares the coupled item/reference compatibility stage and
operator SQL only; production is unchanged by that implementation.

### Coupled item/reference compatibility: local acceptance

The focused implementation supports text/bigint item allocation and an explicit
nullable reference mapping without changing public string IDs or creation-order
ties. Six current unit checks and12 PostgreSQL checks passed on a fresh synthetic
copy with the already released bill/session identities. They exercise both column
conversions and exact inverse, the original validated deferred/restrict FK,
parent/reference/NULL preservation, real Orders/Movements HTTP JSON and edit-token
parity, guard refusals/late rollback, lost-COMMIT replay, stale handles, direct
parallel inserts, deleted-ID high-water and values beyond2^53. Actual LINE product
image creation/redelivery retained one upload/item. The existing five media/LINE
checks also passed on the converted pair, and an actual logical restore preserved
all three sequence states, including unused reservations, plus rows/FK/grants.
The full historical/current regression and type witnesses passed. These are
local/CI preparations; no production schema, data, routing or permissions changed.

### User-state identity compatibility: local acceptance

The next focused change prepares `user_state.id` only, with async sequence
reservation for LINE order/movement sessions and no allocation on read-only
snapshots. Five current unit checks and12 real PostgreSQL checks passed on fresh
synthetic copies, including text-layout creation, the already released bill
identity, forward/inverse, guard refusals, retry after lost COMMIT, existing
movement resume/completion, stale handles, parallel inserts and string precision
beyond2^53. The existing five media/LINE acceptance tests passed again on bigint
sessions, including order-image and movement-photo redelivery with fake providers.
A real logical restore preserved both sequence states, unused reservations and
narrow grants. The full historical/current regression and type witnesses passed.
Hosted app/schema/traffic remain unchanged by this implementation; CI and release
approval are separate gates. No real provider or production write was performed.

### Previous application preparation and initial rollback


Current production is [PR90](https://github.com/volkswg/stock-management/pull/90),
source `f7f50b20073e3cb7112cb9947066ae7d1cfcf41d`, deployment
`dpl_B7oHWkjUqN9EsPmuAeRbjeMM8QtD` (2026-11-20). The application release passed
fresh53-table recovery/strict restore, five staged API comparisons, live API/page
and request-guard checks. Deployment-only temporary access was revoked and its
link/cookie denied. LINE stayed open; no live schema conversion was in deployment.

The subsequent supervised identity conversion was applied, then safely reverted
when Orders HTTP acceptance returned503. SQLSTATE42804 identified the shared
edit-revision UNION combining text IDs with the converted bigint bill ID. Earlier
adapter comparisons did not exercise this HTTP wrapper on the converted layout.
The exact reviewed inverse preserved all IDs, rows, revisions and configuration;
all53 tables/all15 metadata sections matched the frozen checkpoint. Six API
comparisons (including bill detail), two pages, client helper and request guards
passed on the restored text schema. Only the maintenance rule was removed and the
system reopened at11:51 Bangkok, inside the30-minute window. No recovery snapshot
was restored over live data; no real provider calls or business canary writes ran.
Recovery and complete execution receipts remain private on the Mac.

Current work corrects only the revision selector to `t.id::text AS id` and adds a
real PostgreSQL HTTP-wrapper regression for unchanged family/record edit tokens
through text→bigint→text transitions. It requires a separately approved application
release and a new maintenance pause before any conversion retry. Production remains
on the original text ID schema; retained SQL is not authorization to retry now.

[PR89](https://github.com/volkswg/stock-management/pull/89) previously moved private
Loyverse accounts to the unexposed PostgreSQL table, with read-only runtime grants
and token-free metadata reads. Its provider/account behavior remains unchanged.

Local order-bill identity validation (2026-11-20): all703 immutable historical
regressions,18 current source/unit tests and3 importer tests passed. Type checking,
lint (one inherited warning) and credential-free production build passed with the
unchanged route manifest and113 checked client chunks. Fresh synthetic PostgreSQL17
rehearsal passed all seven focused identity groups, the existing actual LINE
bill-image/redelivery case, exact logical all53-table forward/inverse comparisons,
and pg_dump/restore of sequence high-water state beyond retained IDs. Guards refuse
wrong targets/revisions, noncanonical/exhausted IDs, incoming FKs, dependent views,
unreviewed default sequence grants and late failure. Existing app/media/browser
acceptance passed on unchanged final-schema clones. No real provider calls or live
records were used. The first rehearsal exposed the inherited text-only ID CHECK;
the exact forward/inverse now retarget that constraint as part of the conversion.

The preceding PR87/88 source `296529d` introduced native named PostgreSQL adapters
on the existing PR86 schema. That build is not a rollback target after any later
identity conversion; use the reviewed dual-layout release or approved inverse.

The preceding production schema release was [PR86](https://github.com/volkswg/stock-management/pull/86)
`a1a27af691ebf67d9575476c43a4d9cc30b36470`, deployment
`dpl_8kpVmSzrPBbLRRGzVzwibNwnKxUk`. The separately approved 2026-11-19 window
completed archive/deletion consolidation on all23 business tables. Full52-table/
15-metadata recovery, exact inverse and69 semantic groups were verified; records,
revisions, media and permissions reconciled. Four API comparisons/two pages and
missing-key/invalid-signature/protected-host guards passed. Only that window's
traffic rule was removed; browser/LINE reopened, error scans clear. Six managed
Storage versioning functions retain Storage's own archived_at; their exact platform
identity/body witness corrected only an overbroad read-only DDL precondition.
No Storage function or DDL/data action was changed. Private execution/correction
receipts remain on the Mac. [CI44440332245](https://github.com/volkswg/stock-management/actions/runs/44440332245)
passed; tested/merged trees matched. This is the retained independently verified
checkpoint, not new live inspection or permission to restore over later writes.

The preceding [PR85](https://github.com/volkswg/stock-management/pull/85) release used
`80db4aeb515fcedb7c9f394b819b96626ca87455` on 2026-11-19. The five
duplicate operational URL columns are gone; media IDs resolve the same API fields.
Fresh private52-table/15-metadata recovery, local forward/inverse and69 app/LINE
comparison groups were verified. Frozen production retained all rows, IDs, row/global
revisions, timestamps, media and permissions across retirement. The exact staged
build was promoted, read-only HTTP/security checks passed, the temporary block was
removed and browser/LINE reopened; deployment-scoped error scans were clear.
[CI run44371786156](https://github.com/volkswg/stock-management/actions/runs/44371786156)
passed on head `5208879`; merge and tested trees matched. Checkpoints and full
receipts remain private on the Mac. They are not permission to overwrite later writes.

The preceding media catalog release was [PR84](https://github.com/volkswg/stock-management/pull/84)
`44bb1d65116f0ee370a50fd514922c47ea6f6efb`, including its media schema. In a
separately approved supervised window, fresh private recovery strictly restored
all51 tables/15 metadata sections, the backfill/inverse and69 app/LINE groups
passed locally, and the full frozen checkpoint matched before DDL. All51 predecessor
tables retained their business values/row revisions/timestamps and existing security;
only the global counter advanced five statements. All five mappings and the52-table
layout verified. The exact staged build was promoted, four API payload/order/scoped
header comparisons and two pages passed, and missing-key/invalid-signature/old-host
guards were preserved. Only that window's traffic rule was removed; browser writes
and LINE reopened. Initial/final deployment-scoped error/fatal counts were zero.
No real provider/business write canary was submitted. Private checkpoints/full
receipts remain on the Mac; they predate subsequent legitimate writes. Independent
[CI run44323943626](https://github.com/volkswg/stock-management/actions/runs/44323943626)
passed on head `1acefc0`; merged and tested trees matched.

PR81 below remains the earlier schema-only checkpoint, not the current schema.

PR81 merged as `2471ac1106a9501f2a084b2d0825572b1b6fb1fe`; its schema-only release
completed on 2026-11-18 in the separately approved supervised window. Production
remained on PR80 application source `31af820cbe47a543805c0904ca3db6ad3b2ec085`
at that schema-only checkpoint. No app deployment or environment change was
needed for PR81; PR83 was separately released later. The exact forward SQL is
[`20261118100705_constraint_record_validation.sql`](../../tools/migration/final-removal/20261118100705_constraint_record_validation.sql).

| Evidence | Recorded result and scope |
| --- | --- |
| Local implementation | 689 regressions, 73 Python tests, lint/typecheck and credential-free build passed; inherited `shipmentRow` lint warning remained |
| Current-schema synthetic acceptance | Five focused cases across 23 tables/47 timestamp fields, 32 operational cases, 10 native timestamp cases and actual browser lost-response/reload/replay passed; no real providers |
| Independent CI | [Migration acceptance run 44284111971](https://github.com/volkswg/stock-management/actions/runs/44284111971) passed on tested head `4db4799c284e5bc5a15c0484b6ec041ea584b6cf`; merged tree matched |
| Recovery | Fresh private checkpoint strictly restored: all 51 tables and 15 metadata sections matched; exact schema-only inverse restored the original state locally |
| App/LINE checkpoint rehearsal | 69 actual-consumer comparison groups matched; local create/edit/archive passed without hosted/provider access |
| Frozen production | Complete checkpoint matched before DDL; after DDL all 51 table values and surviving metadata/permissions matched except the reviewed schema delta |
| Schema result | 23 validated CHECKs cover 47 lifecycle fields; 23 validators became one shared guard; operational functions 74→52; operational triggers remain 46 |
| Hosted read/security checks | Four GET values/types/order/revisions matched; idempotency guards and LINE signature rejection passed; no real business/provider write canary |
| Reopening | Only the temporary rule was removed; original protections, LINE cutoff, deployment/env and old Sheets permissions were preserved; initial runtime error scan was clear |

Vercel's publication version/timestamp changed with the approved maintenance rule;
the gate verified them against that exact active configuration. No schema SQL ran
before resolving that metadata-only precondition. Private records, credentials,
checkpoints, inverse SQL and full receipts remain on the Mac/approved private storage.
The checkpoint predates later legitimate writes and is not permission to overwrite them.

## Native PostgreSQL business adapters (2026-11-19; current source work)

Owner selected PostgreSQL-only business storage, retaining Google Drive uploads
and the private integration-account configuration. Seven features/23 tables now
use explicit named column maps and semantic port adapters. The active business
Sheets registry, classes/headers, positional/raw-row facades and range-based PG
bridge are removed. No schema/operator SQL is added or executed. Existing strict
PG identity/TLS/role checks, journals, scoped revisions, LINE signatures/cutoff,
upload reconciliation and public route/DTO behavior remain.

Historical source/type tests run unchanged in an independently hash-pinned
pre-native source copy. Current physical graphs, typed owners, build and real
PostgreSQL acceptance run separately; historical success is not current acceptance.
Current PG fixtures revoke legacy input/project execution and exercise all23 named
projections, seven modules, precision/order, retries, rollback, both LINE image
flows and browser response-loss/reload/replay. Local verification passed:703 immutable predecessor regressions/type witnesses,
5 current physical/behavior/graph checks,37 current PostgreSQL cases across four
fresh final-schema copies, lint (only the inherited unused shipmentRow warning),
current typecheck and a credential-free build. The unchanged route manifest and
113 client chunks were checked; no private database strings were bundled.
The inherited typed/operator/schema/inverse suite also passed independently. Production remains PR86; merge/deploy need owner approval.

## deletedAt consolidation (2026-11-19; local implementation)

From PR85 `80db4ae`, prepared one scoped app/operator release replacing the23
operational `archived_at` fields with native `deletedAt`. Seventeen columns are
renamed; six overlapping fields merge only non-conflicting instants. Different
non-NULL timestamps, unknown dependencies, stale/wrong targets and function drift
abort atomically. Records/media/IDs/payloads, row/global revisions, original business
timestamps and existing permissions survive. The seven append-only runtime tables
remain append-only. Soft-deleted rows are hidden from reads and protected from
edits/resurrection; cancellation/status rules and external Sheets/API contracts stay
unchanged. No file or child-row cascade is introduced.

The compatible adapter validates capability per transaction and supports the
existing layout before approved DDL. The operator file stays outside automatic
migration discovery. A private deletion-state export permits exact inverse before
reopening; it refuses after any later write. Recovery must retain the original
six-table timestamps, not infer which legacy field held them. Re-added archive
columns may have different physical slots. The [runbook](../database-migration.md#deletedat-soft-delete-consolidation-prepared-production-unchanged)
defines the separate production release approval and fresh checkpoint gates.

Local evidence:703 Node regressions,75 Python checks, lint/typecheck and the
credential-free production build pass (unchanged route manifest and113 client
chunks; only the inherited `shipmentRow` lint warning). Fresh synthetic PostgreSQL
copies pass all52-table normalized-value/global/row-revision preservation and the
exact inverse/security comparison. Six focused cases cover all23 deletion paths,
unchanged append-only restrictions, direct-editor deletion, Expense save/delete,
cost-override replacement, numeric LINE session IDs and partial-schema refusal.
The final layout also passes six media/upload uncertainty/replay cases, both actual
LINE image workflows and real Chrome lost-response/reload/replay acceptance.
Earlier typed/shared-guard/media acceptance passed and was reused while correcting
synthetic fixture setup. Every provider was fake. No production records, fresh
Sheets data, credentials, traffic, Vercel settings or hosted schema were accessed or
changed for this implementation. Full local logs stay private on the Mac; CI belongs
to the review PR. Merge, deployment and live schema execution are not yet approved.

## Media URL retirement (2026-11-19; local implementation)

From PR84 merge `44bb1d6`, the owner approved using `media.sourceUrl` for all five
references, including normalization of different Drive URL formats for one file.
API field names, files, Drive permissions, Sheets headers and feature workflows
remain. PostgreSQL feature bindings explicitly write media IDs; private mappers
resolve canonical URL DTOs. The Order thumbnail/preview formatters now recognize
the catalog's open/uc/thumbnail Drive aliases as well as file/d links, so choosing
a catalog URL does not replace an image with a Drive HTML page. External URLs keep
their existing handling. No new React state/effects or provider dependencies were added.

The one review scope includes guarded compatibility, five-column retirement and a
column-restoring inverse outside automatic migration discovery. All52 tables match
across retirement after excluding only the five operational URL fields; retained
import columns remain part of the proof. Records/IDs/media/row revisions/timestamps,
commands/global counter, grants/policies and other schema stay exact. The inverse
retains all prior non-URL values and metadata permissions; its five backfill statements
advance only the global counter by five. It reconstructs canonical URLs rather than
historical aliases and may leave different physical column slots. Neither phase
deletes files or restores a stale snapshot. Missing approval, wrong/stale target,
limited-reader grants, unknown dependencies and late interrupted DDL are refused
with exact prior fingerprints. Missing helpers/FKs and partial schemas fail closed.

Local results:700 regressions,75 Python checks, lint/typecheck and a credential-free
build pass; only the inherited `shipmentRow` warning remains. The route manifest
and113 client bundle boundaries match. Fresh synthetic PostgreSQL copies pass six
focused cases in each of retained/final/inverse layouts, two prior-PR84 runtime
upload/replay checks, both actual LINE image workflows,32 operational cases and
actual Chrome lost-response/reload/replay. Gallery formatter and existing interaction
checks pass. All provider adapters are fake; no hosted data, credentials, production
settings/traffic, real providers or business snapshots were used by these checks.
Original historical fixtures remain unchanged behind a separate hash-bound inverse.
CI results belong to the review PR; these are local results. Production remains at
the separately verified PR84 checkpoint until a later explicit release approval.

## Concurrent browser edits (2026-11-18)

Implementation from `d00f94b`, subsequently merged and deployed as PR83; see the
[production release receipt](#pr83-production-release-2026-11-18). A single browser-wide `stock-v2` token was checked
against the database-wide counter, so an Order save incorrectly invalidated a
Movement edit. This is application precondition scope, not a PostgreSQL inability
to handle multiple users.

The composition wrapper adds opaque `stock-edit-v1` headers for Orders and
Movements using their trigger-owned record revisions and explicit child/link
relationships. Browser callers send the token for the record they viewed. Exact
detail scopes allow independent records to save; collection-only views retain a
conservative family scope. Same-record/related-child changes still return 409;
there is no automatic retry, refresh/rebase or silent merge. Other features and
older clients retain the strict legacy global precondition.

Pending browser operations retain their original key **and** view precondition
through lost responses and reloads. Confirmed pre-handler revision conflicts can
end that rejected intent; uncertain uploads/commits keep their identity. Old
key-only pending edits require operator reconciliation, not a new guessed token.
Order creation prefers the Orders collection header while preserving its existing
explicit key and Sheets-compatible fallback. Server idempotency, writer locks,
row CAS, signatures, permissions and response DTOs remain unchanged.

Local evidence: 29 focused client cases and eight fresh-final-schema concurrency
cases pass, including two real isolated Chrome sessions, both save orders and
simultaneous saves, same-record rejection, child/direct-edit invalidation, scoped
upload rejection before effect work and completed-command replay after later
writes. All 695 regressions, lint and typecheck pass; only the inherited unused
`shipmentRow` lint warning remains. The credential-free build matches the route
manifest and checks all 113 client chunks without database strings. The full
current-schema verifier also passes operational, native timestamp, LINE and
browser acceptance on independent synthetic copies. The archived-schema source
copy passes its exact hash/credential exclusions; independent CI runs the full
historical schema suite.

Release needs normal app deployment after merge approval; no database migration,
configuration change or business-data import. Existing tabs need a reload to use
scoped tokens; legacy tabs remain conservative. Preserve uncertain operation
references and reconcile old pending edits before retrying. Live providers and
concurrent direct-owner edits during an application transaction are not certified
by these synthetic tests. Broader feature scopes/conflict UX remain separate work.

## Media catalog compatibility (2026-11-18)

Local implementation from PR83 merge `097b310`, subsequently merged and released
as PR84; see the current production receipt above. The revision table and all old URL fields remain. The new catalog has
exactly eleven approved fields, five nullable indexed restrictive foreign keys and
no checksum/status columns. Browser and LINE provider results enrich confirmed
metadata inside the existing command transaction; uncertainty remains journal-owned.

Fresh synthetic final-schema acceptance passes thirteen focused media cases,
32 existing operational cases, actual Chrome response-loss/reload/replay and an
actual post-inverse upload/save. These cover all five reference paths, Drive alias
reuse, long/external URLs, ID/URL edits and conflicts, hard/soft deletion refusal,
archived references, browser metadata, both LINE order and movement photos,
redelivery, known rollback cleanup, upload uncertainty, partial-schema refusal and
full-versus-limited reader access. All provider adapters are fake; no hosted writes
or real provider events are evidence from this run.

The forward/inverse proof compares all 51 predecessor tables: existing business
values, row revisions and timestamps match; the global counter advances exactly
five statements. Old schema/security/guard entries survive verbatim and the
schema-only inverse restores original metadata. Recovery explicitly includes the
52nd table; the old profile refuses the new layout. All 697 regressions, 75 Python
checks, lint and typecheck pass; the only lint warning is the inherited unused
`shipmentRow`. The credential-free build passes with an unchanged route manifest
and all 113 client chunks checked for private database strings. Independent CI and the separately approved production release subsequently passed;
the receipt above records their actual scope and limits.

## PR83 production release (2026-11-18)

The owner approved merge and then deployment separately. PR83 merged as
`097b310d9f70628d04101f17e43297ad4cac0478` after
[CI run 44308930535](https://github.com/volkswg/stock-management/actions/runs/44308930535)
passed on `3646e8f1a25a5869c04e2e4d758fc4fc4b047a4d`; merged/runtime trees matched.
Protected production build `dpl_7vaNUZd1fh8tfhG2vaM7MSfSQDpA` was promoted to the
existing live domain. Seven live read/guard checks passed: Orders/Movements pages,
API HEAD scoped/legacy headers, exact browser helper, missing-key rejection and
invalid LINE signature rejection. Initial deployment-scoped error/fatal scan was
clear. Only the exact source-commit binding changed; other environment/protection,
LINE cutoff and database settings stayed exact. No schema/business write/provider
canary, share link, bypass, new auth or paid resource was introduced. Private receipts
remain on the Mac. The earlier PR81 schema checkpoint above is retained as history.

## Documentation consolidation (2026-11-18)

From base `2471ac1106a9501f2a084b2d0825572b1b6fb1fe`, the docs directory goes
14→13 files and becomes about 80% shorter. Current operations, next work, commands
and dated evidence have one canonical owner each. All original folder/dependency
rules, the earlier merge-SHA ledger and immutable witnesses remain; feature-guide
bodies retain their established paths with a production-backend clarification.
The history index records both renamed paths and historical URL tradeoffs.

Local verification: all 928 non-Markdown tracked files are byte-identical; local
links/fragments and pinned historical files/anchors pass. All 689 regressions,
lint/typecheck and an isolated credential-free build pass; only the inherited
`shipmentRow` warning remains. Route manifest and 113 browser bundle boundaries
are unchanged. No database/provider tests were added for prose edits, and no live
resource, credential, snapshot or recovery artifact was changed. These are local
docs-review results, not a new CI or production verification claim.

## Database milestone index

| PRs | Delivered scope | Detailed recorded evidence |
| --- | --- | --- |
| 48–56 | Import/operational foundation, representation/reference corrections, profiling and reconciliation | [Original migration record](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#source-audit-and-schema) |
| 57–60 | Audit removal, recovery and private read-only staging | [Original execution ledger](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#hosted-audit-removal--applied-and-verified-2026-11-11) |
| 61–65 | Disposable writes/capacity, retry fixes, hosted acceptance and cutover preparation | [Original acceptance ledger](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#local-acceptance-milestone-results-2026-11-12) |
| 66–70 | Production reader correction/cutover follow-through, direct remark edits, LINE cutoff, order idempotency and upload failure feedback | [Original production follow-through](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#order-remark-table-editor-fix--2026-11-16) |
| 71–72 | Named-column compatibility and final `business_cells` removal | [Original authority contract](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#named-column-authority-release-prepared-production-execution-not-authorized) |
| 73–74 | Stable-ID/createdAt compatibility and ordinal retirement | [Original stable-ID evidence](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#stable-id-compatibility-implementation-2026-11-17-pr73-released) |
| 75 | Native lifecycle timestamps | [Completed timestamp release](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#native-lifecycle-timestamp-release-completed-2026-11-17-pr75) |
| 76–77 | Explicit per-column compatibility and final `cell_kinds` retirement | [Completed kind retirement](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#pr77-final-retirement-completed-lexeme-compatibility-preparation-2026-11-18) |
| 78–79 | Typed compatibility and final lexeme retirement | [Completed lexeme retirement](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#pr79-final-lexeme-retirement-completed) |
| 80 | Typed-only app; 116 legacy functions retired in the later approved release | [PR80 contract and release record](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#typed-postgresql-cleanup-prepared-not-deployed) |
| 81 | CHECK constraints/shared guard; separate production SQL completed | [Latest release above](#latest-production-release), [review PR81](https://github.com/volkswg/stock-management/pull/81) |

The full historical record retains intermediate failures, owner deferrals and
unexecuted plans. A heading saying “prepared” or “Sheets production” describes that
earlier stage, not the current state. Backup automation and new auth remain deferred.

## Merged implementation ledger

The original architecture ledger below retains exact merge SHAs and original
Codex-local test counts, including inherited tests. It is not a fresh independent
CI/production claim. Later milestone detail is in the immutable index below.


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
| [audit.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/audit.md) | [Current map](../architecture/migration-map.md), [dependency rules](../architecture/rules.md#dependency-rules) and [roadmap](roadmap.md); original snapshot only in history |
| [dependency-rules.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/dependency-rules.md) | [Dependency rules](../architecture/rules.md#dependency-rules) |
| [eslint-boundaries.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/eslint-boundaries.md) | [Scoped enforcement](../architecture/rules.md#scoped-enforcement) |
| [folder-rules.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/folder-rules.md) | [Folder rules](../architecture/rules.md#folder-ownership) |
| [google-shared-infrastructure.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/google-shared-infrastructure.md) | [Shared transport](../architecture/decisions.md#shared-google-transport-and-feature-worksheets), [map](../architecture/migration-map.md) |
| [inventory-employee-directory.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/inventory-employee-directory.md) | [Directory prerequisite](../architecture/decisions.md#inventory-employee-directory-prerequisite), [completed HR ownership](../architecture/migration-map.md) |
| [migration-map.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/migration-map.md) | [Current ownership map](../architecture/migration-map.md); original whole-repository proposed paths in history |
| [orders-contracts.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/orders-contracts.md) | [Public contracts](../architecture/decisions.md#public-contracts-and-single-enum-identity) |
| [orders-detail-shipment-projection.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/orders-detail-shipment-projection.md) | [Detail projection](../architecture/decisions.md#orders-detail-and-shipment-projection) |
| [orders-sheet-type-imports.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/orders-sheet-type-imports.md) | [Shared transport/worksheet boundary](../architecture/decisions.md#shared-google-transport-and-feature-worksheets) |
| [orders-shipment-picker.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/orders-shipment-picker.md) | [Browser picker](../architecture/decisions.md#orders-browser-picker-and-ui) |
| [orders-shipments-worksheet-ownership.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/orders-shipments-worksheet-ownership.md) | [Actual worksheet owners](../architecture/migration-map.md#physical-worksheet-owners) |
| [orders-ui-migration.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/orders-ui-migration.md) | [Folders](../architecture/rules.md#folder-ownership) and [UI/picker](../architecture/decisions.md#orders-browser-picker-and-ui) |
| [orders-use-case-seam.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/orders-use-case-seam.md) | [Orders list/creation](../architecture/decisions.md#orders-list-and-simple-creation) |
| [refactoring-plan.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/refactoring-plan.md) | [Single roadmap](roadmap.md) and merged ledger above |
| [sales-worksheet-ownership.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/sales-worksheet-ownership.md) | [Actual worksheet owners](../architecture/migration-map.md#physical-worksheet-owners), [pending Sales work](roadmap.md) |
| [shipments-contracts.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/shipments-contracts.md) | [Contracts/enum](../architecture/decisions.md#public-contracts-and-single-enum-identity) |
| [shipments-create-seam.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/shipments-create-seam.md) | [Shipment creation](../architecture/decisions.md#shipment-creation) |
| [shipments-drive-seam.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/shipments-drive-seam.md) | [Bill upload/cleanup](../architecture/decisions.md#shipping-bill-upload-and-cleanup) |
| [shipments-dto-ownership.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/shipments-dto-ownership.md) | [Contracts/DTO ownership](../architecture/decisions.md#public-contracts-and-single-enum-identity) |
| [shipments-enum-ownership.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/shipments-enum-ownership.md) | [Contracts/enum identity](../architecture/decisions.md#public-contracts-and-single-enum-identity) |
| [shipments-http-boundary.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/shipments-http-boundary.md) | [Public server surfaces](../architecture/rules.md#actual-public-surfaces-and-directions), historical import restoration above |
| [shipments-link-seam.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/shipments-link-seam.md) | [Linking](../architecture/decisions.md#shipment-order-linking) |
| [shipments-read-seam.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/shipments-read-seam.md) | [Shipment reads/costs](../architecture/decisions.md#shipment-list-and-detail-reads) |
| [shipments-status-seam.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/shipments-status-seam.md) | [Status update](../architecture/decisions.md#shipment-status-update) |
| [shipments-ui-relocation.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/shipments-ui-relocation.md) | [UI/picker](../architecture/decisions.md#orders-browser-picker-and-ui), [actual map](../architecture/migration-map.md) |
| [shipments-validation-import.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/shipments-validation-import.md) | [Public surfaces](../architecture/rules.md#actual-public-surfaces-and-directions), historical witness above |
| [verification.md](https://github.com/volkswg/stock-management/blob/71dcfe145a4ae835dbd693b2ba6dce00d4e3edcb/docs/architecture/verification.md) | [Safe procedure/current results](verification.md) and original ledger evidence above |

Retained operational/user guides: [expenses](../expenses.md), [movement migration](../movement-migration.md), [LINE rich-menu links](../rich-menu-links.md), [shop stock adjustments](../shop-stock-adjustments.md). Root README retains the existing movement-mode and salary-advance/settlement guidance. These are instructions for separately authorized operations, **not** verification commands.


## Historical document index

All full versions below are pinned to pre-cleanup commit
`2471ac1106a9501f2a084b2d0825572b1b6fb1fe`. No historical fixture, SQL, report content
or private evidence was rewritten. These links replace repeated narrative, and
retain earlier stopped attempts and safeguards alongside passing results.

| Previous document | Current destination | Immutable complete version |
| --- | --- | --- |
| `database-migration.md` | Current [production runbook](../database-migration.md); dated history here | [Full migration record](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md) |
| `refactoring/progress.md` | This single evidence ledger | [Full prior ledger](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md) |
| `refactoring/verification.md` | [Commands/limits](verification.md); dated result index below | [Full prior verification results](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/verification.md) |
| `architecture/folder-rules.md` | [Combined rules](../architecture/rules.md#folder-ownership), all original rule text retained | [Original ownership guide](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/architecture/folder-rules.md) |
| `architecture/dependency-rules.md` | [Combined rules](../architecture/rules.md#dependency-rules), all original rule text retained | [Original dependency guide](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/architecture/dependency-rules.md) |

Branch-relative historical URLs in already-published PRs cannot be redirected by
Markdown alone. The immutable links here preserve their exact content; in-repo
links are updated to current sections or these pinned sources. Keep historical
fixture strings and existing PR discussions intact.

The old November 12 go/no-go fragment was inside a malformed historical code fence.
Its [exact source-view location](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md?plain=1#L920)
replaces that inherited broken anchor without rewriting the archived record.

### Migration history

| Original section | Immutable evidence |
| --- | --- |
| Google Sheets → PostgreSQL migration | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#google-sheets--postgresql-migration) |
| Source audit and schema | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#source-audit-and-schema) |
| Export, dry run and import | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#export-dry-run-and-import) |
| Backup, restore and rollback | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#backup-restore-and-rollback) |
| Hosting, limits and remaining acceptance gates | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#hosting-limits-and-remaining-acceptance-gates) |
| Implementation acceptance evidence (local, 2026-11-08) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#implementation-acceptance-evidence-local-2026-11-08) |
| Audit-history removal (applied to hosted staging) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#audit-history-removal-applied-to-hosted-staging) |
| Phase 2 operational storage (opt-in isolated testing) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#phase-2-operational-storage-opt-in-isolated-testing) |
| Isolated server configuration | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#isolated-server-configuration) |
| Command identity and concurrent writes | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#command-identity-and-concurrent-writes) |
| Offline profiling and promotion | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#offline-profiling-and-promotion) |
| Verification and capacity | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#verification-and-capacity) |
| Production cutover and rollback prerequisites | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#production-cutover-and-rollback-prerequisites) |
| Phase 3: real data validation and controlled cutover | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#phase-3-real-data-validation-and-controlled-cutover) |
| Current execution record and reproducible preparation | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#current-execution-record-and-reproducible-preparation) |
| Gate 0 — authority, isolation and release prerequisites | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#gate-0--authority-isolation-and-release-prerequisites) |
| Gate 1 — secure artifact handling and read-only export | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#gate-1--secure-artifact-handling-and-read-only-export) |
| Gate 2 — offline profiling and source compatibility | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#gate-2--offline-profiling-and-source-compatibility) |
| Gate 3 — isolated hosted deployment, import and reconciliation | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#gate-3--isolated-hosted-deployment-import-and-reconciliation) |
| Gate 4 — capacity, region and query performance | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#gate-4--capacity-region-and-query-performance) |
| Gate 5 — authorization, browser/API and business acceptance | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#gate-5--authorization-browserapi-and-business-acceptance) |
| Private read-only preview evidence before PR #60 merge (2026-11-11) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#private-read-only-preview-evidence-before-pr-60-merge-2026-11-11) |
| Disposable staging write-testing plan | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#disposable-staging-write-testing-plan) |
| Current migration go/no-go assessment (2026-11-12) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#current-migration-gono-go-assessment-2026-11-12) |
| Executable production cutover runbook | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#executable-production-cutover-runbook) |
| Final write-freeze and LINE producer-pause procedure (2026-11-14) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#final-write-freeze-and-line-producer-pause-procedure-2026-11-14) |
| Maintenance preparation and exact reader blocker (2026-11-16) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#maintenance-preparation-and-exact-reader-blocker-2026-11-16) |
| Full resync verified; Sheets and LINE reopened (2026-11-15) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#full-resync-verified-sheets-and-line-reopened-2026-11-15) |
| Fastest refresh path: requested reuse of existing candidate (2026-11-15) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#fastest-refresh-path-requested-reuse-of-existing-candidate-2026-11-15) |
| Read-only continuation checkpoint (2026-11-15) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#read-only-continuation-checkpoint-2026-11-15) |
| Normal Sheets/LINE operation restored (2026-11-15) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#normal-sheetsline-operation-restored-2026-11-15) |
| Production deployment checks and LINE block (2026-11-15 Bangkok) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#production-deployment-checks-and-line-block-2026-11-15-bangkok) |
| Completed browser-only synchronization and checks (2026-11-14 UTC) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#completed-browser-only-synchronization-and-checks-2026-11-14-utc) |
| Bounded local capacity continuation (2026-11-12) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#bounded-local-capacity-continuation-2026-11-12) |
| Local acceptance milestone results | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#local-acceptance-milestone-results) |
| Next hosted and production stage plan | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#next-hosted-and-production-stage-plan) |
| Hosted Supabase test target and execution packet (2026-11-12) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#hosted-supabase-test-target-and-execution-packet-2026-11-12) |
| Image retry fix and two fresh implemented reruns (2026-11-11) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#image-retry-fix-and-two-fresh-implemented-reruns-2026-11-11) |
| Local completion started: raw-image intent failure (2026-11-11) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#local-completion-started-raw-image-intent-failure-2026-11-11) |
| Remaining local coverage and capacity completion plan (prepared only) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#remaining-local-coverage-and-capacity-completion-plan-prepared-only) |
| Cost-override deletion fix and two local reruns (2026-11-11) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#cost-override-deletion-fix-and-two-local-reruns-2026-11-11) |
| Receipt-overlap fix and local rerun (2026-11-11) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#receipt-overlap-fix-and-local-rerun-2026-11-11) |
| Local execution result (2026-11-11) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#local-execution-result-2026-11-11) |
| Scope and target selection | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#scope-and-target-selection) |
| Entry gates — all required before the first test write | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#entry-gates--all-required-before-the-first-test-write) |
| Test data, runner and comparison rules | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#test-data-runner-and-comparison-rules) |
| Mandatory acceptance matrix | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#mandatory-acceptance-matrix) |
| Performance and recovery acceptance limits | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#performance-and-recovery-acceptance-limits) |
| Evidence, stop rules and completion | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#evidence-stop-rules-and-completion) |
| Gate 6 — backup/restore and recovery sign-off | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#gate-6--backuprestore-and-recovery-sign-off) |
| Gate 7 — final freeze and delta review (separate cutover approval) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#gate-7--final-freeze-and-delta-review-separate-cutover-approval) |
| Gate 8 — controlled activation, monitoring and rollback | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#gate-8--controlled-activation-monitoring-and-rollback) |
| Automation and acceptance evidence handoff | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#automation-and-acceptance-evidence-handoff) |
| Direct order remark editing (2026-11-16) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#direct-order-remark-editing-2026-11-16) |
| LINE cutoff release and scheduler audit (2026-11-16) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#line-cutoff-release-and-scheduler-audit-2026-11-16) |
| Order creation request identity repair (2026-11-16) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#order-creation-request-identity-repair-2026-11-16) |
| LINE movement image failure feedback (2026-11-17) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#line-movement-image-failure-feedback-2026-11-17) |
| Named-column authority release (prepared; production execution not authorized) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#named-column-authority-release-prepared-production-execution-not-authorized) |
| Mapping and representation | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#mapping-and-representation) |
| Dependency inventory and current tooling | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#dependency-inventory-and-current-tooling) |
| Maintenance sequence and writer contract | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#maintenance-sequence-and-writer-contract) |
| Final removal approval gate | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#final-removal-approval-gate) |
| Stable-ID compatibility stage (2026-11-17; deployed) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#stable-id-compatibility-stage-2026-11-17-deployed) |
| Validation and later deployment requirements | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#validation-and-later-deployment-requirements) |
| row_order retirement implementation (not deployed) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#row_order-retirement-implementation-not-deployed) |
| One release, two explicit operator steps | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#one-release-two-explicit-operator-steps) |
| Local acceptance and rollback boundaries | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#local-acceptance-and-rollback-boundaries) |
| Explicit historical anchor | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#native-lifecycle-timestamps-prepared-not-deployed) |
| Native lifecycle timestamps (released; PR75) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#native-lifecycle-timestamps-released-pr75) |
| Explicit historical anchor | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#separate-production-release-approval) |
| Recorded release procedure; fresh approval required for reuse | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#recorded-release-procedure-fresh-approval-required-for-reuse) |
| Explicit historical anchor | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#cell_kinds-removal-plan-planning-only-production-unchanged) |
| cell_kinds removal (compatibility prepared; production unchanged) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#cell_kinds-removal-compatibility-prepared-production-unchanged) |
| Objective, baseline and scope | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#objective-baseline-and-scope) |
| What depends on it | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#what-depends-on-it) |
| Per-column mapping contract | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#per-column-mapping-contract) |
| Stages and deliverables | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#stages-and-deliverables) |
| Mandatory pass/fail evidence | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#mandatory-passfail-evidence) |
| Hard decisions and rollback boundaries | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#hard-decisions-and-rollback-boundaries) |
| Explicit historical anchor | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#implemented-compatibility-stage-not-deployed) |
| Compatibility stage — released in PR76 | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#compatibility-stage--released-in-pr76) |
| Final cell_kinds retirement (prepared, not deployed) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#final-cell_kinds-retirement-prepared-not-deployed) |
| Explicit optional-tail decisions | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#explicit-optional-tail-decisions) |
| Acceptance and execution gates | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#acceptance-and-execution-gates) |
| Explicit historical anchor | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#lexeme-compatibility-prepared-not-deployed) |
| Lexeme compatibility (PR78 released) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#lexeme-compatibility-pr78-released) |
| Explicit typed-candidate transport contracts | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#explicit-typed-candidate-transport-contracts) |
| Separate release gates | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#separate-release-gates) |
| PR78 compatibility release record | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#pr78-compatibility-release-record) |
| Explicit historical anchor | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#final-lexeme-retirement-prepared-not-executed) |
| Required semantics and refusal conditions | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#required-semantics-and-refusal-conditions) |
| Final approval and execution packet | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#final-approval-and-execution-packet) |
| PR79 final lexeme retirement completed | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#pr79-final-lexeme-retirement-completed) |
| Explicit historical anchor | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#typed-postgresql-cleanup-prepared-not-deployed) |
| Typed PostgreSQL cleanup (released as PR80) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#typed-postgresql-cleanup-released-as-pr80) |
| Release and rollback gates | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#release-and-rollback-gates) |
| Row constraints and shared write guard (prepared, not deployed) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/database-migration.md#row-constraints-and-shared-write-guard-prepared-not-deployed) |

### Earlier progress

| Original section | Immutable evidence |
| --- | --- |
| Refactoring progress and evidence | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#refactoring-progress-and-evidence) |
| Maintenance preparation resumed; read-only guard cause proved (2026-11-16) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#maintenance-preparation-resumed-read-only-guard-cause-proved-2026-11-16) |
| Full23 resync verified; original Sheets/LINE reopened (2026-11-15) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#full23-resync-verified-original-sheetsline-reopened-2026-11-15) |
| Existing-candidate refresh proposed; no freeze executed (2026-11-15) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#existing-candidate-refresh-proposed-no-freeze-executed-2026-11-15) |
| Read-only migration checkpoint resumed; execution gates unproved (2026-11-15) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#read-only-migration-checkpoint-resumed-execution-gates-unproved-2026-11-15) |
| Normal Sheets/LINE operation restored (2026-11-15) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#normal-sheetsline-operation-restored-2026-11-15) |
| Production reader checks complete: real report blocker, LINE blocked (2026-11-15) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#production-reader-checks-complete-real-report-blocker-line-blocked-2026-11-15) |
| Final browser-only synchronization and acceptance complete (2026-11-14 UTC) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#final-browser-only-synchronization-and-acceptance-complete-2026-11-14-utc) |
| Final source write-freeze and LINE producer-pause procedure (2026-11-14) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#final-source-write-freeze-and-line-producer-pause-procedure-2026-11-14) |
| Actual private Vercel-to-Supabase read-only smoke passes (2026-11-14) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#actual-private-vercel-to-supabase-read-only-smoke-passes-2026-11-14) |
| Private Vercel test prepared; email verification blocks CLI sign-in (2026-11-13) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#private-vercel-test-prepared-email-verification-blocks-cli-sign-in-2026-11-13) |
| Final candidate connection resolved; deployment guards verified (2026-11-13) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#final-candidate-connection-resolved-deployment-guards-verified-2026-11-13) |
| Final synchronization and deployment checks prepared (2026-11-13) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#final-synchronization-and-deployment-checks-prepared-2026-11-13) |
| Database backup work deferred by owner (2026-11-13) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#database-backup-work-deferred-by-owner-2026-11-13) |
| Final empty production database prepared and verified (2026-11-13) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#final-empty-production-database-prepared-and-verified-2026-11-13) |
| Final Free production candidate created; native handoff pending (2026-11-13) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#final-free-production-candidate-created-native-handoff-pending-2026-11-13) |
| Migration-only essential hosted smoke and executable cutover sequence (2026-11-13) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#migration-only-essential-hosted-smoke-and-executable-cutover-sequence-2026-11-13) |
| Hosted original restore / roles verified; restricted-backup fix (2026-11-13) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#hosted-original-restore--roles-verified-restricted-backup-fix-2026-11-13) |
| Concurrent hosted evidence reads serialized after CI46 failure (2026-11-13) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#concurrent-hosted-evidence-reads-serialized-after-ci46-failure-2026-11-13) |
| Production identity profile implemented locally (2026-11-12) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#production-identity-profile-implemented-locally-2026-11-12) |
| Scope clarification: application as-is; security next (2026-11-12) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#scope-clarification-application-as-is-security-next-2026-11-12) |
| Critical-path cutover mode (2026-11-12) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#critical-path-cutover-mode-2026-11-12) |
| Hosted tooling completed locally — execution disabled (2026-11-12) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#hosted-tooling-completed-locally--execution-disabled-2026-11-12) |
| Hosted adapter foundation — synthetic components only (2026-11-12) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#hosted-adapter-foundation--synthetic-components-only-2026-11-12) |
| Hosted Supabase test target — packet prepared only (2026-11-12) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#hosted-supabase-test-target--packet-prepared-only-2026-11-12) |
| Migration-first scope and bounded capacity continuation (2026-11-12) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#migration-first-scope-and-bounded-capacity-continuation-2026-11-12) |
| Local acceptance milestone results (2026-11-12) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#local-acceptance-milestone-results-2026-11-12) |
| Image retry fixed — two fresh implemented reruns pass (2026-11-11) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#image-retry-fixed--two-fresh-implemented-reruns-pass-2026-11-11) |
| Local completion started — raw-image correctness failure (2026-11-11) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#local-completion-started--raw-image-correctness-failure-2026-11-11) |
| Remaining local coverage/capacity — plan prepared only (2026-11-11) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#remaining-local-coveragecapacity--plan-prepared-only-2026-11-11) |
| Cost-override deletion fix — two implemented local runs pass (2026-11-11) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#cost-override-deletion-fix--two-implemented-local-runs-pass-2026-11-11) |
| Receipt-overlap fix — local rerun stopped at WT12 (2026-11-11) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#receipt-overlap-fix--local-rerun-stopped-at-wt12-2026-11-11) |
| Disposable local write rehearsal — stopped at WT06 (2026-11-11) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#disposable-local-write-rehearsal--stopped-at-wt06-2026-11-11) |
| Private Supabase app — read-only acceptance (2026-11-11) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#private-supabase-app--read-only-acceptance-2026-11-11) |
| Hosted audit removal — applied and verified (2026-11-11) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#hosted-audit-removal--applied-and-verified-2026-11-11) |
| Hosted pre-change recovery — bounded verification fix | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#hosted-pre-change-recovery--bounded-verification-fix) |
| Audit removal — merged implementation and local proof (historical) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#audit-removal--merged-implementation-and-local-proof-historical) |
| Database migration — current operational status (2026-11-11) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#database-migration--current-operational-status-2026-11-11) |
| Historical architecture snapshot and single-workbook account configuration | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#historical-architecture-snapshot-and-single-workbook-account-configuration) |
| Migration assertion performance correction (merged PR #55) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#migration-assertion-performance-correction-merged-pr-55) |
| Historical HR completion evidence (PR #33) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#historical-hr-completion-evidence-pr-33) |
| Merged implementation ledger | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#merged-implementation-ledger) |
| Historical evidence | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#historical-evidence) |
| Document consolidation index | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#document-consolidation-index) |
| Documentation debt and tradeoffs | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#documentation-debt-and-tradeoffs) |
| PR25 — HR core worksheet ownership | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#pr25--hr-core-worksheet-ownership) |
| PR26 — Inventory core worksheet ownership | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#pr26--inventory-core-worksheet-ownership) |
| PR27 — Movement worksheet-schema prerequisite | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#pr27--movement-worksheet-schema-prerequisite) |
| PR28 — Inventory Sales-query dependency prerequisite | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#pr28--inventory-sales-query-dependency-prerequisite) |
| PR29 — LINE user-state worksheet ownership | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#pr29--line-user-state-worksheet-ownership) |
| Sales + Inventory business ownership — completion stack, milestone 1 | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#sales--inventory-business-ownership--completion-stack-milestone-1) |
| Orders + LINE workflows — completion stack, milestone 2 | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#orders--line-workflows--completion-stack-milestone-2) |
| External infrastructure — completion stack, milestone 3 | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#external-infrastructure--completion-stack-milestone-3) |
| Final architecture cleanup — completion stack, milestone 4 | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#final-architecture-cleanup--completion-stack-milestone-4) |
| Database migration preparation (2026-11-08) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#database-migration-preparation-2026-11-08) |
| Phase 2 operational PostgreSQL (2026-11-09, Bangkok) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#phase-2-operational-postgresql-2026-11-09-bangkok) |
| PR49 acceptance review and Phase 3 preparation | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#pr49-acceptance-review-and-phase-3-preparation) |
| Phase 3 real-data migration preparation (2026-11-09) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#phase-3-real-data-migration-preparation-2026-11-09) |
| Order remark Table Editor fix — 2026-11-16 | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#order-remark-table-editor-fix--2026-11-16) |
| LINE migration cutoff release — 2026-11-16 | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#line-migration-cutoff-release--2026-11-16) |
| Order creation idempotency correction — 2026-11-16 | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#order-creation-idempotency-correction--2026-11-16) |
| LINE movement image failure feedback — 2026-11-17 | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#line-movement-image-failure-feedback--2026-11-17) |
| Named-column authority implementation (prepared for review) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#named-column-authority-implementation-prepared-for-review) |
| Stable-ID compatibility implementation (2026-11-17; PR73 released) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#stable-id-compatibility-implementation-2026-11-17-pr73-released) |
| Ordinal retirement implementation (2026-11-17; not deployed) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#ordinal-retirement-implementation-2026-11-17-not-deployed) |
| Native lifecycle timestamp implementation — local preparation | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#native-lifecycle-timestamp-implementation--local-preparation) |
| Native lifecycle timestamp release completed (2026-11-17; PR75) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#native-lifecycle-timestamp-release-completed-2026-11-17-pr75) |
| cell_kinds removal planning (2026-11-17; not implemented) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#cell_kinds-removal-planning-2026-11-17-not-implemented) |
| cell_kinds compatibility implementation (2026-11-17; prepared, not deployed) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#cell_kinds-compatibility-implementation-2026-11-17-prepared-not-deployed) |
| PR76 compatibility release completed; final retirement prepared (2026-11-18) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#pr76-compatibility-release-completed-final-retirement-prepared-2026-11-18) |
| PR77 final retirement completed; lexeme compatibility preparation (2026-11-18) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#pr77-final-retirement-completed-lexeme-compatibility-preparation-2026-11-18) |
| PR78 compatibility released; final lexeme retirement preparation (2026-11-18) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#pr78-compatibility-released-final-lexeme-retirement-preparation-2026-11-18) |
| PR79 removal completed; typed PostgreSQL cleanup prepared (2026-11-18) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#pr79-removal-completed-typed-postgresql-cleanup-prepared-2026-11-18) |
| Row constraints and shared validator implementation (2026-11-18) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md#row-constraints-and-shared-validator-implementation-2026-11-18) |

### Earlier verification results

| Original section | Immutable evidence |
| --- | --- |
| Verification procedure and historical results | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/verification.md#verification-procedure-and-historical-results) |
| Offline checks | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/verification.md#offline-checks) |
| Isolated credential-free production build | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/verification.md#isolated-credential-free-production-build) |
| Compatibility and history gates | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/verification.md#compatibility-and-history-gates) |
| Documentation consolidation results | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/verification.md#documentation-consolidation-results) |
| Limits of evidence | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/verification.md#limits-of-evidence) |
| PR25 HR core worksheet ownership | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/verification.md#pr25-hr-core-worksheet-ownership) |
| PR26 Inventory core worksheet ownership | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/verification.md#pr26-inventory-core-worksheet-ownership) |
| Movement worksheet-schema prerequisite | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/verification.md#movement-worksheet-schema-prerequisite) |
| PR28 Inventory Sales-query dependency prerequisite | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/verification.md#pr28-inventory-sales-query-dependency-prerequisite) |
| PR29 LINE user-state worksheet ownership | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/verification.md#pr29-line-user-state-worksheet-ownership) |
| Remaining worksheet milestone | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/verification.md#remaining-worksheet-milestone) |
| Expenses business milestone | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/verification.md#expenses-business-milestone) |
| HR financial milestone | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/verification.md#hr-financial-milestone) |
| HR application completion | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/verification.md#hr-application-completion) |
| Sales + Inventory business completion | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/verification.md#sales--inventory-business-completion) |
| Orders + LINE workflow completion | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/verification.md#orders--line-workflow-completion) |
| External infrastructure completion | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/verification.md#external-infrastructure-completion) |
| Final architecture cleanup | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/verification.md#final-architecture-cleanup) |
| External namespace retirement (issue #39) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/verification.md#external-namespace-retirement-issue-39) |
| Private Loyverse account source | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/verification.md#private-loyverse-account-source) |
| Feature compatibility retirement | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/verification.md#feature-compatibility-retirement) |
| Loyverse single-workbook support | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/verification.md#loyverse-single-workbook-support) |
| Phase 2 operational storage — isolated verification | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/verification.md#phase-2-operational-storage--isolated-verification) |
| PR49 review acceptance — updated current-source evidence | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/verification.md#pr49-review-acceptance--updated-current-source-evidence) |
| Phase 3 tooling and readiness verification | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/verification.md#phase-3-tooling-and-readiness-verification) |
| Named-column authority — synthetic acceptance (2026-11-16) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/verification.md#named-column-authority--synthetic-acceptance-2026-11-16) |
| Independent merge acceptance (2026-11-17 Asia/Bangkok) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/verification.md#independent-merge-acceptance-2026-11-17-asiabangkok) |
| Stable-ID compatibility verification (2026-11-17; local only) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/verification.md#stable-id-compatibility-verification-2026-11-17-local-only) |
| Ordinal retirement verification (2026-11-17; local) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/verification.md#ordinal-retirement-verification-2026-11-17-local) |
| Native lifecycle timestamps — synthetic evidence | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/verification.md#native-lifecycle-timestamps--synthetic-evidence) |
| cell_kinds compatibility — local synthetic verification (2026-11-17) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/verification.md#cell_kinds-compatibility--local-synthetic-verification-2026-11-17) |
| Explicit historical anchor | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/verification.md#final-cell_kinds-retirement-local-verification) |
| Final cell_kinds retirement — local verification | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/verification.md#final-cell_kinds-retirement--local-verification) |
| Lexeme compatibility — local verification (2026-11-18) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/verification.md#lexeme-compatibility--local-verification-2026-11-18) |
| Final lexeme retirement — local verification (2026-11-18) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/verification.md#final-lexeme-retirement--local-verification-2026-11-18) |
| Typed PostgreSQL cleanup — local verification (2026-11-18) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/verification.md#typed-postgresql-cleanup--local-verification-2026-11-18) |
| Row constraints and shared guard — local verification (2026-11-18) | [Recorded section](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/verification.md#row-constraints-and-shared-guard--local-verification-2026-11-18) |

## Additional pinned source witnesses

These original source/status witnesses retain the recorded revision, not current production state. Their full context is in the [prior ledger](https://github.com/volkswg/stock-management/blob/2471ac1106a9501f2a084b2d0825572b1b6fb1fe/docs/refactoring/progress.md).

- [tools/migration/phase3-status.json at 65ed6f65](https://github.com/volkswg/stock-management/blob/65ed6f65256e59f7f6fce44bcd4fb88a819ae95c/tools/migration/phase3-status.json)
