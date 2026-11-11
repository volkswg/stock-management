# Google Sheets → PostgreSQL migration

Phase 1 provides the immutable import foundation; Phase 2 adds opt-in isolated
operational persistence. Production still uses Google Sheets. Application ports,
business calculations and provider ownership remain unchanged. `stock_migration`
is an unexposed staging schema. Only its database owner
can import; there are no browser, anon, authenticated or service-role grants or RLS
policies. Never expose this schema through the Data API. Application authorization
for production remains a separate release gate. The [progress ledger](refactoring/progress.md#database-migration--current-operational-status-2026-11-11)
records completed isolated real-data work and outstanding recovery/cutover gates.
The Phase 3 runbook below is not authorization to access records, apply hosted
migrations or cut over.

## Source audit and schema

The machine-readable [catalog](../tools/migration/worksheets.json) records all 23
business worksheets, ordered headers, canonical source, exact target column types,
identity and foreign keys. The [source audit](../tools/migration/source-audit.json)
records aggregate configuration properties and source reader/writer call sites.
These are source findings, **not a live workbook inventory or data quality report**.
An operator must compare configured tab names with the example mapping before export.
The export reports unknown tabs; they must be classified before acceptance.

| Owner | Worksheets | Readers/writers and persistence ports |
| --- | --- | --- |
| Orders | orders, order_items, order_bills | order-list/detail-reader, order-writer, order-mutations, order-attachments; application/ports |
| Shipments | shipments, shipment_orders | shipment-list-reader, shipment-writer, shipment-status-store, shipment-order-link-store, order-detail projection; application/ports |
| Inventory | movements, movement_details, stock_counts, stock_adjustments | movements, movement-journeys, stock-counts, adjustments; application/ports |
| Sales | sales_receipts, sales_receipt_items, sales_receipt_payments, sales_receipt_syncs, sales_profit_cost_overrides | sales-reader, receipt-sync, sync-status, cost-overrides; application/ports |
| Expenses | expenses, expense_categories, shops | feature Google Sheets adapters; application ledger/master ports |
| HR | employees, employee_compensations, employee_timesheets, employee_advances, payroll_settlements | workforce-store, salary store and revision; application workforce/payroll ports |
| LINE | user_state | sessions; application session ports |

All adapter paths are under `src/modules/<owner>/infrastructure/google-sheets`.
The aggregate is `src/composition/google-sheets/GoogleSheetsService.ts`. Generic
transport is `src/infrastructure/persistence/google-sheets`; do not use runtime
`ensureExists`, header repair or `checkConnection` in export: they can write.
The general Sheets client uses USER_ENTERED behavior; payroll financial records
explicitly override writes with RAW. The migration uses direct readonly GETs and
PostgreSQL parameter-equivalent escaped literals, never Sheets writes.

`loyverse_accounts` is a **24th, private configuration worksheet**, headers `id,
shopName, storeId, accessToken, active, sortOrder`. Its sole reader is
`src/infrastructure/configuration/google-sheets/loyverse-accounts.ts`, through
`src/composition/loyverse-accounts.ts`; there is no application writer. Tokens are
not business data. It is deliberately excluded from export, schema and fixtures.
Existing env/Sheets configuration continues unchanged. Account IDs in historical
business records remain external text references; do not synthesize credential or
account rows from a shop name.

Attendance has a specific external reference: `employee_timesheets.shopId` is
`loyverse_accounts.id`, as validated by the timesheets API. It is **not** `shops.id`;
that table is the separate expense shop master. Preserve every attendance value,
row and original source cell unchanged. `externalReferences` in the catalog records
this distinction; it does not authorize reading the private configuration sheet.
Offline application parity requires approved credential-free account metadata
(`id`, `shopName`) covering attendance account IDs, including historical ones.
An absent account blocks parity acceptance; do not invent a mapping or import tokens.

The additive [timesheet relationship correction](../supabase/migrations/20261109205118_timesheet_loyverse_account_reference.sql)
removes only the two incorrect `shopId -> shops.id` foreign keys, in the archive
and operational schemas, after checking their exact identity. It keeps the
`employeeId` foreign keys, original IDs/cells, all indexes, policies and grants.
Previously applied migrations must not be edited or rerun. Applying this new
migration to an existing database requires separate owner approval and a current
backup; code/test success does not establish that a database has been corrected.
There is no automatic rollback to the old relationship: it may reject valid
Loyverse account IDs. Stop on schema drift and retain the reviewed backup instead
of rewriting attendance records to satisfy the old constraint.

The [SQL migration](../supabase/migrations/20261108184048_stock_business_staging.sql)
separates entities, line items, payments and junctions, with deferred foreign keys,
RESTRICT deletes and indexes on relationships and common date/account fields.
It preserves text business IDs exactly; it does not regenerate receipt IDs or
merge same-name shops/products. Existing denormalized labels are historical snapshots,
not new master identities. External Loyverse employee/item/customer/store IDs are
not HR employee IDs. Refund references and user-state `referenceId` are external or
polymorphic and deliberately have no invented foreign key.

All money/quantity columns are arbitrary-precision numeric, counters bigint,
flags boolean, payloads jsonb. No currency rounding, unsigned constraints on
refunds, inferred statuses or current-only uniqueness is introduced. Null/empty
source cells map to NULL; raw source cells retain the distinction. Invalid numbers,
locale separators, unsafe numeric identities, invalid JSON, duplicates and orphans
block the whole import. Source cleanup requires explicit review; nothing is dropped
or automatically repaired. Optional relationships remain nullable. Historical
soft deletions, cancellations, reversals, replacements, sync records, snapshots,
commission rules and timestamps are retained.

Typed nullable JSON uses SQL `NULL` for missing/empty cells and a parsed top-level
JSON `null`, matching `core.convert` and the archive importer. The original cell
is retained unchanged: text `null`, whitespace-wrapped JSON `null`, an empty cell,
and an absent cell remain distinguishable in source/business cells. JSON strings
such as `"null"`, nested nulls, objects/arrays, `false`, zero and numeric precision
must not be collapsed to SQL `NULL`. Malformed JSON still fails validation.

The additive [nullable JSON projection correction](../supabase/migrations/20261110011351_normalize_nullable_json_projections.sql)
normalizes only top-level JSON nulls in the six JSON columns mapped by the four
existing payroll, receipt-item, receipt-payment and user-state trigger functions.
It checks their original definitions/security attributes before replacing them.
Owners, ACLs, trigger bindings, identity/revision guards, rows, indexes and policies
are retained. It does not rewrite archive or operational records, weaken exact
reconciliation, rerun applied migrations, or automatically resume a stopped import.
Applying it and retrying promotion require approval for the exact target. A failed
promotion can advance sequence counters even when all rows roll back; retain that
evidence and do not reset counters as an automatic repair.

`tools/migration/nullable-json-integration.py` emits synthetic-only upgrade and
promotion tests for the CI Unix-socket `json_null_test` database. They reproduce
the old mismatch, verify all null/value cases against unchanged source cells,
reject malformed JSON, and compare function security/owners/ACLs, trigger bindings
and every private table's records before and after the corrective migration.

Date/month/timestamp fields deliberately remain **text in this first schema**:
existing source values and Bangkok semantics are preserved without speculative
casts or timezone conversions. Profile their formats before adding typed date
projections in a reviewed migration. This limits date constraints/range queries.
Compensation has no ID: `migration_id=sheet-row:<number>` preserves every historical
row, including same-day versions, with source order retained. Sorting/deleting rows
between snapshots is a conflict requiring a fresh isolated staging rehearsal;
never truncate or deduplicate history to make an import pass.

Every record retains workbook, row number and source cells. Import batches retain
the complete checksummed snapshot, including formula cells. This intentionally
adds archival redundancy; normalized business tables remain directly queryable.
Sensitive artifacts belong in ignored `migration-artifacts/`, mode 0600, encrypted
at rest and in off-site storage. Ignore rules alone are not encryption.

## Export, dry run and import

Requires Python 3 (standard library only), PostgreSQL 17 client tools, and a
short-lived OAuth token restricted to `spreadsheets.readonly`. Obtain it outside
chat; configure `GOOGLE_SHEETS_READONLY_TOKEN` privately. Existing application env
names and Google authentication implementations are unchanged.

1. Freeze all writers, including LINE, scheduled sync and manual edits. Google
   Sheets does not provide a transactional workbook snapshot. Take a native
   workbook backup including formulas/formatting and record its revision/time.
2. Copy `tools/migration/mapping.example.json` to an ignored artifact path; replace
   values with the actual configured worksheet names. Never map credential tabs.
3. Preview export (no credential access or HTTP):

   ```sh
   python3 tools/migration/migrate.py export --workbook WORKBOOK_ID --mapping migration-artifacts/mapping.json --output migration-artifacts/source.json --dry-run
   ```

4. With separate authorization for live reads, remove `--dry-run`. Export batch-reads
   evaluated unformatted values, formatted values and formula cells twice, and
   rejects changing captures. Text identities use the displayed values seen by the
   existing application; money/quantities use exact unformatted numeric tokens.
   Both complete renderings and original number/string cell types remain archived. This is drift detection, not a substitute
   for a write freeze. Decimal JSON tokens are decoded without binary arithmetic. Eight read requests
   cover metadata, a header-only preflight and two three-rendering captures for all 23 worksheets,
   avoiding per-tab quota exhaustion.
   Unknown tabs are reported; missing business tabs and mismatched headers fail.
   Output paths are exclusive-create; existing backups are never overwritten.
5. Validate offline, then generate a reviewable SQL plan:

   ```sh
   python3 tools/migration/migrate.py plan migration-artifacts/source.json --dry-run
   python3 tools/migration/migrate.py plan migration-artifacts/source.json --output migration-artifacts/import.sql
   ```

6. For an explicitly approved isolated staging target, apply the versioned schema
   using normal Supabase migration tracking, then inspect the generated plan.
   This tool intentionally has no automatic live execution option. A configured
   `PGSERVICE` and `PGPASSFILE` must identify the approved target (verify host,
   database and role separately). Never put passwords in command arguments.

   ```sh
   # PostgreSQL errors may contain IDs/values; discard raw driver output.
   psql -X -v ON_ERROR_STOP=1 -f migration-artifacts/import.sql >/dev/null 2>&1 || { echo 'Import failed; stop and inspect privately.'; exit 1; }
   python3 tools/migration/migrate.py database-snapshot --source migration-artifacts/source.json --output migration-artifacts/target.json
   python3 tools/migration/migrate.py reconcile migration-artifacts/source.json migration-artifacts/target.json --output migration-artifacts/archive-reconciliation.json
   ```

Import is one transaction with bounded lock/statement timeouts and an advisory
transaction lock. Constraints remain enabled. Identical identities/source rows
are no-ops; changed existing values or source positions abort the whole transaction.
No UPDATE, DELETE, TRUNCATE or runtime dual-write exists. A new append-only snapshot
can add records, but source edits need explicit change-handling design next phase.
This is intentionally not a continuous replication utility.

The planner locates each imported row using equality on its already validated,
non-null primary key, then retains every original `IS NOT DISTINCT FROM` field
comparison. This allows the existing primary-key index to narrow the assertion
without removing null-safe equality, original-cell checks or changed-identity
rejection. No new index or schema change is required. PostgreSQL integration
tests verify indexed lookup on a growing synthetic fixture, identical replay,
nullable fields and conflicting values. New generated SQL needs fresh review;
previously approved SQL artifacts must not be silently rewritten or retried.

Reconciliation fails with exit 1 on differences (2 on validation/access errors).
It compares per-table counts, complete ID sets, every FK edge, exact decimal totals
for all monetary/quantity/counter columns and complete normalized row fingerprints.
Database snapshot additionally compares typed columns with original cells, so
changing target quantities while leaving source metadata intact is detected.
Archive extraction requires `--source` and verifies the complete stored frozen
batch/checksum/workbook, including raw/formatted/formula renderings, before
reading business rows. Empty workbooks retain their identity. Decimal JSONB
numbers (including payroll snapshots) are parsed/serialized exactly as numbers,
never rounded through binary float or rewritten as strings. Reconciliation
stdout contains status/table names; `--output` writes the full private report
exclusively with mode 0600.
Reports include IDs and should be handled as private artifacts. Financial totals
are source-field totals, not invented cross-currency or net-sales calculations.
Expected acceptance: zero differences and zero rejects; review per-account/currency
business totals before any future cutover.

## Backup, restore and rollback

Before any approved staging import, take an off-site logical backup:

```sh
pg_dump -Fc -n stock_migration -f migration-artifacts/before.dump
sha256sum migration-artifacts/before.dump > migration-artifacts/before.dump.sha256
```

Use a fresh, empty, isolated PostgreSQL 17 database for restore. Provision the same
roles first (`anon`, `authenticated` on a plain PostgreSQL test server). Restore
with `pg_restore --exit-on-error --single-transaction -d RESTORE_DB backup.dump`.
Check table counts/IDs, FK constraints, totals, fingerprints, RLS and grants, then
reconcile against the immutable source export. Retain checksums, time, schema
version and encrypted off-site copies. Custom-role credentials and Drive objects
are separate backups; database dumps contain URL strings, not image files.

Automated synthetic rehearsal:

```sh
python3 -m unittest discover -s tools/migration -p 'test_*.py' -v
bash tools/migration/verify-postgres.sh
```

The script creates only a disposable local Docker PostgreSQL 17.7 database,
checks repeat import and conflicting-identity rollback, FK/uniqueness/RLS/access,
backs up all 24 tables, restores into another database and compares full table
fingerprints and security metadata. It removes its container/artifacts on exit.
It never accepts a remote URL. This proves the procedure on synthetic data, not
production recovery time or full Supabase platform/auth/storage recovery.

During this phase runtime remains on Sheets: failure of an import rolls back its
transaction and has no runtime impact. After a successful staging import, retain
it for investigation or restore the backup into a new isolated target. Do not
provide an automatic destructive down migration, drop a hosted schema, reset the
project or restore over production. These actions require separate approval.
After a future runtime cutover, rollback must address post-cutover writes and
backward reconciliation; that decision is outside this PR.

## Hosting, limits and remaining acceptance gates

Existing inspected staging candidate: `stock-management` / `orjnazrothkdgmzlsuto`, PostgreSQL
17.11, **Tokyo (`ap-northeast-1`)**. Do not create a replacement or paid branch.
Singapore (`ap-southeast-1`) is geographically closer to Bangkok and may reduce
latency, but measure from the actual application host and consider residency,
recovery and egress requirements. Region selection is a deployment decision;
changing an existing project's region requires a separate migration. This PR
makes no region change.

Free-tier planning baseline: 500 MB database (exceeding it can force read-only
mode), 1 GB overall disk, limited compute/connections,
5 GB uncached egress (plus a separate cached allowance), and inactivity pausing.
Verify current quotas/organization billing in the dashboard before loading;
quotas change. Reserve headroom for indexes, source-cell duplication, full batch
snapshots, WAL and temporary import work. Do not assume disk footprint equals
export size. Prefer direct/session-mode database connections for migration and
pg_dump; avoid transaction pooler session assumptions. The single-transaction
planner is appropriate for small Free-tier rehearsals; large datasets require
measured batching/checkpoint design before approval.

Free projects do not include managed daily backup/PITR guarantees. Schedule
regular encrypted off-site logical exports and tested restores. Branching/PITR
can incur cost and are not provisioned here. Sources verified through Supabase
Docs: [import](https://supabase.com/docs/guides/database/import-data),
[backups](https://supabase.com/docs/guides/platform/backups),
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
The changelog endpoint was blocked by environment network policy; review current
changelog and pricing before hosted DDL approval.

Remaining gates: approved frozen live snapshot and full tab inventory, date/locale
profiling, duplicate/orphan resolution with owners, real workbook financial and
quantity reconciliation, size/latency measurements, hosted migration/restore rehearsal,
least-privilege importer provisioning, and business acceptance. Do not claim live
migration or production readiness from synthetic tests. Next step is an approved
frozen-source export and isolated staging rehearsal with signed reconciliation;
port adapters and runtime switching remain a separately scoped phase.

## Implementation acceptance evidence (local, 2026-11-08)

553 application tests pass (including automatic migration/header parity checks);
11 Python migration checks pass. PostgreSQL 17.7 synthetic extraction reconciles
with zero differences; duplicate import, conflict rollback, FK/unique/RLS/access
checks and full 24-table backup/restore fingerprints pass. Typecheck and isolated
credential-free Next build pass. Lint has one inherited unused-variable warning.
Hosted security advisor returns no findings; hosted schema/data are unchanged.
These results do not satisfy the live-data acceptance gates above.


## Audit-history removal (applied to hosted staging)

Migration `20261111034402` is recorded in hosted staging. Do not replay it.
The following procedure and implementation description are retained for review.

The owner requested removal of `stock_operational.audit`. The new migration
[`20261111034402_remove_operational_audit.sql`](../supabase/migrations/20261111034402_remove_operational_audit.sql)
replaces it with one private `revision` row, seeded from the old audit maximum.
It removes all 23 audit triggers and their function, then drops the audit table
and its identity sequence, policies, grants and stored history. It does not
change business records, immutable source snapshots, command replay or provider
effect journals. Historical migration files and prior evidence remain unchanged.

Statement triggers on the 23 business tables increment the counter for INSERT,
UPDATE and DELETE, within the same transaction. A statement that affects no rows
can also increment it; tokens are opaque change indicators, not row counts.
Rollback restores both business state and revision. A missing counter fails closed.
The runtime role may read/update its value but cannot insert/delete the singleton
or change its identity; anon/authenticated have no access. No record payload,
actor, timestamp or change history is stored in the replacement. Existing per-row
business version fields and retained business archives remain intact.

`x-stock-revision` and `If-Match` keep their existing HTTP behavior, using opaque
`"stock-v2-N"` tokens. Old tokens deliberately produce 409 and require refresh.
Before applying anywhere: stop all writers, review a fresh exact-target dependency
inventory and preserve an approved backup; obtain separate hosted DDL approval.
Deploy matching application/tooling and schema as a coordinated maintenance change,
then verify business reconciliation, grants/RLS, revision conflicts and recovery.
Recovery includes column ACLs to detect changes to the counter-value write grant.
Do not run old application code against the new schema or new code against the old.
The recovery tool defaults to `revision`; explicit `--history audit` supports
fresh pre-change captures. Use the pinned historical tool version when older
backups have a different metadata fingerprint shape. A new-schema fingerprint is not comparable
to an old-schema fingerprint without this reviewed change inventory.

Audit-history deletion cannot be reversed by recreating an empty table. Before
new writes, rollback requires restoration of the approved pre-change backup and
matching code. After new writes, freeze writers and prepare a separately reviewed
forward fix or recovery reconciliation; do not blindly restore stale business data.
The separately authorized 2026-11-11 pre-change backup and independent local
recovery/rehearsal passed; see the current progress ledger. Hosted audit removal was subsequently owner-authorized, applied and verified with
a fresh encrypted independent post-change recovery; data cleanup and application/
production activation remain separately gated.

## Phase 2 operational storage (opt-in isolated testing)

Start point: merged PR48 `57882d2989d5d8d1156c7dc7bdeb5a694050e7ad`.
The operational migration is
[`20261108191839_stock_operational.sql`](../supabase/migrations/20261108191839_stock_operational.sql).
It keeps the 23-table staging archive immutable and creates 23 separate operational
business tables plus command, singleton revision, reply-attempt history and
target-isolation metadata after the audit-removal migration. All are private,
with RLS. The existing seven feature applications and port mappers remain the one
business implementation; feature-owned `infrastructure/postgres/tables.ts` binds
them to typed operational records. Existing compatibility names do not imply
Google transport is used when Supabase is selected. Drive still stores images.

Coverage: Orders/items/bills, Shipments/order links, Movements/details,
counts/adjustments/reversals, receipt/items/payments/sync history/cost overrides,
expenses/categories/shops, employees/compensation/attendance/advances/settlements,
and LINE session workflows. Configuration credentials in loyverse_accounts remain
excluded, using the existing private env/Sheets configuration seam. No business
module is switched automatically.

### Isolated server configuration

Use a separate staging deployment, configure these variables before its build,
and never edit production Vercel settings:

- `STOCK_STORAGE=supabase` (otherwise default `google-sheets`).
- `STOCK_STAGING_ENABLED=true`; `VERCEL_ENV=production` always rejects Supabase.
- `STOCK_DATABASE_URL`: dedicated nonprivileged login, approved direct/session or
  transaction-pooler URI. Do not include TLS query overrides. Pool maximum is two
  connections per instance, idle timeout five seconds. All statements are unnamed;
  transaction-local role/settings/locks work with transaction pooling.
- `STOCK_TARGET_ISOLATION_ID`: owner-verified UUID from
  `SELECT isolation_id FROM stock_operational.environment` on the approved target.
  Every transaction verifies this database-side guard before reading/writing business
  state. Rotate the guard and review configuration before enabling a restored clone.
- `STOCK_DATABASE_CA`: optional trusted PEM for hosted PostgreSQL; hostname/CA
  verification is mandatory. Never disable TLS checks for a hosted target.
- `STOCK_STAGING_AUTH_TOKEN`: privately generated, at least 32 characters. HTTP
  integration runners send `Authorization: Bearer <token>`. Browser runners inject
  this header outside the application; no login UI or browser credential config
  is introduced. Database credentials never enter browser bundles.
- `STOCK_ALLOW_LOCAL_TEST_DATABASE=true` is only for a disposable localhost DB.

An owner applies migrations and separately provisions a LOGIN with no superuser,
BYPASSRLS, CREATEDB, CREATEROLE or inherited owner powers, grants it membership in
stock_runtime and revokes unnecessary public-schema rights. Set its password via
private tooling, not chat, SQL committed to Git or command arguments. The app
executes SET LOCAL ROLE stock_runtime in each transaction. That role has no
archive access, DDL or DELETE and cannot update receipts, compensation,
adjustments or settlements. Immutable archive triggers also prevent accidental
owner UPDATE/DELETE/TRUNCATE. Do not expose either schema via the Data API.
Original Sheets-mode authentication remains unchanged; production staff/owner
policy still needs the separate production-readiness review.

### Command identity and concurrent writes

The owner approved a Supabase-only request-contract addition: mutations require a
stable `Idempotency-Key`. Missing keys return 428, reused keys with different
intent return 409, and successful retries replay the stored status/body/headers.
Generate a key once per intentional action, before the first POST, retain it
through network errors and reloads, and use a new key for another intentional
identical create. A staging-only script handles current browser fetch callers;
it uses sessionStorage and hashes actual multipart bytes rather than unstable
multipart boundaries. A successful parsed response retires the key. Storage
failure stops a blind submission. Cross-tab/device recovery requires the original
key from the caller; losing it cannot be solved by guessing from business fields.

Writes serialize using a PostgreSQL advisory lock around the complete existing
application execution. Deferred FKs, business uniqueness, revision checks and the
command journal commit together; GETs use a shared lock for coherent multi-table
reads. No runtime fallback exists. Handled error responses roll back all preceding
writes. Optional If-Match uses the x-stock-revision value from a prior response;
replay of an already committed key remains safe even when that view is stale.
Existing payroll revisions and cancellation/reversal rules are unchanged.

LINE verifies its original signature, requires webhookEventId, and journals each
event separately so regrouped redeliveries cannot repeat business commands. It
normalizes only delivery metadata and reply tokens for fingerprinting. Replies
are attempted after commit through durable attempt records. A crash after marking
sending, or an ambiguous send, is quarantined rather than automatically repeated.
There is no exactly-once third-party-delivery guarantee. Inspect sending/uncertain
side_effects and associated command results privately before choosing recovery.
Failed event processing rolls back business changes to a savepoint and retains a
terminal result; repeated failed deliveries replay that result. Owner recovery
requires reviewing the cause and external effects; do not delete command history
or fabricate a new event ID to force a replay.

Drive uploads stay outside database atomicity and may leave orphan files after
rollback or an ambiguous database acknowledgement. Preserve returned file IDs,
review command records and Drive ownership before cleanup. There is no
automatic destructive cross-provider rollback. A process crash before the upload
ID is returned may require a private Drive inventory. This remains a cutover risk.

### Offline profiling and promotion

With a separately approved frozen export, create a private offline profile:

```sh
python3 tools/migration/profile.py migration-artifacts/source.json --output migration-artifacts/profile.json
```

The report covers business/source cell types, duplicate identities, date validity/shapes, formula-like cells and formatted-numeric compatibility requiring review, orphan
relationships, decimal totals and serialized size. Any problem requires review;
no source cell is repaired. Real date/locale interpretation still needs an owner.
Next run the existing dry-run/import planner, load only the approved staging
archive, back it up, and inspect
[`tools/migration/promote.sql`](../tools/migration/promote.sql). Execute with
`psql -X -v ON_ERROR_STOP=1` against an approved **empty** operational target.
Promotion takes the writer lock, preserves every ID/raw cell/typed value, compares
both directions with EXCEPT ALL, validates constraints and commits atomically.
A nonempty target fails; repeated promotion never overwrites runtime records.
Stop on reconciliation failure. Do not disable constraints to force acceptance.

Operational compatibility projections retain sparse row ordinals and archived
records because historical session references depend on them. Native updates keep
identities immutable and advance the singleton revision without storing before/after
snapshots. Hard-delete
business operations become retained archives with equivalent active-reader
results. PostgreSQL stores new inputs literally; it does not execute Google Sheets formulas.
Profile formula-like source cells and obtain business-rule review before promotion.
Imported evaluated values and original formula cells remain archived unchanged.
Date strings and existing JavaScript financial/stock calculations are
preserved; typed numeric columns do not introduce new rounding.

### Verification and capacity

```sh
npm test
npm run lint
npm run typecheck
bash tools/migration/verify-operational.sh
```

The PostgreSQL runner creates local disposable PostgreSQL only: all migrations,
synthetic archive import, exact promotion, existing feature applications, concurrent
request replay, actual lost-COMMIT-ack simulation, stale revisions, permissions,
LINE and Loyverse fakes, payroll snapshots, indexed synthetic workload and logical
backup/restore. It accepts no hosted URL. The production build must run separately
in an isolated source/dependency copy with integration credentials excluded.

Full-table compatibility projections and the global write lock deliberately favor
correctness over throughput. They are suitable only for measured small staging
workloads. Projection rejects ordinals above one million; the synthetic 2,000-row
measurement is not a production benchmark. Profile sparse IDs/row positions and
measure CPU/memory/latency/lock contention with an approved export before cutover.
The Free-tier database must hold immutable snapshots, operational data, revision/command/effect state,
indexes and recovery overhead; export bytes alone substantially understate disk
requirements. No unmeasured production capacity guarantee is made.

Back up both stock_migration and stock_operational, including commands, revision and
side_effects. Restore into a fresh isolated database with the same roles; compare
complete records/fingerprints, constraints, grants/RLS and journal/effect states.
Backups contain personal business data and short-lived reply tokens; encrypt and
restrict them. The automated rehearsal compares both promoted import state and
application-generated state, not just an empty schema.

### Production cutover and rollback prerequisites

1. Approve a frozen native workbook backup/export and target; inventory every tab,
   profile types/IDs/dates/relationships and resolve all unexplained records.
2. Reconcile IDs, counts, relationships and exact financial/stock totals after
   promotion; stop on any mismatch. Keep original Sheets data untouched.
3. Review caller operation-key retention, supported legacy-client policy, actual
   production authorization, least-privilege credentials/TLS, hosted isolation,
   and the build-time staging browser-script selection.
4. Validate real workloads, concurrency, ambiguous commits, external-effect
   quarantine, off-site backups, restores and recovery time. Approve an operator
   procedure for failed LINE commands and uncertain replies/uploads.
5. Quiesce old/manual writers and pending provider requests. Prepare a separately
   approved cutover; this PR does not enable production writes or change Vercel.

Rollback before cutover is simply leaving STOCK_STORAGE at its default Sheets
value. After a future cutover, stop all writers, retain journals/tombstones
and reconcile post-cutover data before any storage switch. Restoring an older
backup can lose committed operations; restoring journal/effect state can also
reintroduce delivery uncertainty. Prove terminal outcomes before resuming writes.
Never automatically fall back to stale Sheets or delete history to make retry
work. No automatic merge, deployment or production-cutover tool is provided.

## Phase 3: real data validation and controlled cutover

This is the single execution runbook. All boxes begin **unchecked**. An owner
must authorize each external action separately, naming the workbook/copy,
Supabase project/database, approved operators, artifact recipients, time window
and allowed reads/writes. PR49 review/merge approval does not authorize Phase 3.
Never paste credentials or real records into chat, PRs, logs or CI artifacts.

### Current execution record and reproducible preparation

As of 2026-11-11, hosted schema deployment and the approved manual CSV import
are complete in isolated staging. All 23 business tables / 70,777 records
reconcile against the saved latest export after one approved name correction;
66 offline application comparisons passed and no sequence alignment was needed.
The manual CSV route bypassed archive/import-batch loading; do not describe it
as completion of the standard archive-promotion path below. The application
still uses Google Sheets; runtime activation and production cutover have not
occurred. The owner subsequently authorized the timeout fix and pre-change
backup/rehearsal. Versioned full-row hashes with two bounded readers passed
the unchanged 150-second verification limit. The encrypted private off-site
backup, independent download/key recovery and exact 51-table/15-metadata restore
passed. A second local restore passed audit removal, 23-table reconciliation,
66 application comparisons and a new-schema backup/restore. Final hosted
verification at 11:31 Bangkok matched the pre-change snapshot, roles and ledger;
the audit-removal migration was subsequently applied with ledger/data/security
verification and a fresh independent post-change backup/restore. This certifies the scoped private
schema recovery, not full platform recovery or application cutover readiness.

Use the [current progress ledger](refactoring/progress.md#database-migration--current-operational-status-2026-11-11)
and [machine-readable status](../tools/migration/phase3-status.json) for aggregate
execution results, evidence provenance and remaining gates. The checklists below
remain acceptance requirements; a successful import or offline comparison does
not check off hosted runtime, recovery, security, capacity or cutover gates.
Reconfirm writer freeze and source freshness before any later activation.

The [2026-11-09 preparation snapshot](https://github.com/volkswg/stock-management/blob/65ed6f65256e59f7f6fce44bcd4fb88a819ae95c/tools/migration/phase3-status.json)
is historical: it predates schema deployment and real-data execution. Its missing
Cloud credentials/network and unknown row counts must not be read as current
Mac status. The backup/rehearsal above was separately owner-authorized execution,
not implicit authorization from documentation maintenance. A future operator must independently verify scoped
access and approved network/TLS; never assume Mac, plugin and Cloud credentials
are shared or available. Keep workbook identifiers and private execution
artifacts out of the repository, PRs and CI.

The generic commands below are for separately approved preparation. Deployment
is already complete in the current target: do not rerun its migrations, replay
retired import plans or resume paused backup work as documentation maintenance.

Generate a deployment manifest offline, without credentials/network:

```sh
python3 tools/migration/staging.py plan --target tools/migration/staging-target.example.json --output migration-artifacts/deployment-plan.json
```

The manifest pins the exact Tokyo candidate and every migration SHA256, lists
required approvals and always sets executionAuthorized=false. It cannot execute
DDL or grant permission. Stop on another target, existing private schema,
unexpected public relation or changed migration checksum. Never reset a project
or truncate/replace records to make deployment succeed.

For approved catalog inspection from Cloud, provision private PGSERVICE/PGPASSFILE,
require `sslmode=verify-full` and the correct CA/hostname, then run
`python3 tools/migration/staging.py inspect --output migration-artifacts/target-inspection.json`.
This reads catalogs only, not auth, staff, credential or business rows, and does
not attest endpoint ownership. PostgreSQL tools require explicit PGSERVICE,
prohibit password prompts and bound
connection timeouts. Dump/restore/exported snapshots require a direct/session
connection; runtime transaction-pooler verification is a separate gate.
Business extraction/backup also rejects TCP connections without PostgreSQL TLS;
Unix-socket disposable tests use an explicit synthetic service name in wrappers.
The private service must independently enforce hostname/CA verification.

Supabase CLI **3.0.0** was installed locally only to verify version/help. No
remote command/link ran. Old `--linked` syntax is invalid for this version.
After separate exact-target access/DDL approval, the operator may run:

```sh
npx --yes supabase@3.0.0 migration list --remote=orjnazrothkdgmzlsuto
npx --yes supabase@3.0.0 db push --remote=orjnazrothkdgmzlsuto --skip-vault --dry-run
# Only after reviewing pending files and obtaining DDL approval:
npx --yes supabase@3.0.0 db push --remote=orjnazrothkdgmzlsuto --skip-vault
```

These are **unexecuted hosted instructions**, not approval. Provision CLI access
privately through its supported scoped credential flow, without password flags
or debug traces. CLI 3 can require database_write while obtaining remote
metadata/credentials; use the authorized plugin/catalog inspection before that
permission is granted. `--skip-vault` is mandatory: this CLI otherwise updates
Vault secrets before migrations. Do not add include-seed/include-roles/include-all,
CLI automatic-confirmation flags, repair or reset. Stop on partial failure; never
blindly repeat/rewrite merged migrations. Preserve the remote ledger beside the
manifest; private-schema backups do not manage Supabase platform metadata.
The direct changelog URL was network-policy denied; current database/backup docs
and actual CLI help were consulted instead.

### Gate 0 — authority, isolation and release prerequisites

- [ ] Record the approved PR49 commit, independent CI run/artifact checksums and
  architect review. Resolve all security/reconciliation/recovery failures first.
- [ ] Owner identifies the authoritative workbook, every business tab and any
  unknown tab. Compare the 23-table catalog, mapping and source audit with that
  inventory. Classify private `loyverse_accounts` separately; never export tokens.
- [ ] Obtain read-only export approval and a native, frozen workbook backup/copy.
  Record workbook ID, revision/copy time, UTC and Asia/Bangkok freeze timestamps,
  locale/timezone, writer inventory and signed owner acknowledgement. Prefer an
  owner-provided frozen copy. Read-only OAuth scope alone does not isolate tabs;
  workbook-wide credential visibility requires a restricted principal/copy.
- [ ] Separately approve hosted DDL/import and restore targets. Verify project ref,
  database, region, TLS hostname/CA, login identity and target isolation UUID out
  of band. Never use the existing empty project merely because it is connected.
  The current scripts use fixed schema names, so an unrelated populated schema
  in that project blocks execution. Prefer a dedicated empty approved database;
  a new billable project/infrastructure requires owner approval.
- [ ] Define acceptable RTO/RPO, freeze duration, workload, latency targets and
  capacity budget before testing. Record accountable owner, migration operator,
  independent reconciler, security reviewer and rollback incident lead.
- [ ] **Production blocker:** the code rejects `VERCEL_ENV=production`, uses a
  shared staging actor/token and has no production authentication policy. A
  separate reviewed release must provide server-verified identity, per-operation
  authorization (including HR/payroll), audit attribution, CSRF/session protection,
  abuse controls and a fail-closed production target gate. Do not bypass these
  guards by falsifying Vercel environment metadata. Issue #38 remains open scope.

### Gate 1 — secure artifact handling and read-only export

Create a restricted encrypted working directory (0700) outside shared sync roots.
Use the ignored `migration-artifacts/` location only on encrypted storage. Files
are exclusive-create 0600; this prevents replacement, not disclosure to a host
administrator. Store encrypted off-site copies with separate key custodians,
least-privilege access, access logs, retention/expiry and tested key recovery.
Include source/full renderings/formulas, mapping, SQL plans, database dumps,
profiles, reconciliation and business acceptance evidence. Git and public CI
must contain synthetic evidence only. Suppress shell tracing, request traces,
HAR/video/screenshots and provider response bodies. Rotate short-lived tokens.

- [ ] Privately provision `GOOGLE_SHEETS_READONLY_TOKEN` with only
  `spreadsheets.readonly`; do not reuse the application's write-capable account.
- [ ] Freeze all writers to the copy during capture. For a live final freeze,
  use Gate 7; do not assume two matching reads guarantee workbook atomicity.
- [ ] Run the export dry-run from the earlier section. Independently review all
  mapped tabs. Only after export approval, execute the same command without
  `--dry-run`. It makes GET requests only, never application `ensureExists` calls.
- [ ] Record SHA256 of the exact artifact bytes, the canonical snapshot checksum,
  tool/commit version, operator, eight-request completion and capture times.
  Unknown tabs or changed captures stop acceptance; do not discard them silently.
  Header-only preflight rejects wrong/credential worksheets before business row
  capture. Redirects are refused so bearer credentials cannot cross origins.

### Gate 2 — offline profiling and source compatibility

```sh
python3 tools/migration/profile.py migration-artifacts/source.json --output migration-artifacts/profile.json
python3 tools/migration/migrate.py plan migration-artifacts/source.json --dry-run
python3 tools/migration/migrate.py plan migration-artifacts/source.json --output migration-artifacts/import.sql
```

- [ ] Review all 23 tables: exact headers, count/IDs (including leading zeros),
  duplicate/missing IDs, compensation positional identities, blank/sparse rows,
  every FK, polymorphic/external references and historical/deleted records.
- [ ] Compare raw, formatted and formula values; validate numeric precision,
  currencies, refunds, locale separators and totals. Raw field totals alone do
  not prove net sales, inventory availability or payroll equivalence.
- [ ] Validate date/month shapes, timestamp offsets, Bangkok day/month boundaries,
  leap days and naïve timestamps. No automatic timezone assignment is allowed.
- [ ] Run the existing application parsers/calculations over the approved source
  and promoted target projections. Compare parsed money/quantity values per cell
  as well as report totals: existing Sheets readers consume displayed values,
  whereas PostgreSQL preserves unformatted numeric cells. Display rounding,
  formatted currency/commas and formulas are **blocking compatibility findings**
  until reviewed and fixed in version-controlled code with new tests. Never
  edit the export or dismiss a profiler finding just to achieve a pass.
- [ ] Resolve all profiler problems, orphan/duplicate IDs, unknown source types,
  formulas, unsupported sparse ordinals and table constraints. Preserve the
  original artifact and document every approved source correction/re-export.
  Any unresolved problem stops deployment/import, not just production cutover.

### Gate 3 — isolated hosted deployment, import and reconciliation

After explicit target-specific DDL approval, inspect the SQL migrations at the
approved commit and apply them through Supabase migration tracking using a
private owner connection. Rehearse the same process on the restore target. Do
not run project reset, destructive down SQL or privileged browser clients.
Provision a dedicated non-owner LOGIN with NOSUPERUSER/NOBYPASSRLS/NOCREATEDB/
NOCREATEROLE/NOINHERIT, grant membership only in `stock_runtime`, and verify no
inherited roles/object ownership broaden access. Keep migration-owner credentials
separate. Runtime uses SET LOCAL ROLE per transaction, max two pooled connections,
verified TLS and no named prepared statements; use the approved Supavisor
transaction-pooler endpoint for Vercel. Use a direct/session connection for
migration and pg_dump. Verify custom-role/pooler support on the actual target;
unsupported hosted roles/pooling stop the gate rather than substituting an owner.

- [ ] Record migration ledger, 24 archive tables/27 operational tables, RLS,
  grants, constraints, indexes, immutable triggers and environment UUID/purpose.
  Keep both schemas absent from exposed Data API schemas; anon/authenticated and
  runtime-login direct access must fail. RLS is not a replacement for app auth.
- [ ] Take a private pre-import backup and verify its encrypted off-site copy.
- [ ] With import approval, execute reviewed `import.sql` with ON_ERROR_STOP.
  Capture only sanitized status/checksums. Reimport identically; counts and
  fingerprints must remain identical. A changed identity must abort atomically.
- [ ] Extract `database-snapshot --source <approved-source.json>` and reconcile
  against that source; preserve the full report with `--output`.
- [ ] Review `promote.sql`, verify empty operational target and execute it only
  after approval. Promotion locks both schemas, validates all values/constraints
  and preserves IDs/ordinals/history in one transaction; failed promotion rolls
  back. Runtime remains disabled throughout.
  Discard raw psql stdout/stderr for promotion too; PostgreSQL constraint errors
  may contain private IDs/financial values. Report only a fixed outcome and stop
  on failure. Do not enable SQL echo/debug or forward provider/driver errors into
  ordinary logs. Diagnose only through separately authorized private inspection.
- [ ] Privately configure `PGSERVICE`, `PGPASSFILE` and
  `STOCK_TARGET_ISOLATION_ID` for the approved target, then run:

```sh
python3 tools/migration/phase3.py operational-snapshot --source migration-artifacts/source.json --output migration-artifacts/operational.json
python3 tools/migration/migrate.py reconcile migration-artifacts/source.json migration-artifacts/operational.json --output migration-artifacts/operational-reconciliation.json
python3 tools/migration/acceptance.py migration-artifacts/source.json migration-artifacts/target.json migration-artifacts/operational.json --output migration-artifacts/acceptance.json
```

The operational extractor uses a repeatable-read READ ONLY transaction and shared
writer lock, checks target UUID/purpose, compares typed columns with business
cells and rejects archived/invalid positional records. It is intended for a
pristine promoted target. Reconciliation covers all counts, complete ID sets,
relationships, exact numeric totals and row fingerprints, including historical
rows. Reports contain private identities. Save them in restricted artifacts,
never ordinary CI. Require `match: true` and zero rejects/unexplained records.
The acceptance report includes all tables even on success: counts, complete
IDs/FK edges, exact totals and source-cell fingerprints for source/archive/
operational states, plus module summaries and source profiling. A record pass
requires the verified full batch and clean profile. It still sets cutoverReady=false:
derived business totals, authorization, hosted recovery and owner authority remain
separate gates.

- [ ] Independently compare stock by account/shop/month (delivered journeys,
  counts, adjustments/reversals) and finances by date/account/currency, including
  receipts/refunds/tax/discount/payments, Orders/shipping, Expenses and payroll
  advance/settlement snapshots. Compare existing API JSON/status/order results
  using the same frozen clocks, external-provider fakes and original algorithms.
- [ ] Run the **offline** original-application comparison:

```sh
env -i PATH="$PATH" node tools/migration/application-parity.cjs --source migration-artifacts/source.json --operational migration-artifacts/operational.json --config migration-artifacts/parity-config.json --output migration-artifacts/application-parity.json
```

The private config contains `asOf` (offset-aware frozen timestamp), `months`
(YYYY-MM for all relevant history) and `accounts` (id/shopName only, no tokens).
The runner invokes existing applications/mappers over original formatted values
and reconstructed operational cells; it contains no financial/stock/payroll rules.
It compares Orders/details/items/bills, Shipments, Movements/items/adjustments,
Expenses/masters, sales/profit/sync, workforce/compensation/attendance/advances/
settlements/payroll, stock counts and LINE sessions. Missing formatted data,
reader failures, omitted observed account/month coverage or differences fail.
Raw and Bangkok timestamp months are included conservatively; the owner must
still verify zero-activity periods and complete historical coverage. Every
provider call and write is rejected; ensureWorksheet only checks frozen fixture
presence. The full output is private 0600 data, stdout only status/counts.
This is snapshot/application parity, **not hosted runtime/HTTP/provider acceptance**.
- [ ] **Stop on any mismatch.** Keep both source and failing target intact;
  identify cause, correct code in review and repeat from an empty approved target.
  Do not disable constraints, mutate archives, drop records or tolerate rounding.

### Gate 4 — capacity, region and query performance

- [ ] Confirm the actual project plan/region. For Bangkok users, compare available
  Singapore (`ap-southeast-1`) and nearby supported regions against the actual
  Vercel function region, round-trip latency, residency and recovery needs.
  Do not relocate the existing project; region changes require a new approved
  target/migration. A region proposal is not a deployment instruction.
- [ ] Run `psql -X -v ON_ERROR_STOP=1 -f tools/migration/capacity.sql` against the
  approved target and store output privately. Measure database, heap/index,
  archive/full-snapshot/command growth and connection counts. Stats row
  estimates supplement exact reconciliation counts; they do not replace them.
- [ ] Recheck [current plan limits](https://supabase.com/pricing),
  [database size](https://supabase.com/docs/guides/platform/manage-your-usage/database-size),
  [backups](https://supabase.com/docs/guides/platform/backups) and
  [pooling](https://supabase.com/docs/guides/database/connecting-to-postgres).
  Free projects commonly have 500 MB database storage, limited compute/connections,
  inactivity pausing and no paid PITR guarantee. Do not assume automatic daily
  recoverable backups on Free. Confirm current quotas in the target dashboard.
  Drive images remain on Drive; exports/dumps and DB traffic still consume space
  and egress. Budget full archive duplication, indexes, command/effect replay growth,
  maintenance and restore headroom, not just source JSON bytes.
- [ ] Measure warm/cold p50/p95/p99 API/query/lock waits, memory and throughput
  at approved peak concurrency on an expendable clone, with provider calls faked.
  Include full Orders reads, receipt/profit reports, inventory/monthly stock and
  payroll. Save EXPLAIN (ANALYZE, BUFFERS) for representative reads. Never run
  write EXPLAIN or load tests on production. Global write serialization and
  full-table projections are known limits; reject cutover if agreed limits fail.
- [ ] Owner approves measured capacity/headroom, latency and growth horizon.
  Any required new infrastructure/paid plan is a separate approval, not an
  automatic upgrade or an excuse to alter business semantics.

### Gate 5 — authorization, browser/API and business acceptance

#### Private read-only preview evidence before PR #60 merge (2026-11-11)

The owner authorized preparing a private Supabase staging app and running only
read-only application tests. The separate Vercel project
`stock-management-supabase-staging` uses a protected preview in Tokyo, with no
production-domain assignment or Google Sheets/provider credentials. Its Next.js
build command removes database, CA, API-capability and account-config values;
those values are supplied only to the application runtime. The tested
source is `8628dd30418b22394d62c73d2c6c60fdf1a718c0` (PR #60). The existing
production domain still resolves to the PR #59 deployment and uses Google Sheets.

The preview sets `STOCK_STORAGE=supabase`, `STOCK_STAGING_ENABLED=true` and
`STOCK_STAGING_READ_ONLY=true`. The last flag rejects every exported mutation
route, including LINE webhooks, before handler execution and rejects mutation
transaction scopes. Node instrumentation also denies outbound provider fetches.
Account identities are preserved through credential-free account metadata and
disabled placeholder tokens. No real LINE, Loyverse or Drive operation is enabled.
These flags do not replace database permissions or deployment protection.

The dedicated login has SELECT on only the 23 business tables plus environment
and revision, no membership in the writer role, no DML privileges on any of the
51 private tables, and no ownership, schema creation or executable privileged
functions in the private schemas. It defaults to read-only transactions and does
not assume `stock_runtime`. Exactly 25 SELECT policies/grants and the required
schema/table ACL entries were added; PostgreSQL also recorded its creator-admin
membership to `postgres` without SET or INHERIT. Existing permissions/policies
were preserved. No migration, row change, revision increment or command/effect
record was needed to prepare or test this preview.

The initial direct database endpoint could not serve preview reads. The endpoint
was replaced only in this preview's configuration with the dashboard-confirmed
IPv4 session pooler, using the same SELECT-only login and verified TLS. No
certificate verification was disabled and no privileged database login was used
by the application. Keep pooler hostnames/project identity exact; do not infer
them from a region name or send credentials to guessed endpoints.

Private evidence records 166/166 hosted API checks: 130 successful reads, 32
mutation refusals, two authorization denials and two invalid/missing-resource
responses. Reads cover all 39 order details, representative movement items, and
February–November attendance, stock, payroll, sales, expenses, adjustments and
per-account sync history, plus annual profit and salary advances. Results match
the verified saved source application outputs. The response contract's historical
`google_sheets` source labels remain unchanged; they do not describe the preview's
actual storage connection. Twenty browser pages, five additional mobile views,
order search/empty results, API authorization and deployment protection passed.
Foreign browser requests were blocked; an attempted provider read was refused by
the runtime guard before any external request. All successful API reads retained
revision 70,778. A post-test snapshot matched every one of the 51 table hashes;
all 15 existing metadata sections matched after excluding only the enumerated
read-only access additions. Screenshots, response bodies, credentials and receipts
remain in restricted operator artifacts outside Git.

The first local/direct browser pass exposed three report failures under overlap;
isolated pooler-backed stock and profit reads subsequently matched exactly. The
final hosted read pass had p50 227 ms, p95 1,648 ms and maximum 1,839 ms for 130
successful requests. These are small sequential acceptance samples, not peak-load
or capacity certification. Provider-backed images/uploads, real integrations,
all write workflows, concurrency/retry/recovery under writes, production
authorization and source freshness remain separate gates. The owner has not
authorized production cutover or modifying existing data in this phase.

This remains an operator-only preview. Opening its URL requires Vercel access;
reading its API additionally requires the scoped private runner described below.
Do not put the API capability in page code, URLs or browser storage to simplify
manual access. Retire/rotate the temporary access capability when the authorized
acceptance work ends. The verified pre/post-audit encrypted backups remain valid
for the unchanged business data; recreating this new preview login/policies after
a restore is a separate operator setup step.

The staging bearer token is an operator capability, not a customer login. Supply
it from a private Node test-runner environment/secret store. An API runner must
allow only the exact approved HTTPS origin/path and set `redirect: 'error'`.
A browser runner intercepts requests in Node and injects Authorization only for
that exact origin's `/api/` paths. Abort foreign origins/redirects rather than
using global `extraHTTPHeaders`. Keep the token out of page evaluate/init scripts,
URLs, local/session storage, build env, HAR, traces and screenshots. The browser
can necessarily see a request bearer in its network tools: use only trusted,
owner-authorized testers and a short-lived token; rotate after acceptance.
Deployment protection/SSO credentials are separate and do not authorize the API.
Do not make private staging publicly accessible to get tests passing.

`browser-acceptance.test.cjs` demonstrates this boundary with a disposable local
fixture and actual Orders route/PostgreSQL: denied API/browser requests, scoped
bearer injection, post-commit response loss, reload/replay and a new intentional
create, and foreign-origin denial. It accepts only loopback SQL. It does not
claim full React UI/hosted/provider acceptance. Its fixture serves the real retry
script and bridges requests to actual HTTP handlers. The independent CI workflow
installs isolated pinned Playwright tooling and Chromium; it receives no business
secrets. Do not repoint this synthetic runner at real data.

Approve a private hosted acceptance runner/configuration separately. Do not
replay imported user sessions against real LINE users. Use test LINE channel,
Loyverse sandbox/fake receipts and a restricted Drive test folder, or explicitly
approve each external provider action. Preserve original account identities via
safe fixture configuration; never export credential tabs into test artifacts.

#### Disposable staging write-testing plan

**Current status: receipt overlap fixed; local rerun stopped at a separate cost-override deletion failure (WT12).**
The owner subsequently authorized the disposable **local** copy, write harness
and tests. Hosted write testing and production activation remain unapproved.
The execution baseline is merged [PR #61](https://github.com/volkswg/stock-management/pull/61),
commit `dff802bfddf5c522c013262ba8e56ba9532a8221`. The plan below retains its
original requirements; a stopped/partial run is not full acceptance.
Google Sheets remains production's store.

##### Receipt-overlap fix and local rerun (2026-11-11)

The owner authorized the overlap fix and another disposable local write run.
Commit `ff7c997ed6452a20b068762103c589ddd4f0b502` changes the Loyverse client's
completed, date-filtered receipt list: identical payloads with the same receipt
number collapse in first-seen order. Canonical comparison ignores object-key
order while preserving array order and all original values. Missing identities
or conflicting versions reject the entire read with a static error before a
caller receives any receipts. No version is selected by guessing its timestamp,
price or status. Both normal Sheets and SQL sync use this provider client.
No stored row is cleaned up or rewritten by the fix; SQL identity constraints,
API paths/status mappings, roles, schema and storage configuration are unchanged.

Six focused regressions reproduced five baseline failures and now pass, covering
within/across-page overlap, nested key order, conflicting money/status/item/payment
values, invalid identity, date filtering/cancellations and late-page failure.
A separate actual-client + in-memory Sheets-compatible writer test proves exactly
two receipt/item/payment rows, net sales 80, and zero writes on a conflicting
batch. Original immutable fixtures remain unchanged; a hash-pinned bounded source
inverse keeps historical architecture witnesses intact. Current runtime tests
execute the fixed source directly.

The new private app was built from the fix, with only the attested fake Drive
composition override. Both task-owned databases matched the complete clean
51-table/15-metadata baseline before writes. Earlier failed copies/builds and the
original recovery containers were preserved. The app still used the restricted
copy login, fresh UUID, loopback allowlist and fake-only providers.

The real SQL/HTTP **WT06 checks passed**: overlapping pages create two unique
receipts and exact sale/refund/stock totals; replay adds no calls or rows; a
conflicting batch and a provider failure leave no business/revision/command delta;
corrected fake pages retry successfully with the same key. This resolves the
initial overlap blocker in both normal storage paths without weakening constraints.

The broader rerun attempted 13 case families / 281 HTTP requests, including 69
entry-gate checks and 25 ordinary mutation concurrency/replay/conflict proofs.
It then **stopped at WT12**: `DELETE /api/sales/profit-summary/cost-overrides`
returns 500. The existing cost-override adapter clears its row (including ID),
while its SQL binding lacks `clearAsArchive`, so `PostgresRecords` refuses it with
“Business identity cannot change.” The failed operation leaves no command or
revision change. This separate binding defect is recorded, not repaired in the
receipt fix. Browser/restart/fault/concurrency remainder, the second clean run,
capacity and complete mandatory variants remain BLOCKED. No full write acceptance
or hosted readiness is claimed.

After stopping the app, all **70,777 original copied business rows** still match;
the archive's 24 tables and all 15 security/metadata sections are unchanged.
The generated checkpoint restores to a fresh task-owned database with all 51
hashes/15 metadata sections equal in **4.38 seconds**, with zero checkpoint loss
and no provider replay. The second copy remains pristine. All 51 protected hosted
table hashes and 15 metadata sections match before/after. Production environment
metadata is unchanged with no `STOCK_*` overrides; Google Sheets stays active.
Zero hosted writes, real-provider requests, production-data requests or existing
recovery-resource mutations were performed.

Final local checks: **571 regression tests (565 prior + six new), nine harness
checks, lint/typecheck and isolated credential-free production build pass**.
Only the inherited shipmentRow lint warning remains. Build inputs match final
source and the app-paths manifest retains
`32f92c7a1ef17213d7a8642ca89e3e71218984982bf1bdce66b560ef35893e1e`.
The draft [PR #62](https://github.com/volkswg/stock-management/pull/62) includes
the fix/harness/results and is not merged. Actual rerun harness commit is
`141bc9c`; private result receipt SHA-256 is
`3984fae4a052a04e9f6f71d8c95f7006705b502f681c7b6d52af8889ebc59298`.
Raw records, credentials, backups, requests, screenshots and logs remain private.
Next, scope the cost-override archive binding fix and rerun both clean campaigns;
production activation remains a separate owner decision.

##### Local execution result (2026-11-11)

A fresh PostgreSQL 17 cluster, volume, TLS certificate, passwords and copy UUID
were created with a 1 GiB memory limit and 1.5 CPUs. The two existing recovery
containers were preserved. The independently recovered post-audit backup was
checksum-verified and restored: all **51 tables and 15 metadata sections** matched
before setup, including **70,777 business records**. Setup changed only the new
copy's environment UUID and the enumerated runtime-login/membership metadata.
Two clean campaign databases were prepared; the app used a fresh restricted
login able to SET `stock_runtime`, with no owner/BYPASSRLS privileges.

`tools/migration/local-write/` supplies a manifest/UUID/loopback allowlist,
independent socket/fetch denial, deterministic fake LINE/Loyverse/Drive providers,
private ledgers/fault controls, an offline Sheets-compatible oracle and an actual
HTTP/SQL/browser campaign. `build-app.cjs` creates a separate credential-free
build: one Drive-factory override and additional private preload/proxy files;
443 other source/assets remain byte-identical and 113 client chunks were checked.
Neither this code nor its write flag is imported by the production app.

| Check | Observed result |
| --- | --- |
| Local runtime privileges, wrong target/UUID, untrusted TLS, production guard | Passed; refusal before mutation and restricted role access verified |
| HTTP entry gates | 69 checks passed, including all 31 ordinary mutation methods and signed LINE entrypoint; hosted Data API/protection not run |
| WT06 overlapping fake receipt pages | **FAIL**: two pages contain one repeated sale plus one refund; local SQL returns 502 on `sales_receipts_pkey` rather than completing a unique-receipt sync |
| Failed sync atomicity | All 51 table hashes and 15 metadata sections still match the clean copy baseline; no partial receipt, sync, command, effect or revision committed |
| Existing Sheets-compatible rules with identical fake pages | Three rows / two distinct receipt identities; synthetic net sales 180 versus the independent unique-receipt control of 80. The underlying overlap defect predates Supabase |
| Generated-state recovery | A preserved earlier exploratory checkpoint with synthetic writes/commands/effects was backed up and restored to a fresh local database; all 51 tables/15 metadata sections matched in 3.2 seconds. No provider replay |
| Protected original staging and production configuration | All 51 hosted table hashes and 15 metadata sections match before/after; production environment metadata is unchanged, has no `STOCK_*` overrides, and still defaults to Sheets |

The required integrity stop is enforced: the app is stopped, resources/evidence
are retained and the second clean copy remains pristine. **Zero complete passing
functional campaigns** are claimed. The 20-pair concurrency, ten-trial fault and
restart/browser repetitions, capacity workload and complete WT02–15 variants
remain BLOCKED/not run after the stop; hosted acceptance is NOT RUN. Exploratory
orders/images, shipments, expenses, attendance/payroll, movement/stock and
nonoverlapping sync checks are narrower evidence, not complete family passes.
Five fixture-development attempts were preserved separately. Corrections matched
existing signed-auth, attendance, month-selected payroll rate, delivery-month and
receipt-field contracts; no application rules were changed to make tests pass.

Local verification: 565 existing regression tests and eight harness safety/oracle
checks pass; lint/typecheck and isolated credential-free production build pass
with the inherited unused `shipmentRow` lint warning only. CI runs the secret-free
harness self-tests; it never receives this copy, backup, credentials or business
records and does not execute this private acceptance campaign. Original
routes/fixtures/schema/business source and `yarn.lock` remain unchanged.

Private result receipt SHA-256:
`8a70527cd5fe0b49a6bcdf8b5853c2963937cb4df149e1692061efada304983a`.
Operational execution used harness commit `1eb8769`; subsequent formatting has a
retained syntax-equivalence proof. Raw requests, screenshots, SQL/provider logs,
manifest, connection profiles and backups remain private outside Git.
No hosted write, original recovery-resource mutation, real provider request,
production data request or storage switch occurred.

The initial follow-up was to scope the receipt identity/deduplication/conflict
policy and rerun; the subsequently authorized fix and new WT12 stop are recorded
above. Both clean campaigns and outstanding variants still require completion. Do not weaken the SQL identity constraint or mark the
rollback-only result a successful sync. Hosted provisioning/acceptance and
production activation still require separate authorization.

To review the harness without private data, run
`node --test tools/migration/local-write/guard.test.cjs tools/migration/local-write/oracle.test.cjs`.
For a future explicitly authorized local rerun, restore/reseal fresh copy baselines
first, build a **new** private app destination with `build-app.cjs`, pin its
attestation/runtime/manifest hashes, start it with only the new copy environment
and its `__local-write-harness/preload.cjs`, then invoke `campaign.cjs` with the
private manifest directory and exact approved campaign database. The current
execution layout uses sibling `app-v3`; review that path before reuse. The runner
never provisions or defaults to a hosted target. Keep failed attempts and inspect
private per-case results; unsupported/unimplemented variants remain BLOCKED.

##### Scope and target selection

Use a new disposable database **cluster**, new credentials and a separate test
app. First rehearse locally with PostgreSQL 17 and the real Next.js app. Then
repeat the mandatory cases in a separately approved Supabase project and
protected Vercel **preview** before claiming hosted write acceptance. A local
database pass alone does not certify hosted roles, TLS, pooling or protection.
Hosted project identity, region, quota and any cost must be approved before
provisioning; this plan makes no assumption about available free projects.

Neither a second schema nor another database in the existing hosted project is
an acceptable substitute: schema names are fixed and roles are cluster-wide.
Do not reuse existing recovery containers, databases or volumes as writable
fixtures. A new local cluster must have its own data volume and bounded resources.
The original Supabase project `orjnazrothkdgmzlsuto`, its direct/pooler identity,
isolation UUID `160669bd-2f6f-4490-9259-bada5a1d02c4`, the existing read-only
preview and production domains are explicitly forbidden mutation targets.
The existing staging login must retain its SELECT-only grants and read-only flag.

Before execution, seal a private manifest containing:

- The execution approval, operator, business reviewer and recovery reviewer;
  exact source commit, CI link and test-harness commit. Any harness changes need
  their own reviewed tests; none are implemented by this plan.
- Verified backup generation, encrypted-file and dump checksums, decryption and
  independent-restore receipts, source fingerprint format and ledger provenance.
  Use the verified **post-audit-removal** backup; do not restore the old audit
  layout. No new live Sheet export is needed for this rehearsal.
- Exact destination project/cluster, host, database, region, TLS hostname/CA,
  container/volume IDs for local work, new isolation UUID, separate preview
  project/deployment/origin, resource/cost limit and credential references.
  Hosted IDs are intentionally unset until approved; unset or ambiguous means
  **BLOCKED**, never default to a linked project or a cached service profile.
- Test-case versions, seed/checkpoint hashes, permitted changed rows/tables per
  case, fake-provider identities, clock/ID strategy, workloads and the thresholds
  below. Record timestamps in UTC and Asia/Bangkok. Keep secrets out of the manifest.

##### Entry gates — all required before the first test write

1. **Restore and prove the baseline.** Verify the existing encrypted backup and
   recovery receipts without replacing them. Decrypt only into restricted
   encrypted operator storage and restore to the newly identified empty target.
   Recreate only reviewed private-schema dependencies from password-free role
   metadata, with fresh passwords; do not import production/provider credentials
   or blindly replay platform-role administration. Compare all 51 table hashes,
   all 15 metadata sections and migration provenance against that backup before
   enabling the app. Stop on unexplained differences; do not weaken RLS, ownership
   or grants to make restoration pass. Any target-specific role mapping must be
   enumerated and reviewed, not hidden by excluding security metadata.
2. **Give only the copy a new identity.** While its app is disabled, change the
   copy's environment UUID to a fresh value and retain purpose `isolated-staging`.
   Record that one expected setup-row delta. The 23 business tables and 70,777
   records must still match the backup before test seeding. Seal a new complete
   copy baseline, including exact role/policy and environment differences.
   Recreated login/setup metadata is not a business-data mismatch exemption.
3. **Separate every connection.** Source verification, if authorized, runs in a
   separate read-only operator process; source connection files/passwords never
   enter the write runner, app, build or clone. No application `.env` files or
   private account worksheet are copied. Allow only the exact destination
   project/host/database/UUID and preview origin. Validate identities before any
   restore, role setup, reset, mutation or cleanup; deliberately wrong IDs must
   fail without connecting to a protected target. Test rejection with fakes or
   clone-only mismatches, never by sending a write to the original database.
4. **Use ordinary runtime privileges.** On the copy only, provision a fresh
   non-owner, non-superuser, non-BYPASSRLS login able to SET the reviewed
   `stock_runtime` role without inheriting or administering it. Preserve that
   role's existing restricted grants/policies; no blanket table/schema grants.
   Use an owner connection only for explicit copy setup/restore/fault injection.
   The application receives only the copy login, a fresh scoped operator token
   and its UUID. Validate RLS and archive/private Data API denial independently.
5. **Enable writes only in the new app.** Set `STOCK_STORAGE=supabase` and
   `STOCK_STAGING_ENABLED=true`; disable `STOCK_STAGING_READ_ONLY` only there.
   Keep the existing app/login read-only. For local loopback only, explicitly
   enable `STOCK_ALLOW_LOCAL_TEST_DATABASE`; hosted uses verified TLS and the
   dashboard-confirmed pooler. Use an actual Vercel preview environment; do not
   spoof `VERCEL_ENV` to bypass the production guard. Exclude DB/auth/account
   values from the build process and scan client bundles for secrets.
6. **Prove provider isolation separately.** PR #60's fetch guard is conditional
   on the read-only flag, so switching that flag off is **not** safe by itself.
   A reviewed test-only composition must supply deterministic fake LINE,
   Loyverse and Drive adapters and a provider-denial control independent of the
   write flag. It must cover server fetch, SDK HTTP/HTTPS, redirects, background
   jobs and browser requests while permitting only the exact copy database and
   approved test origin. Prove unknown-host and redirect refusal before writes;
   dummy tokens alone are insufficient. If the hosting setup cannot enforce
   this boundary, hosted write testing is BLOCKED. Never repoint the existing
   readonly runner or remove the current preview's guard to obtain coverage.
7. **Record protected-state evidence.** With separately approved read-only
   access, fingerprint the original hosted staging tables/metadata immediately
   before and after the campaign. Require exact equality, including revision,
   command and side-effect state. Check production storage configuration remains
   Sheets and has no test credentials. Do not freeze, export or probe production
   Sheets/provider data for this campaign; normal owner activity may continue.

The shared staging actor/token is sufficient only for trusted operator tests.
Production identity, HR/payroll authorization, attribution and CSRF remain a
separate release gate; do not label operator-token testing production security.

##### Test data, runner and comparison rules

Run each case from a documented checkpoint. Seed uniquely named synthetic
entities/events in the copy; keep an explicit ledger for any copied historical
row selected for a legacy-update test. Never replay imported LINE sessions,
real reply tokens or real receipt-sync events. Provider fakes return deterministic
pages, refunds, files, replies and injected failures, and retain a separate
attempt/outcome ledger. External services receive **zero** requests in this phase.

Use the existing unchanged application rules with in-memory Sheets-compatible
fixtures as the write oracle, plus independently calculated stock/financial
control totals. No live Sheets writer is an oracle. Preserve real SQL adapters,
transactions, HTTP routes and React UI; do not mock the operation under test.
The existing synthetic Orders bridge and read-only runner are starting evidence,
not the full write-acceptance harness. Build the missing harness before execution.

Use fixed clocks/IDs where supported by existing ports. Otherwise capture new
IDs/timestamps and map only those declared nondeterministic fields, checking
uniqueness, format, relationship propagation and Bangkok boundaries separately.
Never normalize away money, quantities, identities of existing rows, ordering,
null/blank distinctions, statuses, historical dates, headers or error contracts.
Compare response/status, persisted rows, relationships, reports, command/effect
records and fake-provider calls after success, failure, retry and restart.

##### Mandatory acceptance matrix

Each row is a required case family, including its success, rejection and retry
variants. Run each functional family from a clean checkpoint at least twice.
Any unimplemented, skipped, flaky or unverified mandatory variant is **BLOCKED**,
not PASS. Exact existing route status/body contracts remain authoritative except
for the specifically stated persistence errors below.

| ID | Exercise on the disposable copy | PASS only when |
| --- | --- | --- |
| WT00 | Target/UUID/role/TLS/protection gates; simulate forbidden target selection | Every mismatch stops before mutation; protected targets are never contacted by the write runner; valid copy access uses the ordinary runtime login and exact approved origin. |
| WT01 | Missing/wrong API token, forged LINE-path bypass, production guard, denied direct SQL/Data API access | API token errors are 401; production/identity guard failures are 503; invalid LINE signatures are 401. No business or command/effect mutation occurs. Archive access, elevated roles and exposed private schemas remain denied. |
| WT02 | Orders/items/bills: create, change price/quantity/remark, cancel and soft delete; legacy links | Exact approved statuses, amounts, items and historical relationships match the oracle; cancelled/soft-deleted history is retained; rejected inputs leave no partial rows. A new intentional identical order has a distinct ID/key. |
| WT03 | Shipments: create, link/unlink orders, valid/invalid transitions, cancellation and bill association | Link/status/history rules and fees match; duplicate links are rejected; no orphan/partial relationship or invalid transition commits; retries do not duplicate a shipment or fake bill upload. |
| WT04 | Movement journeys/items: quantities, delivery, zero/missing values and legacy journey transitions | Master/detail quantities and account stock effects match exactly; invalid/missing quantities cannot partially mark delivery; repeat delivery/retry has no second stock effect. |
| WT05 | Monthly stock counts, adjustment/reversal/replacement and cross-account cases | Opening + delivered stock − net sales − other out + returned in reconciles per account/month; saved physical counts and variances match; reversal changes stock once and preserves original history. |
| WT06 | Fake sales sync with pagination, overlapping/repeated pages, refunds, cancellations, store/date filters and failure mid-sync | Receipt/item/payment/sync identities and counts are exact; retry is not additive; partial sync never reports complete; dashboard, stock-out, profit and cost overrides match the oracle. |
| WT07 | Employee changes/effective compensation; Bangkok clock-in/out, leave, half days and duplicate dates | Compensation history, attendance uniqueness and day/shop attribution match; invalid changes are atomic; month/date-boundary results are exact. |
| WT08 | Salary advances: create/pay/cancel; payroll/commission and settlement, including stale revisions | Base pay, commissions, deductions, recovered/outstanding advances and settlement snapshots match exactly; cancellation/replay cannot pay, deduct or recover twice; settled history remains intact. |
| WT09 | Expenses, categories and shops: create/edit, inactive/soft-delete, account mappings and monthly reports | Amounts, preserved names/history and account mappings match; totals agree by month/shop/category and with profit; invalid mappings and failed writes leave no partial ledger/master changes. |
| WT10 | Fake Drive/photo/bill flows: valid/invalid MIME/size, multiple files, upload/DB failures and retry | Only the fake ledger is contacted; accepted references resolve to fake IDs, rejected files add no rows, historical real references are not fetched/rewritten, and uncertain/orphan outcomes are recorded without blind re-upload. |
| WT11 | Fake LINE text/photo/multi-event journeys, regrouped redelivery and cleared/failed sessions | Valid signatures use only synthetic users/events; logical events commit once despite regrouping; failed SQL can retry safely; fake replies are attempted at most once and uncertain outcomes are surfaced. |
| WT12 | Missing/malformed operation key, same key/body, changed body/query/file and stale `If-Match` | Missing/malformed key gives 428; reused key with different intent and a fresh operation with stale revision give 409 with no business delta. A completed retry reproduces original stored status/body/headers and adds no business rows or effects. |
| WT13 | Double click, tab reload, response drop after commit, ambiguous commit acknowledgement and process restart | The browser retains the same pending key across uncertainty; retry resolves the existing command/result. Exactly one logical command commits; an intentional later action gets a new key. No blind new-key retry or Sheets fallback occurs. |
| WT14 | Parallel edits/creates and forced multi-table SQL failure before commit | No lost update/overdraw/duplicate link; stale edit is rejected or serialized per existing contract. Forced rollback restores every affected business row, revision and command journal; unrelated rows and archive are unchanged. |
| WT15 | Crash before/after fake reply/send, `sending`/`uncertain` outcomes, then full backup/restore of generated state | A committed business command is not repeated. Uncertain/sending effects remain visible and are never auto-resent. Fresh recovery matches all 51 tables/15 metadata sections, including commands/effects, against its sealed checkpoint. |

WT12–14 apply to **every ordinary exported mutation method**, not Orders alone.
Inventory all 35 API files and their exported methods at the pinned commit.
LINE's signature-verified entrypoint uses durable logical-event keys rather than
the ordinary API's bearer/`Idempotency-Key` contract; exercise the equivalent
redelivery/uncertainty protections through WT11/13. Record every route exception.
Repeat multipart and query-intent cases with their actual endpoints.
No success may be inferred just from an HTTP 2xx.
An HTTP error is not proof that a transaction failed to commit.

Revision advances once per mutating SQL **statement**, not once per logical
business command. Assert the expected statement-level change and persisted row
revisions for a new operation; replay/rollback must not advance the current
counter. A replay returns its original stored response revision even if unrelated
later commands advanced the counter. Do not weaken these checks to “value grew.”
Keep stock/financial effects attributable to each command exactly once.

For pre-commit SQL failures, business rows, revision and that command insertion
roll back together. For post-commit provider failures, preserve the committed
business outcome and durable `sending`/`uncertain` state. There is no atomic
database/provider transaction or guaranteed reply delivery. Never delete journal
rows, replace event IDs or mark uncertain sends successful to make a retry pass.

##### Performance and recovery acceptance limits

These are proposed bounded **rehearsal** criteria to accept in the execution
manifest, not an assertion about production peak load or an approved paid plan.
An altered threshold needs an explicit recorded decision before testing; do not
relax it after a failure and keep the original PASS label.

| Check | Proposed PASS threshold |
| --- | --- |
| Correctness | Zero unexplained response/data/control-total differences; zero duplicate commands/business effects; zero partial multi-table commits; zero unauthorized writes or external requests. No rounding tolerance beyond the existing application rules. |
| Repetition/faults | Two clean functional campaigns; at least 20 same-key concurrent pairs, 20 stale-edit pairs, and 10 trials each of pre-commit rollback, post-commit response loss and restart/uncertain-effect scenarios. All trials satisfy WT12–15. |
| Bounded load | On the hosted copy, first one then five simultaneous operator clients for 10 minutes at each level using the sealed read/write mix. Warm read p95 ≤ 2 s, simple-save p95 ≤ 3 s, compound/fake-provider-save p95 ≤ 5 s, and no request > 10 s. Measure cold starts separately. |
| Reliability/headroom | Zero unexpected 5xx/timeouts, deadlocks or connection-limit errors in the non-fault workload; expected injected errors/conflicts counted separately. Keep at least 20% of approved connection/storage/memory budgets free, with no OOM/restart. Stop before exceeding the manifest's cost/resource limit. |
| Recovery | Stop copy ingress/providers, drain or record uncertain work, capture a consistent generated-state backup, and restore to another new isolated target. All table/metadata hashes and command/effect outcomes match; proposed RTO ≤ 15 minutes from declared recovery start to verified readiness. RPO is zero only for acknowledged work included in the sealed checkpoint; later writes must be explicitly reconciled, never silently discarded. |
| Protected environments | Original hosted staging's 51 table hashes and 15 metadata sections, including revision/journals/permissions, equal their pre-campaign snapshot. Production configuration remains Sheets. Runner/provider request ledgers show zero access to production services or protected mutation targets. |

Use the actual full-size saved data for the hosted load/recovery runs; synthetic
empty-database performance is insufficient. Record exact hardware/plan, region,
pooler, active connections, test mix, warmups, p50/p95/p99/max and failed requests.
The small PR #60 read sample is a comparison point, not a peak-capacity approval.
Production workload expectations and recovery objectives still need Gate 4/6
sign-off, even if these rehearsal limits pass.

##### Evidence, stop rules and completion

Keep per-case expected/actual deltas, response comparisons, DB fingerprints,
operation keys/revisions, fake-provider attempt counts, fault timing, browser
desktop/mobile screenshots, performance samples and restore receipts in private
encrypted operator storage (0600 files/0700 directories). Cover complete flows
in the real UI, including keyboard/mobile submits, refresh/reload and visible
failure/retry messages. API and SQL coverage cannot stand in for UI coverage.
Publish only case IDs, counts, outcomes, sanitized failures, commit/CI links and
artifact checksums. Do not publish business values, tokens, SQL binds, raw errors,
HAR/traces or copied session state to Git/ordinary logs.

Stop immediately on any target ambiguity, unexpected source delta, provider
egress, permission leak, missing baseline, integrity failure, unexplained total,
duplicate business effect, orphan outcome requiring reconciliation, budget breach
or failed recovery. Disable only the **new copy's** ingress/runner, preserve its
evidence and ambiguous journals, and investigate. Do not “repair” the original
staging database, rotate its login, change production, automatically fall back
to Sheets or rerun an uncertain operation with a fresh key.

Reset only the disposable target from its approved checkpoint after recording
the failure and confirming target identity again. Use a paired fresh fake ledger
per run; do not erase evidence of uncertain effects. Retest the failed case and
affected cases after a reviewed fix. Never overwrite the reference backup or
delete shared recovery resources. Cleanup is limited to exact resources listed
as disposable in the execution approval; retain the final evidence/recovery set.

The operator and business reviewer sign the case/control-total results; the
recovery reviewer signs isolation and restoration evidence. Report one of:

- **PASS — disposable write rehearsal only:** every mandatory local and hosted
  case, browser flow, protected-state comparison, performance and recovery check
  passed; all differences explained and no unresolved failure/skip remains.
- **FAIL:** a mandatory assertion failed. Preserve its evidence and block further
  acceptance until reviewed remediation and rerun succeed.
- **BLOCKED / NOT RUN:** missing approval, destination/cost identity, harness,
  provider isolation, comparator, evidence or unexecuted mandatory case. This
  must never be presented as a partial PASS or as readiness to switch production.

Deliver a signed private execution packet and a sanitized case summary. Any
real-provider integration test requires separately approved test channel/shop/
folder and recipients after this fake-provider campaign; it is not certified by
this plan. Production still needs Gates 4/6–8, including production authorization,
source refresh/freeze, final reconciliation and post-cutover-write recovery.
No clone, restore, deployment, role grant or acceptance write is authorized or
performed by preparing this document.

Platform references checked for this plan: Supabase's
[backup/restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
describes migration-history handling, fresh custom-role passwords and separate
platform/storage concerns. The existing verified private-schema recovery process
remains authoritative here; do not copy broad platform restore commands from a
guide. Recheck [CLI v3 targeting changes](https://supabase.com/changelog/supabase-cli-v3)
and installed command help before any separately authorized execution.

### Gate 6 — backup/restore and recovery sign-off

The reusable capture/verification tool was exercised on local synthetic promoted
and application-generated states. It uses an exported PostgreSQL snapshot shared
with pg_dump and fingerprints, holding both cooperative writer locks until
completion. The snapshot starts after earlier writers drain. It compares all
51 tables and schema/column/constraint/index/trigger/function/sequence metadata,
effective ACLs, RLS, runtime role flags/memberships and defaults. Equivalent NULL
and explicit default ACL representations are normalized; actual grant changes
fail. No private row/SQL/error body is emitted to ordinary logs.

Fingerprints retain the original character-length-prefixed UTF8 text, C ordering,
row counts and receipt format. Ordinary rows are serialized once and streamed
with binary COPY into the client hash. The complete `import_batches.snapshot`
is read as object fields, array partitions and string segments, then reconstructed
with PostgreSQL's JSONB key order, spacing and exact numeric text. Its full row
is spooled privately to determine the character-length prefix before hashing.
No raw/formatted/formula/source-extension field is omitted.

For high-latency hosted verification, the reviewed recovery tool also supports
explicit `--workers 2 --row-digests`. At most two fresh table readers share the
same exported snapshot, identity/TLS guards, writer locks and original 150-second
deadline. One reader remains the default. Fresh backends retain the existing
memory-release behavior; this does not create a persistent connection pool.

`--row-digests` is an explicit version 2 fingerprint format, not a silent change
to historical hashes. PostgreSQL hashes every canonical full-row UTF8 value with
SHA256, sorts the fixed-size row hashes, and streams them to a domain-separated
client SHA256. Duplicate rows remain repeated and row counts are retained. All
columns, NULLs, exact numeric values, original cells and business metadata are
included. Ordinary tables carry the algorithm tag; the full import-batch snapshot
keeps its existing lossless partitioned fingerprint path. Receipt version 2 names
the format, and verification refuses a mismatched format before connecting.
Serial and bounded-reader output agree; synthetic PostgreSQL checks compare the
compact result against an independent Python oracle over full canonical rows.
This reduces full-record network transfer and sort width without reducing
verification coverage. The legacy fingerprint format remains available by default.

`--history audit` explicitly selects the pre-removal schema; the default remains
`--history revision`. The selected table must exist and the other must be absent;
there is no fallback. This permits a fresh verified backup before audit removal.
Historical backups still require their pinned tool version when their metadata
fingerprint shape differs (for example before column-ACL coverage was added).
Each new encrypted backup retains its exact recovery-tool sources and checksums.

All table reads share the same held exported snapshot and both cooperative
writer locks. Short-lived reader backends release large allocation arenas;
the original 120-second statement and 150-second overall fingerprint limits,
UUID/purpose/TLS checks and all 15 metadata sections remain. Every reader forces
UTF8. Metadata, ownership, RLS, policies, ACLs, memberships and sequences are
compared as before. The old SQL fingerprint remains an independent compatibility
oracle for synthetic fixtures, not the production hash path.

Archive extraction likewise verifies the checksum/workbook and compares the
**entire** stored snapshot on the client inside one locked read-only transaction,
without submitting that snapshot as a large SQL literal. Numeric equality is
exact and ignores insignificant scale as JSONB does; booleans remain distinct
from numbers. Individual typed/raw row assertions still follow full binding.
Use an encrypted operator disk and private temporary directory: temporary
spools contain plaintext and are removed when closed; retained artifacts still
require their own approved retention/cleanup procedure.

`bash tools/migration/verify-recovery-fingerprints.sh` uses a separate synthetic
PostgreSQL 17 container with no network/published ports and a 2 GiB cap. The
legacy SQL checks and `jsonb-stream-integration.py` compare original/candidate
hashes, C order, duplicate/null/Unicode/exact-number cases, array/string partition
boundaries and rejection of a formula changed behind unchanged batch metadata.
The runner never connects to operator services or changes existing containers.

An optional `migrate.py plan --snapshot-encoding gzip-json-v1` stores the full
canonical source in a lossless gzip/base64 envelope inside the existing JSONB
snapshot column. It requires separate approval of that generated plan; the
default remains `plain-jsonb` and never converts existing batches. Table schemas,
roles, policies, indexes and business rows do not change. The batch checksum
still identifies the complete original canonical source. Reading accepts both
formats, bounds decompression using the independently supplied source's exact
byte length, rejects malformed/truncated/trailing streams, verifies SHA256 and
compares every decoded value before reading business rows. Compression does not
encrypt data; retain the existing private access and encrypted backup controls.

A newly encoded batch has a different stored snapshot representation and hence
a different physical row fingerprint. The fingerprint algorithm itself is
unchanged and matches the original SQL oracle for both representations. Existing
raw batches and backup receipts retain their hashes and readability. Never use
this option silently to bypass an approved same-payload rehearsal plan.

The synthetic runner also tests an input containing millions of JSON values,
then lowers **only its own disposable container** to 500,000,000 bytes with no
additional swap, captures and independently restores the compact table, and
compares its original SQL hash plus every decoded source field. It checks zero
OOM/restarts and sampled working memory below 425,000,000 bytes. The source-like
settings include 224 MB shared buffers; fixture evidence is not hosted capacity
or real-data acceptance.

Partitioning reduces verification memory; it does not certify arbitrary row
sizes, import SQL, pg_dump/restore, hosted capacity or application load. Require
a separately approved, source-matched memory-capped full import/promotion,
reconciliation, capture and independent restore rehearsal before claiming that
a plan or compute tier is compatible. Stop on OOM, backend restart, mismatch,
timeout or insufficient headroom; preserve failed resources and artifacts.

After explicit hosted backup/read approval and a verified private service:

```sh
python3 tools/migration/recovery.py capture --directory migration-artifacts/accepted-backup --target-id APPROVED_ISOLATION_UUID
# Only after separate restore-target approval and empty-target verification:
pg_restore --single-transaction --exit-on-error --dbname=service=APPROVED_EMPTY_RESTORE_SERVICE migration-artifacts/accepted-backup/database.dump >/dev/null 2>&1 || { echo 'Restore failed; stop and inspect privately.'; exit 1; }
# PGSERVICE now selects that approved restore endpoint, not the source:
python3 tools/migration/recovery.py verify --directory migration-artifacts/accepted-backup --target-id APPROVED_ISOLATION_UUID --output migration-artifacts/restore-verification.json
```

The backup directory is exclusive-create 0700 and files 0600, with streaming
SHA256 receipts and archive readability checks. An incomplete directory is
quarantined; rerun into a new path after resolving the error. Capture explicitly
does **not** claim encryption or successful restore. Verification checks artifact
checksums before connecting, then compares the restored state under guarded
read-only snapshots. A mismatch exits nonzero. The synthetic rehearsal also
changes restored grants/records and proves those checks reject the changes.
Direct owner SQL outside the writer protocol and hosted DDL must remain frozen.
No tool provisions roles, restores over a database, encrypts artifacts or proves
off-site key recovery. Recreate the same role names/flags/grants from an approved
private role plan with separately provisioned passwords; global roles are not
part of these schema dumps. The restored UUID is intentionally still the source
UUID during comparison; isolate endpoints/credentials and retarget only after
verification. Never expose a restored clone merely because its UUID matches.

- [ ] Dump **both** schemas, commands/revision/side_effects/environment, sequences,
  triggers/functions, constraints, privileges and policies using PostgreSQL tools
  compatible with the target version. Preserve role definitions separately;
  recreate custom-role passwords from the secret store, never dump them to Git.
  Example after approval: `pg_dump -Fc -n stock_migration -n stock_operational
  -f migration-artifacts/accepted.dump`. Verify exit status, SHA256 and encryption.
- [ ] Restore the dump into a new approved empty target with the required roles
  using pg_restore --single-transaction --exit-on-error. Never restore over the
  source or production. Compare all records/fingerprints, typed/raw values,
  identities/totals, sequence positions, journal/effect states, triggers,
  constraints, indexes, RLS/grants and migration ledger. Re-run runtime auth and
  denied-write checks with a newly provisioned least-privilege login.
- [ ] Isolate restored environment UUID/credentials before exposing an app;
  restoring environment metadata duplicates its UUID, so UUID alone does not
  distinguish clones. Record endpoint+UUID+credential approval together; a new
  UUID needs an explicit owner-only operation and must be retested.
- [ ] Rehearse application-generated state as well as pristine promotion,
  including committed command replay and uncertain effects. No real messages,
  uploads or syncs may fire during restore testing. Compare off-site artifact
  decryption and measured RTO/RPO with approved targets. Recovery failure stops.
  Database backups do not include Drive images or provider delivery outcomes.

### Gate 7 — final freeze and delta review (separate cutover approval)

- [ ] Resolve production auth/config/monitoring prerequisites and approve a
  maintenance window with named abort/decision times. Retain an untouched native
  Sheets backup; do not delete legacy data or revoke source read access prematurely.
- [ ] Block all business writers at ingress and manual worksheet permissions:
  browser/API clients, scripts, scheduled Loyverse sync, LINE webhook consumption
  and in-flight workers. Drain active requests; record provider cursors/event IDs,
  unfinished sessions, pending keys and external outcomes. Use an owner-approved
  durable provider hold/retry procedure; never acknowledge/drop events without
  storing them safely. Verify zero new source changes across the final capture.
- [ ] Export a **final full snapshot** under the same read-only procedure and
  repeat profiling. Compare the rehearsed and final artifacts offline:

```sh
python3 tools/migration/phase3.py delta-review migration-artifacts/source.json migration-artifacts/final.json --output migration-artifacts/delta-review.json
```

The report classifies added, removed, changed and moved IDs and flags positional
compensation identities. It writes no SQL and never applies a delta. **Changed,
deleted or reordered source rows cannot be merged by the append-only importer.**
The supported final-load strategy is to deploy a fresh approved empty target,
import the final full snapshot and promote/reconcile it atomically. Keep the
rehearsal target for evidence. Do not clear schemas or reuse mutable acceptance
data. If the window cannot accommodate a complete final load, cutover is blocked
until a separately reviewed CDC/delta design exists. A matching final export is
not permission to run undocumented in-place updates.

- [ ] Repeat Gates 2–6 on the final target; acceptance mutations belong on a clone,
  not the final database. Seal source checksum, target/UUID, commit, backup,
  reconciliation, auth/performance/recovery evidence and owner signature.
- [ ] Abort if freeze cannot be proved, any record/total differs, capacity is
  insufficient, provider events cannot be held/replayed safely, or recovery fails.
  Leave Sheets as the authoritative store and re-open only its writers after
  recording/disposing of queued events without duplicate delivery.

### Gate 8 — controlled activation, monitoring and rollback

This gate is not executable with PR49's production guard. Implement and review
production authorization/target selection first, then obtain separate owner
approval for production env changes/deployment. No Vercel setting changes occur
as part of this runbook preparation. Selection is deployment-level, not an atomic
cross-provider switch: a global write freeze is required to make it safe.

- [ ] Keep ingress frozen, verify no old deployment/scheduled/manual writer can
  write Sheets, and bind the approved release to exactly one final SQL target.
  Never dual-write. Confirm server-only pooled credentials, role restrictions,
  API identity/authorization, CSRF controls and client key persistence.
- [ ] Run authenticated **read-only** smoke/reconciliation checks while frozen.
  Promote traffic only after the incident lead's recorded go/no-go. Enable SQL
  writers once, then release held LINE/sync events with original durable keys.
  Every multi-table business command remains one PostgreSQL transaction; never
  retry an ambiguous write with a new key or switch storage on failure.
- [ ] Before activation, install/verify redacted monitoring: API error rate and
  latency, DB connections/lock waits/statement timeouts, disk/headroom/growth,
  backup freshness/restore failures, auth denials, stale/replayed/conflicting
  keys, terminal failed commands and sending/uncertain effects. Define thresholds,
  alert destinations/on-call, emergency writer-disable and secret rotation.
  Alerts must exclude record bodies, SQL bind values and bearer/DB credentials.
- [ ] Monitor exact day/shop/account financial and stock control totals during
  the agreed observation window. Critical auth, reconciliation, recovery or
  unexplained-total failures immediately freeze writers and trigger incident review.

Rollback decision table:

| Point | Safe action |
| --- | --- |
| Before SQL business writes | Keep ingress frozen, prove SQL has no post-freeze business commands, restore approved Sheets routing/config and resume its writers only after checking held events |
| After SQL writes, DB available | Freeze all writers; preserve a new backup, tombstones, journals/effects and provider outcomes. Prefer a reviewed forward fix against the same SQL state. Reconcile every post-cutover mutation before any return to Sheets |
| DB unavailable/corrupt | Freeze ingress/providers; recover the latest verified backup to an isolated target, reconcile commit/outcome uncertainty and data since backup, then obtain incident approval before traffic resumes |
| Return to Sheets after SQL writes | **Blocked:** no reverse-sync implementation exists. A separately reviewed reverse migration must preserve original IDs/history/soft deletes and financial/stock totals and prove replay outcomes before switching |

Never automatically fall back to stale Sheets, replay already-attempted provider
messages or restore over a live database. Backup restoration can lose newer
commits and rewind effect state; a caller's missing response does not imply its
transaction failed. Keep legacy records/backups for the owner-approved retention
period; deletion is separately authorized.

### Automation and acceptance evidence handoff

| Artifact/tool | Current automation | Remaining owner-approved work |
| --- | --- | --- |
| `migrate.py` | Read-only export dry-run/capture, strict append-only SQL planning, archive extraction and exact reconciliation | Frozen copy approval, source mapping/inventory, hosted execution |
| `profile.py` | Offline type/ID/FK/date/formula/numeric compatibility profile | Per-cell original-reader/business report parity and source defect resolution |
| `phase3.py` | Offline delta review; readonly operational extraction with target guard | No CDC/reverse-sync or production switch automation |
| `staging.py`, target template/status | Exact Tokyo deployment manifest/hashes, metadata-only inspection, explicit blocked/unknown execution record | Owner isolation/DDL approval, private Cloud connection/TLS/network provisioning |
| `acceptance.py`, `application-parity.cjs` | Private full 23-table report and original-application read/calculation comparison from frozen files, with coverage checks | Approved real artifacts, full historical period/account review and hosted runtime acceptance |
| `recovery.py` | Consistent snapshot backup, streaming receipts, 51-table/security/role/schema restoration comparison; mismatch rejection | Hosted backup/restore approval, same-role provisioning, encryption/off-site key recovery and measured RTO/RPO |
| `capacity.sql` | Read-only database/table/index size and connection/statistics capture | Real workload/region/pooler latency, growth, quota dashboard sign-off |
| `verify-postgres.sh`, `verify-operational.sh` | Disposable synthetic DBs, import/promotion, concurrency/replay/module checks, actual browser/API credential boundary and full logical recovery | Hosted role/TLS/isolation, real-data reconciliation and restore timings |
| `verify-build.sh`, GitHub Migration acceptance | Credential-free isolated build, client bundle boundary, synthetic regression and uploaded CI evidence | Private hosted full-application acceptance; production security/monitoring |

Hand the architect one signed packet: approvals/target identities, approved
commit+CI link, encrypted artifact manifest/checksums, source/profile resolutions,
all 23-table reconciliations, per-account business totals, complete acceptance
matrix, capacity/latency, restored-state comparisons/RTO/RPO, unresolved risks,
freeze/activation times, recovery owner and go/no-go. Any unchecked critical gate
means **no cutover**. PR49 can be reviewed as an isolated persistence milestone;
real-data/hosted/production acceptance remains pending separate authorization.
