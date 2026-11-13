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

**Current status: receipt overlap and cost-override deletion fixed; two clean-copy local runs pass all implemented checks. Full mandatory write acceptance remains incomplete.**
The owner subsequently authorized the disposable **local** copy, write harness
and tests. Hosted write testing and production activation remain unapproved.
The execution baseline is merged [PR #61](https://github.com/volkswg/stock-management/pull/61),
commit `dff802bfddf5c522c013262ba8e56ba9532a8221`. The plan below retains its
original requirements; a stopped/partial run is not full acceptance.
Google Sheets remains production's store.

##### Current migration go/no-go assessment (2026-11-12)

**Mode: SUPABASE MIGRATION-ONLY CUTOVER. Production activation: NO-GO.**
This is the single current readiness report for draft [PR65](https://github.com/volkswg/stock-management/pull/65).
The objective is the database switch. Stop unrelated refactoring, optional framework
features, additional planning PRs and repeated synthetic campaigns. Reuse accepted
evidence; repeat a check only after a relevant change, drift or failure. Keep PR65
draft/unmerged until separately approved. Google Sheets remains authoritative.

**Latest owner scope: preserve the application as-is and finish database migration.**
Keep current users, access behavior, screens, APIs and LINE workflows. Defer new
security controls, owner-only restrictions, login, sessions, roles and shop
authorization to the next phase. The earlier proposed interim admin-only policy
is withdrawn; no further audience decision is needed to continue migration work.
Preserve existing LINE signatures, staging restrictions, TLS and database
permissions. No access-protection implementation is part of this work. Production
activation still requires evidence that existing protection is effective; owner
risk acceptance alone does not establish that evidence. This does not block
independent database preparation or authorize live configuration changes.

**Owner scope update — database backup work deferred (2026-11-13).**
The owner says: “no need for db backup for now defer it to next phase”. Defer
further SQL backup/checkpoint work, backup automation, encrypted off-site delivery,
backup failure/freshness alerts and production recovery-objective certification.
These are **not current cutover prerequisites**. Preserve all existing verified
backups, recovery tools and restricted accounts; do not delete artifacts, disable
existing controls or label the deferred work PASS. Existing empty baseline recovery
covers schema/metadata, not new business writes after cutover. Ongoing recovery
coverage remains unproven until the deferred work is completed. Final source-copy/
export integrity, reconciliation, writer/event hold, existing security, incident
handling and explicit activation approval remain in scope. This is a scope change,
not authority to read fresh Sheets, change Vercel or switch production.

**Final empty production database prepared and verified (2026-11-13 Bangkok).**
`stock-management-production` (`hzynvirpedqnvtbifobx`) is ACTIVE_HEALTHY in
`volkswg's Org`, Tokyo, PostgreSQL `17.11.0.019`, Free / quoted **$0 per month**.
The disposable test `dcwyiayubrqdrloergax` remains paused with retained data/backups;
protected staging and live Vercel/Sheets are unchanged. This completes database
preparation, not source import, final deployment or activation.

- Exact new identity **`349b9289-f684-4ec5-ac22-924b2be1946b`**; database `postgres`,
  direct endpoint `db.hzynvirpedqnvtbifobx.supabase.co:5432`. Keep
  `purpose=isolated-staging` through the approved final import/reconciliation;
  production purpose is a later explicit owner-only change.
- All **six pinned source migrations**, **24 archive + 27 operational tables**, RLS
  on every private table, no operational audit table. The initial connector ledger
  timestamp is aligned once to its canonical source version only after exact SQL
  hash and empty-state checks; names/statements are preserved and the original
  connector receipt retained. Remaining schema and ledger writes commit together.
  Source files are unchanged, and all six actual versions now match the repository.
- The owner completes the private password helper. Automatic approval review then
  rejects the initial account setup before execution because earlier account
  approval covered only the test target. After **explicit approval of the new
  production roles**, native setup completes. Internal `stock_runtime` is NOLOGIN;
  persistent `stock_prod_runtime`/`stock_prod_reader`/`stock_prod_backup` have caps
  **6/6/2**, no administrator/CREATEDB/CREATEROLE/INHERIT/replication/BYPASSRLS flags. Writer
  assumes only the existing application role; readers have no writer membership.
  Passwords use native libpq SCRAM encoding and remain in private 0600 files, not
  SQL cleartext, Git, backup packages, logs or live Vercel configuration.
- All three actual native logins pass hostname/CA verification and server TLS;
  eight expected permission denials pass. A synthetic exact-decimal write is
  rolled back completely: **zero retained business/test rows, revision 0 and an
  unchanged order sequence**. All 51 table counts are unchanged. Anonymous and
  authenticated platform roles remain denied the private schemas. Security and
  health advisors report no findings.
- Actual current application owners on the Mac use only the new reader: missing
  bearer **401**, authorized empty Orders GET **200**, read-only POST **405**,
  actual verified TLS socket and zero provider calls. This is not final Vercel
  runtime proof. Existing application source is unchanged from CI48; no new user
  login/RBAC/shop authorization or optional framework is implemented.
- The restricted reader captures a consistent empty baseline in **246.994 s**.
  Its fresh network-isolated local restore matches **all 51 tables/15 metadata
  sections**; a subsequent hosted comparison also matches. Complete package:
  **14 pinned files**, no credentials/service files, manifest SHA-256
  `e0a495396f03c0960f3fd37b456fb300853882909077dbe2b258859bc668752a`;
  dump `c869bd1896790a725432bec411cea28b6c75fd96e0a25e0f8cb057382863a19f`.
  This proves the empty baseline, not encrypted off-site production recovery or
  activated automation/RPO/RTO. Retain the local count-query argument-limit/startup
  diagnostics and their passing corrections; do not repeat accepted write tests.
- Final observed size **14,939,827 bytes**, **14/60** connections, **zero** service
  sessions after drain. These are empty-target observations; final-load growth/
  hosting checks remain required. No paid upgrade, fresh Sheets read, provider
  invocation, production settings change, merge or cutover.

A private read-only production configuration is prepared with the exact endpoint,
UUID and restricted reader, but its deployment/source SHA remains unbound and it
is **not installed**. Both project ref and UUID are excluded from the old disabled
disposable campaign. Remaining work is M2/M6/M7/M8 plus the existing protection
assessment M1; M5 database backup work is owner-deferred to the next phase. No
new production-target creation/account approval is needed.
Completion receipt SHA-256: `4f85d888c06bac83569b71e590b6220eac7c2201555c898e594bbcf75124bd32`.

**Essential hosted PostgreSQL smoke completed (2026-11-13 Bangkok).**
The actual application route owners run from the operator Mac against the approved
managed target using its temporary runtime/observer accounts. No new hosted app,
coordinator, tunnel, paid resource or monitoring integration. Application source is
unchanged from `19d9ba1`; the bounded entrypoint is
[`hosted-postgres-smoke.cjs`](../tools/migration/hosted-postgres-smoke.cjs).

- Nine groups pass: target/expiry/headroom, missing staging bearer rejection,
  actual application socket CA/hostname and server TLS, LINE missing/wrong/tampered
  signatures and valid signed empty events, atomic business/journal rollback,
  five overlapping identical create requests committing once, changed-intent
  conflict and actual GET, read-only/wrong-UUID denial, archive/DELETE/owner-role
  denial. Native follow-up proves all three role denials are `42501` inside write
  transactions, rather than relying on a read-only transaction's refusal.
- Five concurrent retries complete in **4.528 seconds total**. This is a small
  correctness smoke, not throughput/sustained-load/resource certification.
- All **70,777 original business rows** and **47 archive/business table
  fingerprints** remain exact. Environment, revision, command and effect controls
  are separate. One synthetic order/complete command is retained on the disposable
  target; revision advances once to 70,779. Database size is **79,886,003 bytes**.
  Zero real-provider calls and zero open runtime sessions after drain.
- Retain harness diagnostics for pg's numeric socket form, diagnostic visibility
  after SET ROLE, and the final SQL alias case mismatch. All nine application
  checks and 47-table comparisons passed before that last alias assertion. Correct
  it and finish only postflight/stronger permission checks, without repeating
  committed writes. Composite private receipt SHA-256:
  `4d0cf4aad54cdcda951677febe51e3d8f841fce701463395c5eba838c7b73748`.

This closes the **essential managed PostgreSQL smoke**, not final Vercel networking/
browser acceptance, real provider delivery, sustained capacity, off-site backup
activation or production GO. Reuse the passing local browser/fault/recovery
evidence; check the final protected deployment's read-only database path once after
its exact target/configuration is approved. No deployment/provider call is approved.

**Current update CI verified.** [CI48](https://github.com/volkswg/stock-management/actions/runs/43342345150)
passes on executable commit `8ba836b9fdfd6f1affaf7f912128600dcd5ffc3b`:
625 regressions, 39 existing controls, 85 hosted controls, 73 Python checks,
PostgreSQL/browser/crash/recovery and restricted-backup checks, lint/typecheck,
credential-free build, unchanged routes/113 client chunks and report upload. All
20 downloaded reports, exact source SHA and archive SHA-256
`c6d46f670909f5401a2925d334fba66182e3fcce154e2c2c4825167ed7cf5346`
verify. Both retained 14-file backup packages rehash exactly. This report-only
follow-up reuses that executable evidence; it is not a new hosted write run or a
claim that CI48 tested a later documentation commit.

**Scope precedence:** extra monitoring tools, one-second telemetry, ten-second CPU
certification, more fault campaigns, a persistent coordinator/tunnel and a new
hosted test app are not prerequisites for this migration-only smoke. The old full
campaign stays disabled and its strict result is not relabeled PASS. Existing
dashboards plus bounded errors/connections/storage checks suffice for the small
smoke. Backup failure/freshness alerts are deferred with database backup work.
The executable operator sequence below supersedes older full-campaign proposals.

**Retained hosted database restore/recovery evidence (before essential smoke).**
The owner approved the new disposable Free target/test writes and three temporary
accounts. `sm-ha-20261112-f` (`dcwyiayubrqdrloergax`, Tokyo PostgreSQL
`17.11.0.019`) is separate from protected staging. The $0/month project quote is
not a full campaign/production quote. No existing staging data, new Sheets data,
production setting, paid resource, merge or cutover was changed.

- Rehashed all 14 pinned post-audit backup files. Native owner connection uses
  the user-prepared private 0600 service/passfile and verified direct TLS.
- Restored the original dump atomically in **94.702 seconds**. Two failed setup
  attempts rolled back: cleaning absent policies and excluding schema definitions
  with a restore filter. The corrected complete dump contains only the two
  approved private schemas and all 51 tables; no database/login creation.
- Pinned original verification matches **all 51 table fingerprints** and 13 of
  15 metadata sections. The raw original comparison deliberately remains
  `match=false` for `memberships`/`runtimeLogins`: each adds exactly the three
  explicitly approved temporary accounts and their managed-owner administration
  links, removes nothing, and changes no original role. Those enumerated deltas
  are independently checked; do not claim an unqualified original 15/15 match.
- Only after that review assigned the new test identity
  `5f63d064-9658-4440-bf87-b4279b08c806`, purpose `isolated-staging`, and approved
  reader policies/grants. The copied original UUID was used only for endpoint-
  isolated read-only comparison. Production purpose/release binding stays disabled.
- Runtime/observer/backup logins retain NOSUPERUSER/NOCREATEDB/NOCREATEROLE/
  NOINHERIT/NOREPLICATION/NOBYPASSRLS, connection limits 6/2/2 and their original
  less-than-24-hour expiry. No new administrator login. Runtime must explicitly
  assume `stock_runtime`; direct operational/archive reads, owner assumption and
  DELETE are denied. The other accounts cannot write or assume the writer role.
- Supabase refuses granting `pg_read_all_stats` through its normal owner. After
  explicit additional owner approval, the temporary observer inherits `pg_monitor`
  for read-only diagnostics; its login flags, connection limit and expiry remain
  unchanged. Runtime/backup do not receive that role. Exact native visibility passes.
  Password validity ends 2026-11-14 02:20 Bangkok. VALID UNTIL governs new password
  authentication; all test sessions must drain before expiry. Post-check inspection
  confirms zero open hosted test-account sessions; no expiry extension is approved.
- A native synthetic numeric insert verifies mapping and exact decimal precision,
  then rolls back; order count, revision and zero retained test rows match before/
  after. It uses an explicit unused positive row order to avoid advancing a
  nontransactional identity sequence. This is **not** application/replay acceptance.
- All three session logins pass client verified TLS. Direct native/server TLS also
  passes; recovery uses direct TLS. The pooler's database-side hop reports
  `ssl=false`, distinct from its TLS client socket; no TLS guard is bypassed.
- Post-setup security/health advisors have no findings. The performance advisor
  lists informational unused indexes on the new copy; preserve them.
  [Index notice](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

**Demonstrated backup-tool defect fixed locally.** A real export using the approved
NOBYPASSRLS backup reader fails with the old owner-style `pg_dump` default. New
explicit `capture --row-security-reader` verifies full table SELECT, an applicable
permissive `USING (true)` policy for every RLS table and no applicable restrictive
policy before allowing the row-security-aware dump. It never grants BYPASSRLS,
assumes an owner or silently accepts a policy-filtered backup. The default path is
unchanged. Hosted checkpoint tooling uses one reader plus one snapshot holder to
fit the two-connection login, with a 600-second outer capture timeout; the individual
150-second fingerprint deadlines stay unchanged. The real managed capture takes
367.47 seconds and would exceed the former 300-second wrapper timeout. A fresh local regression captures/restores all 51
tables/15 metadata sections, retains default refusal and rejects restrictive or
missing access before creating a dump. The **hosted restricted checkpoint succeeds**,
with dump SHA-256 `4389c710fba5a7b79ebfe1d0aa7f74adbd50c6fce4ea18e4e8292dc692452613`.
Its 51 table fingerprints preserve every original business row; only the enumerated
new environment UUID differs from the original table data. A fresh local restore
of this exact checkpoint matches **all 51 tables and all 15 metadata sections**.
The first local comparison exposed ordering differences, not definition changes,
in constraints/triggers; matching the managed ICU `en-US` locale provider preserves
the exact comparison and resolves them. No fingerprint normalization was added.
The complete 14-file checkpoint package also includes password-free role metadata/
recreation reference, the actual new-project migration ledger and pinned recovery
tools; all entries rehash. Manifest SHA-256:
`e2cc5e80420082c1297d2532cbcc7ef0973607e111dd939bb669e6162a649693`.
This is local recovery of a hosted capture, not independent off-site decryption,
a second hosted recovery target, RTO/RPO certification or activated backup automation.

**CI failure corrected without application changes.** CI46 on `d2a0349` passes
regression/type safety and the new restricted-backup restore, then fails the later
private-app smoke at WT03. Diagnosis reproduces a driver race: parallel HTTP
post-response hooks can read the same journal cursor and append events twice.
Serialize complete ledger drains; after a read failure queued callers remain
failed closed rather than hiding missing evidence. Two regressions fail before
this change and pass after it. All **85** hosted controls and a fresh actual private
app/browser/crash/checkpoint-recovery run pass locally. [CI47](https://github.com/volkswg/stock-management/actions/runs/43302788584)
passes on executable commit `e4e7498ec3c7d1aba3b6f28ee8301aeab7f396a0`:
625 regressions, 39 existing controls, 85 hosted controls, 73 Python checks, native
PostgreSQL/browser/crash/restore checks, lint/typecheck and isolated build. Report
upload passes; all 20 downloaded files, exact source SHA and archive digest
`e2104cf50cea5949a4a87878df333d203430c66b981d98b7344b4988148fe91c` verify.
CI46 remains a retained failed diagnostic, not a PASS. This later report-only update
does not rerun or relabel CI47 as a test of another executable commit. No
application, schema or runtime permission changes are made by this driver-only correction.

**Quota observations, not a complete traffic forecast.** Organization dashboard
shows 1.582/5 GB uncached egress for 03 Nov–03 Dec, about 3.418 GB remaining; after
retaining the 2 GB source reserve, at most 1.418 GB remains before unreported usage.
The provider warns of up to one-hour refresh delay. Native post-restore database
size is 79,869,619 bytes, below the 400 MB stop. These do not certify memory/CPU,
complete wire traffic or a full campaign. Vercel shows Hobby; billing API returns
`costs_not_found`, not proof of unused hosting allowance. No test app/coordinator
endpoint or paid add-on was created.

Current gate: **ESSENTIAL MANAGED POSTGRESQL SMOKE AND LOCAL RECOVERY PASS;
FINAL PRODUCTION BINDINGS/OPERATIONS PENDING**. No new hosted-test app, coordinator
or full-capacity campaign is required for this scoped evidence. Final-host
read-only compatibility, actual production target and fresh source/
freeze/reconciliation and explicit release approval remain outstanding. Production
is still Sheets; no activation or new Sheets read occurred.

**Production release path prepared locally (2026-11-12).** The staging-only
accessor still rejects production. A separate production profile now exists in
`database.ts`, used only when production explicitly selects Supabase and a complete
server-side release binding is enabled. The current default remains Sheets; no
release binding, production database or environment setting was installed.

The profile requires `STOCK_PRODUCTION_ENABLED=true`, the actual
`VERCEL_PROJECT_ID`/`VERCEL_GIT_COMMIT_SHA`, `STOCK_TARGET_ISOLATION_ID` and a private
`STOCK_PRODUCTION_RELEASE_JSON` with **exactly** these fields:

| Field | Required value |
| --- | --- |
| `version`, `accessPolicy` | `1`, `legacy-as-is` (the owner-selected current access behavior, not staff authorization) |
| `projectRef`, `isolationId` | Approved new Supabase reference/UUID; protected staging reference/UUID are refused |
| `databaseHost`, `connectionMode` | Exact approved direct host or Tokyo session-pooler host; port 5432 and database `postgres` only |
| `runtimeUser` | Approved `stock_prod_*` restricted login; session-pooler username must include the same project suffix |
| `vercelProjectId`, `sourceCommit` | Exact project and source commit of the approved production release; missing system identity fails closed |

The existing `STOCK_DATABASE_URL`/`STOCK_DATABASE_CA` remain server-only, with
verified TLS, no connection-query overrides and pool max=2. Production also checks
login identity, NOINHERIT/no elevated role flags and connection limit=6, plus the
actual environment UUID and `purpose=production` inside every transaction.
Mixed staging/test configuration and cached-pool target/credential changes fail
closed. No browser receives the staging bearer. Production APIs preserve legacy
access only within that explicit valid profile; staging APIs still require their
bearer and LINE still verifies its original raw-body signature.

`STOCK_PRODUCTION_READ_ONLY` defaults to read-only; only literal `false` allows
writer requests after a separately approved deployment/configuration change.
Prepare separate restricted writer and SELECT-only reader logins for the new
target. The reader needs the approved private-schema SELECT/RLS policy setup and
must not assume `stock_runtime`. This profile does not provision those identities.
The existing provider guard also denies fetches during read-only production
validation. These are migration identity/freeze controls, not a new user login.

The CLI-generated migration
`20261112160852_allow_explicit_production_environment.sql` only extends the
`environment.purpose` CHECK to admit `production`; its staging default, UUID,
records, grants and roles are unchanged. It is now applied on the **new empty final candidate only**; neither older target
is retagged or changed.
On an approved new production target, first verify the restored backup's original
51/15 fingerprints, then apply/review the named constraint delta and owner-only
new UUID/purpose assignment, provision scoped logins, and seal the expected setup
metadata. Never retag existing staging, run a production import onto the old
snapshot or claim intentionally changed metadata still equals the old baseline.

The existing backup/restore tool now accepts explicit `--target-purpose production`
for an approved production UUID/PGSERVICE. Its default guard remains
`isolated-staging`; production cannot select protected staging's UUID. Every
exported snapshot and fingerprint worker checks the selected purpose. Production
capture receipts record `sourcePurpose=production`, and verify rejects a missing
or different purpose before any connection (older receipts remain staging-only).
The new path is read/export/verify only: it cannot provision, retag, restore over a
live target or activate schedules. Continue requiring scoped verified-TLS service
configuration, encryption/off-site key custody and separate restore approval.
A fresh local production-tagged capture/restore verifies all 51 tables and 15
metadata sections; it does not claim off-site encryption or hosted recovery timing.

Local evidence: 25 focused production-profile checks pass. A fresh disposable
PostgreSQL test verifies the actual application's TLS socket/certificate, as-is
API access, one committed order with exact replay/changed-intent conflict, purpose
rejection, read-only stop, real LINE invalid/valid signatures (empty event probe),
and a SELECT-only production reader unable to write or assume the writer role.
The existing staging browser/crash/restore run and original credential-free build
also pass. Initial migration-inventory and test-only TLS-observer diagnostics are
retained; the inventory was extended to the new file and TLS is inspected on the
actual verified application socket. [CI45](https://github.com/volkswg/stock-management/actions/runs/43259664708)
passed on executable commit `739011c64b81b4ff54f34de43c915aa27e19186f`:
625 regressions, 39 existing harness controls, 83 hosted-tooling controls, 73 Python
checks, native PostgreSQL/browser/recovery checks, typecheck/lint and isolated build.
Report upload passed; all 19 downloaded files and artifact SHA-256
`5a335d18836d586725b71e74871e0566a831852b03caa3f137a2e9c22782ce04` verify.
Later documentation/disabled metadata does not relabel this as current-head or
hosted acceptance; older CI43 is historical evidence.
Hosted production/pooler behavior and real provider journeys remain NOT RUN.

**Evidence already sufficient.** Two independent local functional campaigns,
local one/five-client capacity with exact-data oracles and recovery, and the
locally completed hosted adapter are accepted implementation evidence. On code
commit `06eafe921e92842ecc3b87739238396e191dd47d`, [CI43](https://github.com/volkswg/stock-management/actions/runs/43248306690)
passed 600 regressions, 39 existing controls, 83 hosted-tooling controls and 71
Python checks, builds, actual browser/crash/restore checks and report upload.
All 18 downloaded reports and archive digest
`b8b132ffd05bbf4b7cc2866c3d15483b1dd8c7d98799e8d16ff0626d89480fb5`
were verified. This update changes documentation/disabled metadata only; it does
not rerun or relabel those tests as hosted acceptance.

**Historical metadata before target creation (2026-11-12).** Supabase then listed only
the protected `stock-management` staging project (`orjnazrothkdgmzlsuto`, Tokyo,
PostgreSQL `17.11.0.018`, ACTIVE_HEALTHY). No separate acceptance/production target
was visible then. The selected organization is Free; its repeated new-project quote
is **$0/month for the project alone**, not a complete campaign/production quote.
Vercel metadata still reports `all_except_custom_domains`, password and trusted-IP
protection disabled, and the production domain attached. The active firewall
configuration API returned 404; this is **unverified**, not proof of no firewall.
No production business endpoint, database SQL, key or new Sheets data was read.

**Blocker register.** Every outstanding item has one primary classification.
Owner decisions do not turn an unproved MUST FIX into PASS.

| ID | Classification | Exit evidence / action |
| --- | --- | --- |
| M1 | MUST FIX before cutover | **Minimum effective existing protection.** Implementation of new access protection, user login/RBAC/shop permissions is deferred. Preserve existing controls. Effective protection of production business reads/writes across all aliases remains unproved; LINE signatures and DB RLS do not cover ordinary APIs. Activation remains NO-GO if absent/unproved; no risk waiver or new auth implementation is implied. |
| M2 | MUST FIX before cutover | **Final release binding/hosting proof.** Production identity/profile/read-only guards pass locally; essential application-to-hosted-PG smoke passes. Bind the actual new target, exact deployment/SHA and restricted reader/writer; verify final-host TLS/connectivity and read-only browser/API/report compatibility once after approval. No production setting changed. |
| M3 | SATISFIED for essential scope | **Essential managed PostgreSQL smoke PASS.** Prior actual hosted writes/replay/LINE/transaction checks are retained. New final candidate adds verified native service access/rollback and actual read-only application checks. Final deployment compatibility remains M2; no full capacity certificate is claimed. |
| M4 | SATISFIED for empty target preparation | **Dedicated final database prepared.** Free Tokyo `hzynvirpedqnvtbifobx`, UUID `349b9289-f684-4ec5-ac22-924b2be1946b`; six source-version migrations, 51 RLS tables, approved restricted persistent accounts, native TLS/rollback, reader app and exact empty backup/restore pass. Remains isolated-staging purpose and empty. Final-load/headroom and deployed configuration are checked under M6/M2; no repeated resource/account approval needed. |
| M5 | DEFERRED BY OWNER — next phase | **Database backup work is not a current cutover gate.** Further checkpoints, automation, encrypted off-site delivery, backup alerts and RPO/RTO certification are deferred. Retain verified artifacts/tools/accounts. This records scope, not recovery certification; new SQL business data has no verified ongoing backup coverage yet. |
| M6 | MUST FIX before cutover | **Final full Sheets synchronization.** After explicit workbook/principal/native-backup/freeze/export/import approval only: fresh full 23-tab source into a new empty candidate, exact reconciliation and original application/report parity. Historical 70,777-row evidence is not current freshness; no in-place delta merge. |
| M7 | MUST FIX before cutover | **Loss-safe writer/event hold.** Stop every manual/API/deployment/script/scheduled/LINE writer, drain commands/effects and retain accepted/uncertain keys. Exact durable capture/replay or proven producer-pause procedure remains unassigned. LINE retries/webhook disablement alone are insufficient; never acknowledge unpersisted events. |
| M8 | MUST FIX before cutover | **Release and incident approval.** Seal exact target/deployment/source, retain existing verification evidence, finish read-only checks while frozen, name lead/abort times and approve dated activation. Database backup work is deferred. Before SQL writes, verified Sheets rollback is possible; afterward freeze/forward recover and reconcile, never automatic stale-Sheets fallback. |
| D1 | SAFE TO DEFER until after cutover | **New security/authentication implementation** is the next owner-selected phase: login, sessions, roles/shop permissions, user administration and new access restrictions. This is a sequencing decision, not a security PASS; the existing exposure remains M1 and must be explicit in the final cutover decision. Preserve existing safeguards throughout. |
| D2 | SAFE TO DEFER until after cutover | Unrelated refactors, extra test abstractions, more synthetic fault repetitions, additional planning PRs, multi-region/HA, optional dashboards, restore certification for unused Supabase Auth/Storage, and automated backup pruning. Preserve evidence and retained backups; defer destructive cleanup. Recheck only affected behavior or demonstrated drift. |
| D3 | SAFE TO DEFER until after cutover | Automatic reverse synchronization to Sheets is unnecessary if the owner accepts a **forward-recovery-only** incident policy after the first SQL write. No switch back after SQL writes is permitted without a separately reconciled reverse migration. A demand for immediate post-write Sheets rollback makes that implementation MUST FIX. |
| A1 | Requires owner approval | **Existing test approval is sufficient for the completed essential smoke.** No further test resources, public tunnel, monitoring protocol or full campaign are prerequisites. Additional resources, paid work or provider calls would require their own approval. |
| A2 | SATISFIED for current scope | **Free target and persistent DB accounts approved/completed.** Backup runner/destination/key custody/retention/recovery/alert decisions move to the next phase with M5 and do not block this migration scope. Any later nonzero spending still requires explicit approval. |
| A3 | Requires owner approval | **Only material launch limitations.** Existing 10/20 MiB upload versus hosting body-limit mismatch predates migration. Preserve behavior; do not make upload redesign, custom monitoring or sustained capacity certification a migration prerequisite. If large uploads are required at launch, resolve or explicitly disposition that requirement; no full-platform PASS is claimed. |
| A4 | Requires owner approval | **Final source/freeze.** Exact workbook ID and read/export identity, native frozen backup, all writer/event holds, final full export and import into the named new production candidate. No fresh source access is authorized now. |
| A5 | Requires owner approval | **Release/live actions.** PR65 merge/exact release SHA, target+UUID/deployment/configuration, explicitly scoped provider checks/notifications, incident lead and dated maintenance window, then a separate final activation decision. No blanket approval or bypass of unmet prerequisites. |

A1's existing approval covers the completed essential smoke on
`sm-ha-20261112-f` only; no new hosting, monitoring or full-campaign decision is
needed to continue this migration scope. Additional resources or paid work still
require exact approval. A2 target/account approval is satisfied for the Free
candidate; M5 backup/alert operating decisions are deferred. A4 must supply
the exact workbook/read-export principal,
writer/event-hold and final full export/import permission; older export authority
is insufficient. A5 names exact release/project+UUID, live actions, incident lead
and dated window, then separate writer activation. No permission is inferred from
a CI pass, prose mode change, test-target approval or deferred security work.

**Shortest remaining sequence.** Reuse the essential hosted PostgreSQL smoke,
CI47/local browser/fault/recovery evidence and the verified hosted checkpoint. Bind
the already prepared Free target to the approved final deployment; finish
final-host read-only compatibility once. Obtain final workbook/
freeze/export/import approval; rehearse the full refresh with an approved artifact to size the outage.
Only after every mandatory gate and dated owner approval perform final capture,
reconciliation, read-only release and explicit writer activation. Keep all work in
PR65. Do not implement new protection/authentication, optional monitoring, another
coordinator or repeated full campaigns. Unproved existing protection still means
production activation NO-GO, without stopping independent migration preparation.

The 4.5 MB Vercel request boundary predates the database switch; the app advertises
10 MiB images/20 MiB files. Full advertised upload compatibility remains NO-GO.
Recommend deferring a new upload delivery design **only after** normal production
flows are proved unchanged and the owner explicitly accepts this pre-existing
limitation for the database-only release. If larger uploads are required for launch,
the upload fix is MUST FIX. Do not silently reduce limits, alter the provider or
claim that a successful 256 KiB fixture proves large-file compatibility.

**Security implementation deferred; current behavior preserved.** Do not introduce
an admin-only launch, new login, gateway, roles, shop permissions or production
protection settings during this migration work. Preserve existing access controls,
raw-body LINE HMAC verification, staging API checks, verified TLS and restricted
database roles. Private test copies remain isolated from real integrations.
The ordinary browser must work after migration without receiving a shared staging
bearer. Production target/configuration compatibility remains migration work;
simply bypassing staging checks is not an approved production release path.
Existing protection gaps stay documented as M1, with no claim of adequate security
or general production safety. The next security phase is separate from permission
to continue database preparation. Missing/unproved effective existing protection remains activation NO-GO.

**Database backup activation — deferred to the next phase.** Preserve the verified
empty checkpoint, historical encrypted artifacts and existing recovery tools. Do
not schedule captures, add off-site delivery/backup alerts, require fresh SQL
checkpoints or certify the previously proposed 30/60-minute RPO/15-minute RTO as
part of this cutover. The detailed recipe in Step 1 is retained as a deferred
reference only. Basic application errors, timeouts, identity/TLS, connection/storage
limits and data reconciliation remain current operational checks.

###### Executable production cutover runbook

**Unapproved actions remain blocked.**
The exact empty production candidate below is prepared; its final application
connection endpoint and release binding are not yet verified. Never default to staging.
Complete the bindings below, independently review them, then execute this sequence
from the clean approved release checkout. Missing values or authority mean STOP.
Earlier Gate 0–8 sections supply detail; this is the current operator sequence.

| Required binding | Current value / operator action |
| --- | --- |
| Release | `volkswg/stock-management`, draft PR65; exact merge/deployment SHA and deployment ID require approval. |
| Production database | Prepared Free Tokyo `stock-management-production`, project `hzynvirpedqnvtbifobx`, UUID `349b9289-f684-4ec5-ac22-924b2be1946b`. Current purpose isolated-staging until final import/reconciliation. Protected staging `orjnazrothkdgmzlsuto` and paused test `dcwyiayubrqdrloergax` remain forbidden production destinations. |
| Production application | Existing Vercel project `prj_XH4nEje5cicuBuucGumuHgr73l1E`; no settings/deployment changed. Current production is READY at `dpl_7YdPW3SSSnRJgBcNedq3MviazqwW`, main `405c474578cec0b2fe84327687b90faf3f5b02f9`, alias `inventra-beta-one.vercel.app`; complete the old-writer inventory before freeze. |
| Endpoint/login | Owner/import direct endpoint `db.hzynvirpedqnvtbifobx.supabase.co:5432/postgres` has verified CA/hostname. The older test endpoint `aws-0-ap-northeast-1.pooler.supabase.com` does not recognize this reader/tenant; verify the project-assigned endpoint and user routing before application use. No transaction-mode/6543 assumption: current production parser supports direct/session 5432. |
| Accounts | Approved, created and verified: `stock_prod_runtime` (6), `stock_prod_reader` (6), `stock_prod_backup` (2); restricted persistent service credentials private, no administrator or RLS bypass. Internal `stock_runtime` stays NOLOGIN. No old credentials reused or installed in Vercel. |
| Source | Retained exact workbook ID and all 23 mappings are prepared privately; final source identity must be reconfirmed. Read/export principal and native-copy/freeze/export/import approval remain **UNASSIGNED**. Historical data is not source freshness. |
| Operations | Private artifact/service files are prepared. Name incident lead/business verifier and a loss-safe writer/event hold for current cutover. Backup runner, destination/key custody, backup alerts, retention and recovery objectives are owner-deferred to the next phase; no schedule/alert is activated. |

**Final synchronization/deployment preparation (2026-11-13).** The private
`final-sync-preparation-2026-11-13/private` packet retains the exact historical
workbook binding, reviewed 23-tab mapping, unapproved source/freeze request,
all-writer checklist, deployment metadata and ordered import/reconciliation checks.
The existing export **dry-run passes with no token access, HTTP or fresh source
file**. The original credential-free parity seed covers two accounts/ten months;
it is explicitly NOT FINAL. Rebuild all-history month/account coverage and frozen
`asOf` from the approved final snapshot; historical acceptance is not freshness.
No database backup is captured or required by this packet.

Fresh candidate control checks match UUID `349b9289-f684-4ec5-ac22-924b2be1946b`,
`purpose=isolated-staging`, revision/commands/effects/import batches all zero,
51 RLS tables and six migrations. Keep this purpose through all extraction/parity
steps. No schema bootstrap, role reset or test writes are needed.

Deployment metadata pins the unchanged Sheets release above and its immutable URL
`stock-management-oy2atdhzi-volkswgs-projects.vercel.app`; the other returned aliases
are `stock-management-volkswgs-projects.vercel.app` and
`stock-management-git-main-volkswgs-projects.vercel.app`. The current deployment
reports **`iad1` (Virginia)**, while PostgreSQL is Tokyo. Proposed `hnd1` is not
applied; verify the actual staged release region and response behavior. Region
location alone is not a demonstrated functional failure.

**Application connection remains an actual open check.** Direct native/actual app
access from the Mac already passes. A read-only attempt using the older test
project's Tokyo session endpoint fails at connection with SQLSTATE `XX000`,
`tenant/user … not found`; no business transaction starts. This connection route has not passed; the error alone does not distinguish
an incorrect endpoint from tenant/user routing and proves no general pooler outage. The
connector does not expose the assigned pooler address and browser access was
unavailable. Obtain the endpoint from this exact project's Connect panel, verify
TLS/UUID using the approved reader, then prove connectivity once from Vercel.
Do not guess more endpoints, purchase IPv4, use transaction port 6543, disable TLS
or call this a Vercel PASS. Preserve the failed private receipt.

**Release preparation.** Pin the eventual approved merge SHA, Vercel project ID,
reader username, selected verified endpoint and immutable deployment ID. Build
from Git so provider-injected `VERCEL_GIT_COMMIT_SHA` matches the nine-field release
binding; never forge system identity or assume a prebuilt deployment supplies it.
Keep SQL read-only until final activation. Stage with production alias assignment
suppressed and verify aliases stayed on the pinned Sheets release before any
smoke call. The current MCP deployment wrapper cannot express both private
per-deployment environment overrides and suppression of alias assignment; verify
the supported CLI/REST path before executing. Do not issue its plain production
create call. Production-purpose change, deployment/configuration/region changes,
merge, any provider checks and activation all require separate approval.

**Concrete freeze proposal — prepare only.** Inventory each source writer's
principal and every old immutable/preview deployment, not just the three aliases.
Verify ownership/delegation first: an owner or impersonated writer requires a
separately proved stop mechanism. During the approved window, retain source read
permission but remove edit permission for all application/service writer principals, pause owner-run Apps
Script/schedules and manual editors, and verify no alternative writer remains.
This can also stop old immutable deployments writing Sheets without removing the
read access still needed by `loyverse_accounts`. Record exact permission changes
and the pre-write rollback reversal before executing; do not read that credential
worksheet for this preparation. Mere `STOCK_PRODUCTION_READ_ONLY=true` does not
freeze Sheets mode, and a Vercel project pause covers production, not proof of every
preview/immutable writer. Provider/LINE ingress must separately be stopped/drained
with complete durable event capture or proven producer pause and keyed replay;
HTTP 503, disabling a webhook or relying on LINE retries is not sufficient.
All permission/ingress/schedule changes above are proposals, not performed actions.
Before SQL writes, resume Sheets only after restoring approved writer permissions
and reconciling held events. After SQL writes, keep legacy Sheets writers disabled.

**Step 0 — current resource decision and empty-candidate setup.** The owner chose
the existing Free organization after pausing only the disposable test copy.
Protected staging and the new final candidate use the two active slots; test data
and retained backups are preserved. The actual new-project quote is **$0/month**;
no Pro organization/upgrade or paid add-on is selected or authorized. The previous
$25/$45 Pro estimates are alternatives only if an approved need later requires
one, not blockers for this database preparation. Free still has its actual storage/
connection/egress and automatic-pausing limits; native final-load quota/headroom checks remain necessary. Database backup
arrangements are deferred by the owner, not a current gate. No final activation is
implied by Free project creation.
[Free plan and pausing](https://supabase.com/pricing),
[backup scope](https://supabase.com/docs/guides/platform/backups).

**The schema/UUID/account setup below is already complete on this candidate.**
Verify the sealed six source hashes, actual matching migration ledger and private
service-file identity; do not rerun the migrations or role bootstrap, create a
replacement project, reset/repair history or restore old business data onto it.
Native initialization preserves the original connector receipt and exact source
SQL; its single initial timestamp alignment is complete and is not an outstanding
repair operation. Keep the recorded new UUID and `purpose=isolated-staging` through
final extraction/reconciliation; those tools deliberately reject production purpose.
Recheck 51-table/role/RLS/index/trigger metadata before import. Recovery to another
new target requires its own explicit scope; it never overwrites this candidate.
Before every mutation recheck that service and the actual UUID/purpose.

After approved empty-target setup, run this catalog-only guard immediately before
each import/promotion step, with the service file's exact approved host/database,
role, `sslmode=verify-full` and CA already independently checked. It returns no
business rows. Bind the service-file hash in the operator record; stop if it changes.

```sh
: "${PGSERVICE:?approved new candidate service required}"
: "${STOCK_TARGET_ISOLATION_ID:?approved new candidate UUID required}"
psql -XqAtw -v ON_ERROR_STOP=1 -v approved_uuid="$STOCK_TARGET_ISOLATION_ID" <<'SQL'
BEGIN READ ONLY;
SET LOCAL statement_timeout='10s';
SELECT 1 / (:'approved_uuid' NOT IN ('160669bd-2f6f-4490-9259-bada5a1d02c4','5f63d064-9658-4440-bf87-b4279b08c806'))::int;
SELECT 1 / ((SELECT count(*)=1 AND bool_and(isolation_id=:'approved_uuid'::uuid AND purpose='isolated-staging') FROM stock_operational.environment))::int;
SELECT 1 / (coalesce((SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()),false))::int;
COMMIT;
SQL
```

Use the approved owner service for this native diagnostic, not the restricted
runtime after SET ROLE. After the deliberate production-purpose change, use the
existing production-purpose capture/runtime identity guards instead; never relax
this candidate guard to make it accept a different destination.

Runtime/reader satisfy the production parser: NOSUPERUSER/NOCREATEDB/NOCREATEROLE/
NOINHERIT/NOREPLICATION/NOBYPASSRLS, connection cap 6; writer alone may SET LOCAL
ROLE `stock_runtime`. Reader/backup have full SELECT/unfiltered SELECT policies,
no writer membership/owner assumption; backup cap 2. Verify effective memberships,
DELETE/DDL denial, private Data API schemas and anon/authenticated denial. Pool max
2 per application instance is not a global cap; record real provider max/backends,
retain five spare connections, stop on pool timeout/errors or >=80% quota. Measure
actual final-plan disk/growth headroom; do not infer it from the 80 MB test copy.

**Step 1 — SKIP: database backup work deferred by the owner.** No new backup,
schedule, off-site transfer, backup alert or recovery-objective decision is required
for this migration scope. Keep existing verified artifacts. Continue with Step 2.

<details>
<summary>Deferred backup reference for the next phase — do not execute now</summary>

**Prior backup recipe — future-phase reference only.** The existing
production-purpose capture/verify tools and restricted reader are implemented;
hosted capture (367.47 s) and exact fresh local 51-table/15-metadata restore pass.
Historical independent off-site encryption/key recovery passes. These do not mean
production scheduling, unattended encryption, destination, alerts or RTO are ready.
A sleeping Mac cannot be the sole always-on backup runner.

Use this existing capture command in the approved runner's serialized job after
binding its private PGSERVICE/PGPASS/CA and fresh exclusive run-directory path:

```sh
set -eu
umask 077
: "${PGSERVICE:?approved production backup service required}"
: "${PGSERVICEFILE:?private service file required}"
: "${STOCK_PRODUCTION_ISOLATION_ID:?approved production UUID required}"
: "${STOCK_BACKUP_RUN_DIRECTORY:?new exclusive private directory required}"
python3 tools/migration/recovery.py capture --directory "$STOCK_BACKUP_RUN_DIRECTORY" \
  --target-id "$STOCK_PRODUCTION_ISOLATION_ID" --target-purpose production \
  --row-security-reader --workers 1 --row-digests
```

Package dump/receipt/fingerprint, password-free role recreation/ledger, source/
target/release digests and pinned recovery sources. Use the existing verified
encryption/retrieval procedure, with separately approved unattended key access;
the interactive helper is not a scheduled solution. Preserve/quarantine partial
jobs, no pruning. Publish success only after encryption, off-site upload and
independent ciphertext retrieval/hash verification. Record snapshot start before
capture: receipt `createdAt` is completion and cannot stand in for the recovery
point. No private keys/passphrases/passwords in backups, Git or logs.

Owner proposal: every 30 minutes, complete snapshot-to-offsite <=30 minutes,
recoverable checkpoint age <=60 minutes, warning at 45, RTO <=15 minutes. Bind a
stable runner's 30-minute schedule and an independent five-minute freshness check
only after objectives/costs are approved and measured. Any capture/encryption/hash/
upload/retrieval/identity/restore failure suppresses the success heartbeat and
alerts the named responder with stage/target/time only. The independent watchdog
must detect a dead runner. At 60-minute age follow the approved writer-freeze
incident procedure. Prepare alert delivery/acknowledgment testing, but send nothing
without the separate recipient/channel approval. No schedule or notification is
activated here; runner/destination/key/recipient are explicit prerequisites.

Before activating backups in the next phase, independently download/decrypt a generated package, restore to a fresh
approved isolated recovery target, recreate custom role secrets via separate
custody, match managed ICU `en-US` ordering, verify all 51 tables/15 metadata and
SELECT-only app/no provider replay. Include retrieval/key access/provisioning/role
setup/restore/readiness in RTO. Existing local restore time is not hosted incident
recovery time. If the proposed objectives fail, agree honest bounds or separately
price a remedy. Assign Drive object-byte recovery separately from SQL.

</details>

**Step 2 — stage configuration and a loss-safe freeze.** Prepare, do not install,
the existing production binding: `STOCK_STORAGE=supabase`,
`STOCK_PRODUCTION_ENABLED=true`, exact `STOCK_TARGET_ISOLATION_ID`, verified
`STOCK_DATABASE_URL`/`STOCK_DATABASE_CA`, `STOCK_PRODUCTION_READ_ONLY=true` and the
exact nine-field `STOCK_PRODUCTION_RELEASE_JSON` documented above. Use
`stock_prod_reader` first; the later writer binding/URL uses `stock_prod_runtime`.
Bind Vercel's real project/commit, no staging/local/HA settings or browser DB secrets.
Keep LINE HMAC and all existing controls. No new user auth/RBAC/shop features.
Existing protection must be effective across production business API aliases;
LINE HMAC/DB RLS alone do not establish this. If absent/unproved, activation is
NO-GO; defer implementation and continue database preparation.

After deployment/configuration approval, verify final-host TLS/networking and
read-only browser/API/report results once. Mac direct connectivity does not prove
Vercel IPv6; session mode must be actually verified before selecting it. No TLS
workaround, production setting or real-provider call is authorized now.

Before freeze, name/hold every browser/API/Sheets editor, old deployment, script,
scheduled sync and external/LINE writer. Drain commands/effects and record last
accepted keys plus uncertain outcomes. Approve either durable held-event receipt
with keyed ordered replay or a producer pause with a proven complete capture/replay
procedure. Webhook disablement/LINE retries/reply-token assumptions are insufficient.
Never acknowledge unpersisted events. Exact hold remains unassigned; do not start
the outage or build an optional queue as part of this preparation.

**Step 3 — approved fresh full source and empty-target import.** After explicit
workbook/principal/native-backup/freeze/export/import approval, take the frozen
native copy and record writer acknowledgments, copy revision and UTC/Bangkok times.
Set the variables below, the private read-only token and reviewed mapping in a new
0700 directory. No credential worksheet is read. Export checks headers, then takes
two full raw/formatted/formula captures of all 23 business worksheets and rejects
drift. Recheck source revision/writer state afterward; matching captures alone do
not prove a freeze.

```sh
set -eu
umask 077
: "${STOCK_FINAL_DIRECTORY:?new private artifact directory required}"
: "${STOCK_FINAL_WORKBOOK_ID:?approved workbook required}"
python3 tools/migration/migrate.py export --workbook "$STOCK_FINAL_WORKBOOK_ID" \
  --mapping "$STOCK_FINAL_DIRECTORY/mapping.json" --output "$STOCK_FINAL_DIRECTORY/source.json"
python3 tools/migration/profile.py "$STOCK_FINAL_DIRECTORY/source.json" --output "$STOCK_FINAL_DIRECTORY/profile.json"
python3 tools/migration/migrate.py plan "$STOCK_FINAL_DIRECTORY/source.json" \
  --snapshot-encoding gzip-json-v1 --output "$STOCK_FINAL_DIRECTORY/import.sql"
```

STOP for profile/unknown-tab/source/freeze review, exact-target empty-state and
migration-ledger checks, generated-SQL review and explicit import approval. Then
use the approved private owner service, with the exact UUID exported as
`STOCK_TARGET_ISOLATION_ID` and approved verify-full service/passfiles:

```sh
set -eu
umask 077
: "${PGSERVICE:?approved empty production-candidate owner service required}"
: "${STOCK_TARGET_ISOLATION_ID:?approved candidate UUID required}"
: "${STOCK_FINAL_DIRECTORY:?reviewed private artifact directory required}"
psql -Xw -v ON_ERROR_STOP=1 -f "$STOCK_FINAL_DIRECTORY/import.sql" >"$STOCK_FINAL_DIRECTORY/import.log" 2>&1
python3 tools/migration/migrate.py database-snapshot --source "$STOCK_FINAL_DIRECTORY/source.json" --output "$STOCK_FINAL_DIRECTORY/archive.json"
python3 tools/migration/migrate.py reconcile "$STOCK_FINAL_DIRECTORY/source.json" "$STOCK_FINAL_DIRECTORY/archive.json" --output "$STOCK_FINAL_DIRECTORY/archive-reconciliation.json"
psql -Xw -v ON_ERROR_STOP=1 -f tools/migration/promote.sql >"$STOCK_FINAL_DIRECTORY/promote.log" 2>&1
# The explicitly bound service/target UUID still has isolated-staging purpose:
python3 tools/migration/phase3.py operational-snapshot --source "$STOCK_FINAL_DIRECTORY/source.json" --output "$STOCK_FINAL_DIRECTORY/operational.json"
python3 tools/migration/acceptance.py "$STOCK_FINAL_DIRECTORY/source.json" "$STOCK_FINAL_DIRECTORY/archive.json" "$STOCK_FINAL_DIRECTORY/operational.json" --output "$STOCK_FINAL_DIRECTORY/acceptance.json"
env -i PATH="$PATH" node tools/migration/application-parity.cjs --source "$STOCK_FINAL_DIRECTORY/source.json" --operational "$STOCK_FINAL_DIRECTORY/operational.json" --config "$STOCK_FINAL_DIRECTORY/parity-config.json" --output "$STOCK_FINAL_DIRECTORY/parity.json"
```

This is a supervised sequence: the separate STOP paragraph is an operator
decision boundary. Keep `set -eu`, private logs, exact TLS service/UUID and
freeze checks at each step. Parity config needs reviewed frozen clock/all history
months/account/shop identities, no tokens. Require all 23 table/ID/cell/type/FK/
exact-money checks and original report parity to pass. No silent cleanup/delta
merge or synthetic writes on this final target. A mismatch stops; retain the
failed target and obtain approval for a new empty candidate, never truncate it.

**Step 4 — seal, read-only validate and obtain final GO.** Only after reconciliation
does the owner perform the reviewed new-candidate-only purpose change to production;
UUID stays fixed. Record that intentional metadata delta and seal source/release/
endpoint/role digests. Retain existing backup evidence; new SQL checkpoints and
off-site verification are deferred. With separate live-change approval, deploy
the protected SQL read-only configuration and compare expected totals/statuses/URLs. Keep held events
and providers stopped. Any identity/TLS/access bypass, source drift, mismatch,
pool exhaustion/timeout or missing event is NO-GO. Deferred backup work is
not a current launch gate. Owner must approve exact SHA, project+UUID and dated
window.

**Step 5 — separately authorized activation.** Operator installs the sealed writer
URL/release binding and literal `STOCK_PRODUCTION_READ_ONLY=false` once. Prove old
Sheets writers remain stopped, release held work with original stable keys and
outcome reconciliation, observe existing dashboards/errors/connections/storage. A CI pass or test-target approval never activates production.
Before any SQL business write, abort may restore approved Sheets routing only after
proving SQL accepted no new business commands and reconciling held events. **After
the first SQL write, freeze and prefer forward recovery; never automatically flip
to stale Sheets.** Preserve SQL/journal/effects and last accepted IDs;
reconcile every post-freeze mutation before a separately approved reverse transfer.
If DB is lost/corrupt, freeze ingress/providers, retrieve/decrypt and restore to a
new approved target, verify exact data/permissions and reconcile writes since the
snapshot plus uncertain effects. Resume only on incident-owner approval; never
blindly resend sending/uncertain provider effects or overwrite protected staging.

**Final full-refresh/cutover window — conditional, not booked.** Reserve **02:00–06:00
Asia/Bangkok (four hours)** only after the same-size hosted end-to-end full-refresh
rehearsal completes within 90 minutes and all current preflight gates pass.
Database backup/RPO/RTO certification is deferred. No current evidence times a latest Sheets export plus
hosted final load; local 1,478.491-second capacity and ~5.5-second local restores
cannot justify a shorter production outage. There is no defensible fixed go-live
date yet. Allow roughly **3–5 working days after decisions/access approvals** for
target/release bindings, final-host proof and source/freeze coordination; this is an
engineering estimate, not a promise, and required upload/authorization fixes or
failed hosted gates extend it.

| Window | Action and decision |
| --- | --- |
| Before maintenance | Verify the prepared empty target, reviewed release and approved event hold. Rehearse using an already approved frozen artifact; no new Sheets read without A4. Sign the preflight packet and name incident lead/business verifier. Database backup work is deferred. |
| 02:00–02:15 | Freeze browser/API/manual/script/sync/LINE writers; drain and verify hold durability. Record last accepted IDs/events and native Sheets backup. If any writer cannot be stopped safely, abort before capture. |
| 02:15–03:45 | Capture the approved final full source; hash/profile/delta-review offline; import/promote into the fresh target; reconcile 23 tables and original business/report invariants. No acceptance writes on this final target and no in-place delta merge. Any source activity invalidates the snapshot. |
| 03:45–04:15 | Verify target/permissions/source/release hashes and protected read-only browser/API/report results. Retain existing recovery evidence. Do not start deferred database backup/off-site/alert work as a launch gate. No launch if any current required gate is unknown. |
| 04:15 decision; 04:30 latest writer activation | Incident lead records GO plus explicit owner activation approval. Otherwise abort while Sheets is authoritative; reconcile held work and resume Sheets only after verification. This is the last simple rollback point. |
| Through 06:00 | Open SQL writers exactly once, retire old Sheets writer routes, release held work using original keys and observe errors/connections/totals in existing dashboards. On failure freeze and preserve SQL state; never flip to stale Sheets. |

The dated window must be approved after actual rehearsal timing; if the complete
refresh cannot fit the 90-minute segment plus verification/abort reserve, enlarge
or reschedule it. Never compress integrity checks or open SQL while old writers
remain active. After the first SQL write, no guaranteed 06:00 Sheets fallback is
promised. LINE retries alone are not a queue
([delivery limitations](https://developers.line.biz/en/docs/messaging-api/receiving-messages/)).

**Next priority remains user authentication.** The existing
[roadmap](architecture/user-authentication-roadmap.md) is unchanged in scope and
planning-only. The owner defers new security/access implementation; login, sessions, roles/shop
authorization and administration follow the database milestone. Preserve all
existing safeguards and carry unresolved access risk into the final cutover report.

##### Bounded local capacity continuation (2026-11-12)

The owner cleared disk space and authorized continuation. Disk qualified above
the unchanged 20% floor; the earlier 5.88% disk block remains historical evidence.
The first full one-client run passed timing, exact-data and recovery checks, but
the first five-client run stopped on app RSS: 831.5 MiB exceeded the 819.2 MiB
headroom stop. Its default Node heap was 2240 MiB against a 1 GiB total RSS budget.
The partial five-client timing sample is not a capacity PASS or a throughput claim.
Both stopped/completed checkpoints were verified and restored; their recovery
bounds were 138.363 s (including retained initial verifier diagnostics) / 6.637 s.

The local launcher now fixes the app heap at 384 MiB and driver heap at 256 MiB;
neither the RSS budgets, database limits nor acceptance thresholds increased.
The first bounded retry stopped before traffic because the retained 40-database
cluster was already above the raw cgroup memory headroom limit, mostly cached
rehearsal files. Its zero-write checkpoint also passed exact-data/recovery checks.
No cache was dropped, memory subtracted, old database reset or resource resized.
Fresh clones of the same sealed post-seed checkpoint were therefore restored into
a new task-owned local container/volume, retaining all earlier resources/evidence.
All 51 tables/15 metadata matched before traffic; this preparation changed no
application, hosted or production configuration.

**Both fresh bounded profiles PASS timing, exact-data and recovery gates.** Each
used 120 seconds warmup plus 600 measured seconds, no catch-up, one request in
flight/client, at most one new request/second/client, the fixed 12/5/3 mix and
256 KiB image/PDF fixtures. Every scheduled concrete variant has at least 20
successful measured samples. No unexpected status, timeout, deadlock, connection
failure, incorrect total, partial commit or duplicate/unexplained effect occurred.
Raw p50/p95/p99/max for every client/variant and class remain in private evidence.

| Clients / class | Successful measured | p50 ms | p95 ms | p99 ms | Maximum ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 / read | 360 | 27.811 | 367.897 | 432.684 | 476.752 |
| 1 / simpleWrite | 150 | 28.474 | 357.139 | 375.924 | 378.573 |
| 1 / compoundWrite | 90 | 76.740 | 245.953 | 277.981 | 277.981 |
| 5 / read | 1800 | 88.091 | 1099.815 | 1446.450 | 1708.166 |
| 5 / simpleWrite | 750 | 42.482 | 887.798 | 937.674 | 978.994 |
| 5 / compoundWrite | 450 | 218.212 | 583.531 | 651.186 | 698.581 |

| Clients | Offered / started / completed | Unstarted slots | Completed/s | Variants / minimum samples | Restore readiness s |
| --- | --- | ---: | ---: | --- | ---: |
| 1 | 600 / 600 / 600 | 0 | 1.000 | 17 / 30 | 5.423 |
| 5 | 3000 / 3000 / 3000 | 0 | 5.000 | 85 / 30 | 5.491 |

| Clients | Peak DB / app / driver MiB | Peak total / runtime backends | Minimum host memory / disk free | Minimum VM memory / disk free |
| --- | --- | --- | --- | --- |
| 1 | 579.8 / 404.2 / 117.5 | 2 / 1 | 33.0% / 23.83% | 85.6% / 52.09% |
| 5 | 682.4 / 490.4 / 125.5 | 3 / 2 | 32.0% / 23.78% | 85.0% / 51.60% |

Combined warmup/load/drain was 1478.491 s, below 1800 s.
The private orchestration wrapper rejected the ISO UTC `Z` suffix while formatting
its final combined-clock receipt after all six timing/oracle/recovery gates passed.
Its STOPPED receipt is retained. An additive verifier parsed the original UTC
timestamps, checked the first-level clock against the actual final observer-stop
time, and rechecked all six gates and eight source hashes without changing data,
repeating traffic or resetting a timer. This is a reporting diagnostic, not an
erased load failure.
Database limits remained 1 GiB/1.5 CPU/no swap, max_connections=24, runtime limit=6
and app pool=2. Raw cgroup memory, CPU/pressure/OOM/restarts and app/driver RSS were
sampled every second; disk/database/index/WAL every 10 seconds. Both observers
finished without errors; no OOM, unplanned restart, missing telemetry or sustained
CPU-headroom breach occurred. Hardware was an 8 GiB ARM Mac with 8 logical CPUs,
Node 24.22.2 and the existing 2-CPU/4-GiB VM. This is a bounded shared-host local
profile with an explicit heap cap, not hosted or production capacity certification.
The hosted candidate must specify and test its actual app/runtime/DB budgets.

The independent offline projection verifies every final business cell, row/global
revision, command intent/response and fake upload/effect graph. All 70,777 original
rows remain exact. Each checkpoint's fresh backup/restore matches all 51 tables
and 15 metadata before/after provider-denied read-only app readiness; SQL writes
are denied and no provider outcomes are replayed. RPO=0 is limited to acknowledged
work sealed in those checkpoints. Existing API/LINE/role/TLS checks also pass;
the current production protection gap remains a separate **NO-GO**.

The eight executed capacity source files were sealed before copy setup/traffic
and unchanged through both profiles. `capacity-execution.cjs`,
`capacity-observer.py`, `capacity-oracle.cjs` and `capacity-recovery.py` are explicit
Mac operator adapters requiring the private prepared manifest, services, secrets,
checkpoint and fake-provider catalog; they are not app imports, generic cloud
provisioners or automatic production jobs. The public workload/context controls
also run in secret-free CI. No private rows, credentials or raw logs are published.

Fresh local verification: 600 regressions, 39 harness controls, 71 Python checks,
lint/typecheck and isolated credential-free production build pass; only the
inherited `shipmentRow` lint warning remains. Route manifest is unchanged and 113
client chunks retain private-database boundaries. Current-head independent CI is
recorded on PR #64. A bounded read-only protected-source recheck again matches all
51 tables/15 metadata and the independently recovered source-backup manifest.
Production metadata still has 14 entries, no STOCK override and the READY PR63
Sheets release. No hosted write, new Sheets business export, real provider action,
paid resource, production setting change, merge or cutover occurred.
Private combined receipt SHA-256: `3ee617c4d155e9239fe86cceb020899e34a5b04b34425ff474c2f3bc59f9dcc5`.

##### Local acceptance milestone results

Historical completed 2026-11-11 execution snapshot, reported 2026-11-12 (Bangkok).
See the current assessment above and the capacity continuation above for later evidence.
[PR #64](https://github.com/volkswg/stock-management/pull/64)
was reviewed against main `1a539656711ef5b202b34afaf454d28261e90c52` and remains
unmerged: main automatically deploys production. **Supported local functional
coverage and recovery pass; the complete pre-production milestone remains NO-GO.**
At that snapshot, one/five-client capacity was BLOCKED; hosted/production gates remain separate.

**Fixes.** Server and browser compare actual raw bytes plus MIME, preserving
same-key replay and rejecting changed intent. Browser revision tracking no longer
moves backward on an old replay. Newly known uploads are compensated after handler
or transaction failure. Durable claims in the existing effect ledger prevent blind
resend after unknown acceptance or failed cleanup. Failed LINE business work rolls
back its command, preserves failure counters and retries the same logical event;
the HTTP boundary awaits and translates asynchronous failures. No financial rule,
route, package/lockfile, SQL migration, hosted grant or audit table was introduced.
Application fixes are pinned by `0d142f7263e2daea3a968824465a5ec5fed6f14f`;
executed harness `9f72ed3dbbe8ebbddf05d8f5ca13681881df263b`.

**Two independent fresh checkpoints.** Both matched all original 51 tables and
15 metadata sections before writes, used separate provider journals and the same
frozen 45-entry inventory. Each completed **38 PASS entries / 7 retained narrow
BLOCKED labels / zero FAIL**. Those seven base labels are preserved, not relabeled:
the combined matrix below supplies the added local proofs, verifies unsupported
operations as N/A, and retains the hosted deferral. Driver journals contain
7037 / 7037 requests (browser network requests are separately proved, not included
in that count). Each original 70,777-row set, 24 archive tables and 15 security
metadata remain unchanged. Only newly synthetic fixtures were editable.

| Family | Result | Evidence per independent campaign |
| --- | --- | --- |
| WT00 | PASS | Local target/UUID, role, TLS probes and production refusal |
| WT01 | PASS local; hosted BLOCKED | All exported method auth/key gates; managed Data API/protection deferred |
| WT02 | PASS supported; N/A absent writes | Order edits/images/history; cancel/delete success is not exported |
| WT03 | PASS supported; N/A absent writes | Links, bills, 25 state combinations; unlink/cancel success is not exported |
| WT04 | PASS | Movement edits/delivery, invalid quantities and both LINE modes |
| WT05 | PASS | Counts, adjustments, reversal, replacement and account/reference rules |
| WT06 | PASS | Overlap/conflict/cursor failures, canceled/store/date filters and override history |
| WT07 | PASS | Effective compensation, Bangkok day/month edges and daily payable cap |
| WT08 | PASS | Legacy advances, pay/cancel, stale settlement and settled snapshots |
| WT09 | PASS | Expense mapping rejection, soft-delete history and exact totals |
| WT10 | PASS local | All upload endpoints/limits, compensation, guarded unknowns and file reconciliation |
| WT11 | PASS fake providers | Complete signed journeys, sessions, counters and 40 image SQL rollback/retries |
| WT12 | PASS | JSON/query/multipart/raw intent, canonical replay and changed-input rejection |
| WT13 | PASS local Chromium | 100 actual desktop/mobile-viewport form trials plus 20 raw-image transport trials |
| WT14 | PASS | 32 scenarios × 20 same-key and stale-state pairs; 80 compound rollbacks |
| WT15 | PASS local | 60 LINE process-crash trials; full checkpoint restores and read-only readiness |

The 32 ordinary scenarios cover 31 exported ordinary methods plus both expense
master kinds; each gets 20 fresh same-key pairs, 20 competing-revision pairs,
20 exact old-key replays after unrelated writes, changed-query rejection and a
pre-commit rollback. Compound rollback adds 80 trials, signed LINE image rollback
40, and shipping-file rollback 10. Browser evidence is Chromium desktop/mobile
viewports, not physical iOS/Safari certification. Unsupported success operations
are absent from the current contract; their 400/405 refusal and synthetic legacy
history are verified instead of inventing business features.

**Explicit uncertain outcomes.** The normal-phase file graph is clean. Each
campaign then deliberately leaves 22 fake orphan files (11 accepted-response-loss
and 11 rejected-cleanup fixtures), 11 unknown Drive attempts, 10 unknown LINE
attempts, 23 guarded upload operations and 31 unreplayed reply claims. All match
the exact expected fixtures; unexplained outcomes, unexpected orphans and broken
references are zero. These are fake-only failure witnesses, not real Drive files.
The application blocks automatic resend; real-provider reconciliation and file
object recovery are not certified by these tests.

**Recovery.** Each completed checkpoint is captured privately and restored into a
new named local database. All 51 tables/15 metadata match before and after the
provider-denied read-only app probe. Restored order amount/image references and
five other reports read successfully; unauthenticated reads return 401, authenticated
ordinary and signed LINE writes return 405, SQL writes/role escalation are denied,
and provider attempts are zero. Readiness timing is 401.657 s / 12.655 s, below the unchanged
900-second limit. Campaign one's value is a conservative upper bound from checkpoint
capture start, including initial missing-bearer probe failures and correction;
its timer was not reset to hide retries. Campaign two uses the normal monotonic
new-target timer. RPO=0 applies only to acknowledged work inside each sealed
checkpoint. These are private local dumps and same-cluster role checks; no new
off-site encryption, Supabase platform/Auth or external file recovery is claimed.
The existing independently downloaded/decrypted source backup remains verified.
The app uses its explicit loopback test connection; verify-full TLS is checked by
separate owner/runtime-role probes, not claimed for that local application pool.

**At this historical checkpoint, capacity was BLOCKED / NOT RUN at both levels.** Host disk free was
5.88%, below the approved 20% threshold. p50/p95/p99/max, error rates, load
throughput and full resource headroom are N/A; synthetic engine controls and
functional timings do not certify capacity. No limits were raised or thresholds
weakened. Database limits remain 1 GiB, 1.5 CPU, no additional swap, max_connections
24, runtime-login limit 6 and application pool 2. Functional storage charges all
this task's allocated files, the complete PostgreSQL volume, container writable
layer and a 256 MiB temporary/log reserve, with the same 4 GiB stop and 5 GiB
absolute host-free minimum. Earlier host-delta/observer blocks remain recorded;
measurement corrections do not satisfy the separate 20% capacity gate. Only
regenerable inactive build files/dependencies and three proved untouched unused
test duplicates were reclaimed; tested/failed states, backups, credentials and
shared reference/recovery resources are retained.

**Verification and protected state.** 600 application regressions, 33 harness
controls, 71 Python checks and 29 real-PostgreSQL cases pass. Lint has zero errors
and the one inherited `shipmentRow` warning; typecheck and an exact credential-free
local production build pass, with unchanged route manifest and 113 clean client
chunks. [Source-matched CI](https://github.com/volkswg/stock-management/actions/runs/43049889302)
passes independently. Final bounded read-only hosted checks match all 51 protected
tables/15 metadata; production has the same 14 configuration metadata entries,
no STOCK override and the READY main/PR63 release. No hosted write, new Sheets
business export, real provider mutation, production setting change, merge or
cutover occurred. Private aggregate receipt SHA-256: `2433fbe33df2efc97db1bc14a0e530a0f17925dae8b9385436ede032ba91a949`.

A browser shutdown diagnostic exposed a disposable local test bearer; the active
local token was replaced, private evidence/redacted logs retained, and shared
interception now suppresses raw request-header logs. No hosted or production
credential was involved.

Initial raw-byte, cleanup/finalization and LINE failures, typed-counter CI failures,
and later harness fixture/control/observer/auth-header failures are preserved with
their fixes; they are not erased by the two final independent results. The next
step is the unchanged bounded capacity protocol on a machine with sufficient
headroom, followed by separately approved disposable hosted acceptance. See the
[prepared next-stage packet](#next-hosted-and-production-stage-plan) for project/cost,
backup/monitoring, final Sheets freeze, deployment/rollback and exact approval gates.

##### Next hosted and production stage plan

The current owner instruction authorizes preparation and read-only metadata/cost
inspection only. No Supabase project/branch, acceptance-app deployment, credentials, schedule or
hosted test has been created or activated. No existing project may be changed, paused,
resized or deleted. The PR64 merge approval is complete and does not authorize
merging a later planning PR, which would trigger another production deployment.

##### Hosted Supabase test target and execution packet (2026-11-12)

**State: packet and offline adapter foundation prepared for review; hosted execution
is disabled and unapproved.** The companion
[declarative packet](../tools/migration/hosted-acceptance-plan.json) keeps execution,
provisioning, hosted writes, pausing, paid resources and production changes disabled.
It is not a script or permission to run commands. Planning baseline is merged
PR64 `405c474578cec0b2fe84327687b90faf3f5b02f9`; existing local functional/capacity
evidence is retained. The existing source is `stock-management`
(`orjnazrothkdgmzlsuto`, Tokyo, observed PostgreSQL `17.11.0.018`) and is explicitly
excluded from every write/reset/pause target. The production Vercel project and
current protected read-only preview are also excluded from reconfiguration.

**Security scope update.** The latest owner instruction preserves application
access behavior and defers new security implementation to the next phase. Existing
access gaps remain recorded for the final activation assessment.
This preparation implements no new login, sessions, roles or shop authorization.
Existing staging token checks, LINE raw-body signatures, TLS, private-schema grants,
restricted runtime roles and the production refusal remain mandatory test controls.
Private-copy isolation is not deferred. The production gap stays recorded for the
final cutover decision; a hosted test PASS cannot waive it.

**Hosted tooling completion, verified locally (2026-11-12).**
[`tools/migration/hosted-write`](../tools/migration/hosted-write) now implements the
private build, runtime, durable coordinator transport, browser controls, SQL and
process fault hooks, 45-case runner, bounded load scheduler, independent load
oracle transport and checkpoint/recovery integration. This completes the local
implementation; **actual hosted environment acceptance is NOT RUN**. The existing
local harness, production source, migration files and dependencies are unchanged.

`build-app.cjs` creates a new private copy without `.env` files or integration
credentials. It attests exactly two existing-source overrides: instrumentation
installs the test runtime and the Drive factory supplies its fake. One private
`/api/ha-test` fixture/health route is added only to that copy; an independent
operator token protects it. Original routes match after removing that addition,
and client chunks contain no database, coordinator or staging secrets. Build-time
Supabase selection includes the existing staging request-key script; production
selection is unchanged. Runtime refuses a missing manifest, production mode,
wrong endpoint/UUID, local-guard spoofing and real provider credentials.

`rpc.cjs`/`serve-coordinator.cjs` provide private HTTPS with verified certificates,
separate operator/runtime tokens and exact run/target namespaces. The coordinator
keeps fake bytes, outcomes, one-shot faults and durable transaction-admission
leases outside the app database. It allows only loopback listening in synthetic
mode. Hosted startup requires a binding/expiring approval before secret-file
reads or listening; no service, tunnel, domain or hosting resource was created.
A persistent operator-owned host and private network must be approved and its
zero-cost allowance verified. Serverless temporary files are not the authority.
A stale writer lock or corrupt journal stops recovery without automatic repair.

Provider snapshots use bounded incremental cursors rather than retransmitting
the full journal per request. HTTP and RPC counters identify their own coverage;
they are not Supabase wire/billing meters. SQL faults, lost commit acknowledgement
and six actual process-exit boundaries keep independent durable witnesses. Admission starts closed; full 51/15 baseline, original-row and frozen-seed
comparisons must pass before it opens. A closed barrier prevents new transactions
across instances. Drain waits
for explicit lease release or read-only proof that a particular backend has gone;
leases never expire automatically. Missing backend-statistics permission blocks
drain. Only newly created test-copy ingress is controlled.

`campaign.cjs`/`run-packet.cjs` reuse the reviewed 45 case methods and repetitions.
WT04 replaces only local-worker seeding with the same application owners through
the private endpoint; WT13 uses the hosted browser transport. WT00 checks hosted
TLS/role access. Two separately approved pinned movement-mode previews may share
the new test project and coordinator; lifecycle probes select those existing
previews and never deploy or mutate process-wide mode during a concurrent request.
No preview has been created. The startup handshake uses Vercel's actual project /
deployment system IDs to select a registered, approved manifest and sealed private
runtime configuration from the coordinator. This avoids pre-baking an unknown
deployment ID and redeploying to change it. The build has no database credentials;
unapproved startup stays closed. A forged credential-free build phase disables
business storage rather than bypassing the runtime guard. Runtime configuration
cannot override Vercel identity or TLS variables, and credential values are never
written into the coordinator event journal. Missing system identity/private-access
evidence stops. [System identities](https://vercel.com/docs/environment-variables/system-environment-variables).

New-project-only protected-preview access is separate from the existing staging
API bearer. The driver/browser add its automation-access header only on the exact
approved origin, including page assets; ordinary API authentication and LINE
signatures still run behind it. No access token enters browser storage, URL query
strings, foreign calls or public artifacts. Exact-origin browser interception
rejects redirects and serves the real fake-file bytes.

`run-load.cjs`/`load.cjs` retain 120-second warmup, 600 measured seconds, the 12/5/3 mix,
one/five clients, one in-flight request/client, one new request/second, no catch-up,
20 successful samples/variant, original latency limits and the combined 1,800-second
clock. All client tasks settle on failure; a failed or ambiguous run cannot proceed
to a checkpoint before ingress/backend reconciliation. Strict live observations
remain mandatory, including a separately sealed coordinator budget and its host
headroom; this extra process is not hidden in the app or driver measurement. `capacity-oracle.cjs` ports the original independent business
projection unchanged, using a sealed frozen baseline instead of another active
live source and a scoped read-only target observer. Archive timestamps and the
baseline revision retain their PostgreSQL types. Its lifecycle precondition is
closed durable admission plus drained backends. Original-row, complete archive /
security metadata and generated-checkpoint recovery evidence remain mandatory.
The load entrypoint captures a new checkpoint through a target-bound verify-full
backup service and compares all 24 archive tables, environment identity and 15
metadata sections; it never trusts a predeclared success flag. Recovery remains
a paired subsequent gate. Component checks cannot certify a hosted target.

`seals.cjs` binds source, app tree, fixture and adapter hashes. Every active CLI
refuses the checked-in disabled packet before reading a supplied secret path.
`protocol.cjs` checks the complete traffic forecast, original strict telemetry and
recovery timer including retrieval/key recovery, any new-test-source pause,
provisioning, restore and read-only readiness. The app runtime's coordinator
round trips are part of measured latency; do not subtract their cost to pass.

Local validation passes **600 application regressions, 39 unchanged local-harness
checks, 83 new controls, lint/typecheck and both credential-free builds**. Lint has
only the inherited `shipmentRow` warning. A new disposable synthetic PostgreSQL
container exercised the actual built app, desktop/mobile forms, exact fake bytes,
precommit rollback/retry, committed acknowledgement loss/replay, multipart load-ledger
metadata matching the actual stored command intent, all six real process-exit boundaries
(one synthetic trial each), accepted-reply uncertainty and correct restart replay. Its generated checkpoint
restored all 51 tables/15 metadata sections. A SELECT-only login could not write
or assume the writer role; the restored app read successfully, refused mutations,
replayed no provider effect and left the complete fingerprints unchanged. Reader
policies/roles belong only to these new synthetic fixtures and precede their
checkpoint. No hosted permission was changed. This proves local adapter wiring,
not hosted platform behavior, off-site encryption/key recovery, hosted RTO/RPO
or a newly executed real capacity campaign.

```sh
env -i PATH="$PATH" node --test tools/migration/hosted-write/adapter.test.cjs tools/migration/hosted-write/integration.test.cjs tools/migration/hosted-write/protocol.test.cjs
node tools/migration/hosted-write/inspect-packet.cjs
node tools/migration/hosted-write/seals.cjs
# Creates and removes only its new synthetic local container and private test copy:
bash tools/migration/verify-hosted-tooling.sh
```

The synthetic integration runner accepts an explicit existing local Docker socket;
it never changes Docker context, reads saved registry credentials, resets retained
databases or invokes hosted APIs. CI runs it alongside all prior checks and uploads
only sanitized synthetic reports. Failed setup attempts are retained privately:
Docker's missing Desktop credential helper, an underscore-prefixed Next route,
test certificate ownership/names/CA wiring, absent build-time request-key script
and the original handler's 500-versus-wrapper-503 distinction. Corrections preserve
certificate validation, source routes and native status contracts.

**Resolved recommendations, not activation.** The companion
[`proposals.json`](../tools/migration/hosted-write/proposals.json) records these
concrete decisions for review:

| Subject | Recommendation | Current execution result |
| --- | --- | --- |
| Monitoring | Retain the original one-second / ten-second CPU capacity gate. A separately named 60-second functional/latency observation protocol may be reviewed, explicitly excluding unavailable short-window CPU and complete infrastructure-memory certification. No interpolation, resampling or automatic downgrade. | Strict capacity BLOCKED; alternative unapproved and inactive. |
| Traffic | First approve a target-only pilot capped at 50 MB. Seal functional, browser, load, database-wire, backup/recovery and coordinator/monitoring upper bounds; use at least 2x forecast plus 25% wire allowance, a 1 GB test cap and at least 2 GB protected-source reserve. An absent/over-budget forecast stops. | Complete campaign not quoted/certified; no pilot run. |
| Shared allowance | A driver cannot hard-cap unrelated source usage in the selected organization. If a current allowance and bounded source-consumption reserve cannot be established, stop and request an isolated test-organization quote or a smaller explicitly approved scope. Never upgrade or increase the cap automatically. | Original organization remains selected for its existing quote only; no new organization selected/created. |
| Uploads | Keep the 10 MiB image / 20 MiB file contracts and separate normal 256 KiB fixtures from full compatibility. Recommend a separately reviewed direct/streamed-file design, or a separately quoted persistent app host with an explicitly approved aggregate-request contract. | Full Vercel payload compatibility NO-GO; no limit/provider/architecture changed. |

The order endpoint also accepts multiple files without a finite aggregate limit;
a fixed 32 MiB host setting alone cannot establish its whole contract. Vercel's
body boundary applies regardless of whether Sheets or Supabase stores records.
These recommendations make the blocking decisions reviewable; they do not waive
the gates, approve an alternate protocol or authorize new resources/hosted writes.

**Target sequence: F is now created; the remaining targets are proposed only.** The owner selected `volkswg's Org` for the quote
initially (`yntcfbkilwulyhkslhbx`); the later Go ahead covers the new
Free test target/test writes. Initial inspection found one active project; the
new F target is separate and consumes the second active slot. Use new independent projects, not a branch or reset of
the populated source. Proposed region is `ap-northeast-1`, matching the source for
this rehearsal; it does not assert optimal production latency. Pin PostgreSQL 17's
actual target patch/extensions before restore and stop on incompatibility.

| Stage | Proposed project name | Purpose |
| --- | --- | --- |
| F | `sm-ha-20261112-f` | Fresh supported functional campaign and platform checks |
| RF | `sm-ha-20261112-rf` | New restore of F's generated checkpoint; read-only app |
| L1 | `sm-ha-20261112-l1` | Fresh capacity fixtures and one-client profile |
| RL1 | `sm-ha-20261112-rl1` | New restore of L1's generated checkpoint |
| L5 | `sm-ha-20261112-l5` | Fresh copy of the same pre-load fixture checkpoint; five clients |
| RL5 | `sm-ha-20261112-rl5` | New restore of L5's generated checkpoint |

These are names for a proposed sequence, not six active deployments or known
project references. Actual refs, UUIDs, endpoints and credential references remain
unassigned until separately approved provisioning. Bind and recheck all identities
before the first restore/setup write. Never use the source UUID
`160669bd-2f6f-4490-9259-bada5a1d02c4` as a writable test identity. Recovery clones
retain the writer's UUID only during exact comparison and stay endpoint/credential
isolated. A duplicated UUID never establishes that an endpoint is safe.

The Free candidate uses at most one new active project alongside the protected
source. A completed new test project could be preserved and paused **only after
separate explicit approval**, a paired checkpoint/ledger capture and independent
download/decryption/checksum/dump-readability verification; then the next fresh project could use that active
slot. This pre-pause artifact check is not the later full database-restore PASS.
Do not reset old targets or delete evidence to fit a quota. If member-level
eligibility, pausing or retention cannot support this sequence, mark it BLOCKED.
Free paused-project restoration has a 90-day platform window; retain independently
recoverable artifacts and an owner-reviewed retention date instead of relying on
that window. [Quota rules](https://supabase.com/docs/guides/platform/billing-faq),
[pausing](https://supabase.com/docs/guides/platform/free-project-pausing).

**Costs checked 2026-11-12, USD; no purchase or spend confirmation.** The read-only
new-project quote for the selected organization is **$0/month**. It is not a quote
for the whole test campaign. The current authorized incremental spend is **$0**.

| Item | Prepared cost / decision |
| --- | --- |
| New eligible Free project | Quoted $0/month; recheck quota and quote before each future creation. F created after owner approval; later targets uncreated. |
| Free constraints | 500 MB database and up to 500 MB RAM; stop at 400 MB database usage and at 80% of actual measured memory allocation. This differs from the local 1 GiB profile. |
| Traffic | Free uncached egress is 5 GB/month, shared with existing usage. Proposed test ceiling 1 GB, plus at least 2 GB reserved for the protected organization; actual remaining allowance is unknown and must be evidenced first. Pausing does not reset usage. |
| Hosting / private artifacts | Vercel allowance and encrypted off-site storage/egress are unquoted. Require evidence of existing approved allowance; no subscription, add-on or paid collector may be activated. |
| Paid comparison only | Micro is $0.01344/hour/project (about $10/month). A separate Pro organization starts at $25/month with $10 monthly compute credit: one retained Micro is about $25/month total; six retained Micros about $75/month, before usage/tax. No paid option selected; do not upgrade the existing organization. |
| Branch alternative | Excluded: branching is metered and compute credits do not cover it. It is not a free copied-data restore. |

Paid projects cannot be assumed pausable, and compute is outside the spend cap.
Stopping a test app does not stop project compute charges. Any future paid proposal
therefore needs a separately approved retention/stop-cost strategy; this packet
does not authorize deletion. Sources: [pricing](https://supabase.com/pricing),
[compute billing](https://supabase.com/docs/guides/platform/manage-your-usage/compute),
[egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress),
[branching](https://supabase.com/docs/guides/platform/manage-your-usage/branching).

A no-cost full campaign is **not yet established**. Local one/five-client database
sizes were 78,042,803 / 81,196,723 bytes, but those measurements exclude a new
hosted project's platform overhead and do not certify hosted memory. The load
alone offers up to 4,320 warmup+measured requests, including 2,592 reads; functional,
browser, backup and verification traffic is additional. At a hypothetical 4.5 MB
per read, those HTTP responses alone would be 11.664 GB. That is an upper-bound
illustration, not a measured forecast; database wire traffic also counts. Require
a bounded target-only traffic pilot and conservative complete-run forecast before
full writes/load are enabled. Stop before spending the protected allowance, not
after a Free restriction affects the source.

**Entry gates before later execution.** All are currently unapproved or unrun:

1. Approve exact resource names/organization/region, cost and retention limits,
   project creation, target-only restore/setup/test writes, any new-target pause,
   and protected-source read-only comparison separately from production cutover.
2. Review the locally completed hosted fake-provider/egress/browser adapter and
   verify its actual private target/network/TLS behavior after approval. Current
   `runtime.cjs` and `capacity-context.cjs` deliberately refuse non-loopback targets,
   hosted authorization and Vercel environment variables. Never disable those
   guards or simply replace a local connection URL. A private local app connected
   to remote SQL can establish only that narrower scope, not hosted Vercel behavior.
3. Use a separate test app project/preview (`stock-management-hosted-acceptance`,
   actual ID/origin unassigned), real `VERCEL_ENV=preview`, private access and new
   server-only target credentials. No production domain, source credentials or
   real integration secrets. Preserve the production refusal; do not spoof it.
4. Reseal source/build/fixture/inventory/adapter hashes, all target identities,
   connection modes, provider quotas, complete traffic forecast and telemetry.
   Prefer a verified session pooler path for the existing transaction-bound app;
   validate any transaction-pooler alternative separately. Use direct TLS for
   restore/backup where reachable, or a proven session-pooler alternative, never
   transaction pooling for exported-snapshot/recovery sessions. No IPv4 add-on is
   purchased; missing connectivity is BLOCKED. [Connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres).
5. Recheck the independently recovered **post-audit-removal** source backup, not a
   mutated local test copy. Preparation rehashed all 14 retained manifest entries;
   the saved receipt proves independent download/decryption and complete 51-table /
   15-metadata recovery. Restore and compare before enumerated copy UUID/login
   deltas, then reseal all 51/15. Seed only new synthetic records. This saved
   snapshot does not certify current Sheets freshness; no new export is authorized.

Keep private schemas inaccessible to Data API `anon`/`authenticated`; use separate
owner, backup/read-only and nonprivileged runtime identities, verified TLS, login
limit 6 and app pool max 2. Do not use a service-role/owner app connection. Preserve
the existing token, signature-only LINE entrypoint and idempotency checks. Fake
providers must fail closed on unknown calls and reconcile their complete outcome
graph. No real LINE webhook registration, Loyverse sync, Drive upload or fallback.

**Execution and pass/fail criteria.** Future execution is sequential: F → RF → L1
→ RL1 → L5 → RL5, with frozen evidence before every transition. One full hosted
functional campaign is proposed in addition to the two completed independent local
campaigns; it is not a claim of two hosted campaigns. Run the same reviewed
supported WT00–WT15 inventory and repetitions: 32 ordinary scenarios with 20
same-key pairs, 20 stale-state pairs, 20 old-key replays and a precommit rollback;
100 browser form / 20 raw-image trials; 60 crash, 80 compound rollback, 40 signed
image rollback, 10 shipping rollback and 20 uncertainty trials. Preserve reviewed
N/A for absent success operations and all deliberate fake unknown/orphan fixtures.
Hosted-only fake adapter, pooling, cold start and platform tests are additional.

| Gate | PASS | FAIL / BLOCKED |
| --- | --- | --- |
| Target/baseline | Approved new endpoint+ref+UUID; all 51 tables/15 metadata match, with only explicitly approved setup deltas resealed | Wrong/missing identity, unavailable baseline or unexplained delta: BLOCKED before traffic |
| Existing controls | Unauthorized ordinary requests and invalid LINE signatures denied; valid signed fake events work; least privilege/TLS/private access intact | Any bypass, real egress or privilege drift: FAIL and stop ingress |
| Write correctness | Exact deterministic cells, money/stock/payroll totals, revisions and command bodies/statuses; zero tolerance; all 70,777 copied originals, 24 archive tables and 15 security sections unchanged | Any wrong total, lost/partial commit, duplicate effect, changed original or unexplained outcome: FAIL |
| Retry/fault behavior | Same-key replay is exact; changed intent/stale edits rejected; intentional unknowns equal named fixtures and stay guarded | Blind retry, automatic resend or untracked fake orphan: FAIL |
| Capacity latency/reliability | One then five clients, each 120 s warmup + 600 s measured; original 12/5/3 mix, 256 KiB fixtures, no catch-up, one in-flight/client, at most 1 new request/s/client; at least 20 successful samples/variant; read/simple/compound p95 ≤2/3/5 s and every normal request ≤10 s; zero unexpected errors | Threshold/error/oracle breach: FAIL; insufficient samples, stale telemetry or exhausted combined 1,800 s budget: BLOCKED/INCONCLUSIVE |
| Resource/cost | At least 20% headroom in actual sealed hosted budgets; pool 2/instance, runtime login 6 with ≤4 runtime backends total; provider backend/client limits include managed services; no quota or protected traffic reserve breach | Missing enforceable quota/telemetry/budget, unexpected restart/OOM, overage or scaled instance/pool breach: stop; never resize or increase budgets to pass |
| Recovery | Every generated checkpoint restored into a new target; all 51/15 match before/after a provider-denied read-only app; writes denied; no provider replay; zero acknowledged sealed-checkpoint commands lost | Any mismatch, write/provider activity or readiness beyond 900 s: FAIL. Clock includes checkpoint retrieval/key recovery, any new-test-source pause, provisioning, role setup, restore and readiness; backup capture is reported separately |
| Protected source/production | Approved separate read-only comparison matches source hashes; production storage/configuration unchanged | Missing source permission/proof: BLOCKED; an unexplained protected-state change: FAIL |

Record nearest-rank p50/p95/p99/max per concrete route/client and class, cold start
separately, offered/started/completed/timed-out/unstarted slots and actual traffic.
The capacity levels must use fresh clones of the **same sealed pre-load seed**;
never load-test the completed functional data or reuse level-one growth. Keep the
original combined load clock through the intervening comparison/recovery stages.
Provider default max_connections is read and sealed, not forced to the local 24;
reserve ≥20% overall plus at least five connections. Capture the actual serverless
instance count: pool max 2 is per instance, not a global connection cap.

**Explicit observability and payload limits.** Supabase's public Metrics API guide
recommends 60-second scrapes; current pricing excludes its endpoint on Free.
Account entitlement and actual series freshness must be verified. Polling minute
data every second cannot prove the local one-second resource/10-second CPU rule.
Keep app/driver and SQL aggregate sampling where supported; a full hosted resource
capacity PASS requires equivalent coverage or a separately reviewed explicit
hosted protocol. Otherwise retain only measured latency/reliability results and
mark strict resource capacity BLOCKED—never infer it from a green dashboard.
[Metrics](https://supabase.com/docs/guides/observability/metrics),
[sampling guidance](https://supabase.com/docs/guides/observability/metrics/vendor-agnostic).

Vercel's 4.5 MB function-body limit also differs from the app's 10 MiB image /
20 MiB file limits. Test normal 256 KiB payloads and exact serialized boundary
sizes, including multipart overhead and large responses. A pre-handler 413 is
platform-boundary evidence, not proof that the advertised application limit works.
Full payload compatibility is BLOCKED where required flows cannot fit, pending a
separate scope decision. Do not silently shrink limits, change file providers or
add an upload workaround. [Platform limit](https://vercel.com/docs/errors/function_payload_too_large).

**Evidence and stop behavior.** Keep private 0700 directories/0600 artifacts with
source/deployment/adapter hashes, reviewed cases, private HTTP/provider journals,
exact before/after projections, timestamped metrics/costs, paired backup/ledger
checksums and fresh recovery proofs. Publish counts/case IDs/digests and sanitized
failures only, never business rows, raw logs, credentials or screenshots. Stop
only new-copy ingress on failure, drain/record uncertainty and retain every failed
target. No reset, source repair, automatic cleanup, backup scheduling, provider
resend, merge/promotion or production switch. Use PASS / FAIL / BLOCKED / NOT RUN
per gate; preparation completion is not execution approval or production readiness.

**Production requirements and price proposal — no purchase.** Choose the region
with measured latency to the intended Vercel region, a separately identified
production project, a supported pinned PostgreSQL version, measured disk/index/WAL
space plus headroom, bounded pools and least-privilege roles. The current code
*deliberately refuses Supabase under VERCEL_ENV=production* and expects isolated
staging identity/auth. Production activation therefore needs a separately reviewed
production target/identity configuration and evidence that the existing access
controls meet the approved production policy; flipping STOCK_STORAGE alone is not
a deployment plan. Preserve this guard during migration acceptance. If adequate
access control is missing, keep a clear NO-GO and defer new user authentication
implementation to its separate milestone.

Official pricing checked on 2026-11-11: Free is $0 with a 500 MB database, two active
projects and inactivity pausing; Pro starts at $25/month, includes $10 organization
compute credit and seven daily backups. A Micro instance is about $10/month.
Pro with one/two/three always-running Micro projects is therefore approximately
$25/$35/$45 monthly before usage, tax and optional services; these are estimates,
not an account quote. Confirm the billing organization and every billable project
before upgrading; compute credits are shared, not repeated per project.
[Supabase pricing](https://supabase.com/pricing),
[compute billing and credits](https://supabase.com/docs/guides/platform/manage-your-usage/compute).
External encrypted-backup storage/egress, Vercel plan changes, optional PITR,
additional compute and real Drive storage need their own measured cost/approval.
No paid resource is implied by this proposal.

**Historical daily backup/monitoring proposal — disabled, superseded by the current critical-path activation packet.** Operator-owned scheduler
configuration (UTC schedules; do not add it to a live service now):

```yaml
execution_enabled: false
source_project: UNASSIGNED_REQUIRES_OWNER_APPROVAL
source_isolation_id: UNASSIGNED_REQUIRES_OWNER_APPROVAL
backup:
  schedule_utc: "0 19 * * *" # 02:00 Bangkok daily
  extra_checkpoint: before_every_migration_and_release
  consistency: shared_snapshot_dump_plus_full_hashes
  required_table_and_metadata_inventory: reviewed_target_manifest
  encryption: owner_controlled_key_separate_from_backup_storage
  offsite_destination: UNASSIGNED_REQUIRES_APPROVED_PRIVATE_STORAGE
  retention_proposal: {daily: 14, weekly: 8, monthly: 12}
  deletion_enabled: false
restore_drill:
  schedule_utc: "0 20 * * 0"
  target: new_disposable_isolated_database
  checks: [tables, security_metadata, original_rows, read_only_app, no_provider_replay]
  rto_minutes: 15
monitor:
  sample_seconds: 60
  warn_budget_used_percent: 70
  stop_budget_used_percent: 80
  stale_backup_hours: 26
  alert_on: [backup_failure, hash_mismatch, auth_or_tls_failure,
    unexpected_5xx, timeout, deadlock, pool_exhaustion, oom_or_restart,
    orphan_upload, uncertain_effect, duplicate_command, cost_budget_breach]
  notification_destination: UNASSIGNED_NO_MESSAGES_SENT
```

Before activation, assign accountable operators, grant the backup role only the
required private-schema read/export access, test that RLS cannot silently omit
records, cap reader memory/concurrency and retain existing bounded backup timeouts.
Use secret storage for credentials/keys, never logs or browser configuration.
Keep an independent downloaded/decrypted copy and verify a fresh restore plus
provider-denied read-only app readiness; capture-time checks alone are insufficient.
Report RPO only for acknowledged operations in a sealed checkpoint. Unknown provider
outcomes need reconciliation, never automatic replay. Proposed retention does not
authorize deleting any existing backup or recovery resource.
Supabase managed database backups omit stored file objects; separate Drive/file
inventory and recovery need an independently authorized design and verification.
[Database backup scope and retention](https://supabase.com/docs/guides/platform/backups).

**Final Sheets refresh/freeze proposal — no new export.** Obtain approval for an
exact source workbook, approved export identity, maintenance window and user/LINE/
Loyverse pause procedure. Inventory every writer, including background jobs and
manual edits; record acknowledgements and capture the last accepted command/event
before a freeze. Create an encrypted pre-freeze recovery point, then a consistent
final Sheets export with formulas/raw cells/column order and exact financial JSON
numbers preserved. Hash/reconcile every original row, key relationship and business
report into a new target; no floating-point or timezone normalization to make a
mismatch pass. Compare the final source under the same documented freeze. If
writers cannot be reliably paused, reject the freeze/cutover gate; do not call a
moving export a final snapshot. Reopening writes invalidates the sealed refresh
and requires a newly approved reconciliation window.

**Deployment and rollback proposal — not executed.** Pin the last known working
Sheets production release/configuration and a separately reviewed Supabase release.
Provision/restore/reconcile the production target only after explicit approval;
set production credentials server-side and resolve production auth/identity guards
without weakening them for tests. Stage a protected candidate, run read-only smoke
checks and the approved user/account permission matrix, and rehearse rollback on
disposable infrastructure. A separate cutover authorization names the exact release,
project/UUID, final snapshot, maintenance window, operator and stop thresholds.
Enable only one write authority, release a small approved cohort, then monitor
money/stock/payroll invariants, duplicates, error/latency and resource budgets.
Never silently fall back to Sheets during database failure.

Before new-database writes begin, rollback can restore the pinned Sheets release
and thaw the verified source. After any acknowledged new-database write, **stop
new writes and reconcile the post-freeze delta first**; simply returning traffic to
stale Sheets loses work and may duplicate provider effects. Preserve both stores,
command/effect ledgers and backups; obtain explicit authorization for any reverse
import. Uncertain external outcomes need manual reconciliation before replay.
No automatic database restore over production, dual writing, provider resend or
source overwrite is part of this preparation.

**Required go/no-go evidence.** All supported local cases in two independent fresh
campaigns; reviewed N/A for absent business operations; bounded capacity with the
unchanged limits/headroom; complete read-only recovery readiness; protected original
hashes; current CI/security/bundle checks; isolated hosted write/pooling/protection
acceptance; verified adequate existing production access controls/roles; independently recoverable
backups including image policy; a verified final source freeze/reconciliation;
approved project costs; exact release/cutover and rollback ownership. Any missing,
flaky, failed or unavailable mandatory gate is NO-GO, not a conditional PASS.

**Exact later approvals:** (1) disposable hosted project/UUID, preview, copied-data
restore and hosted write/fault/load tests, with cost cap; (2) production organization,
project/region/compute/add-ons and recurring backup/monitoring spend; (3) production
target identity/control configuration and deployment/merge that triggers production
(new user authentication is a separate milestone); (4) named Sheets
read/export/freeze and controlled ingestion; (5) final activation/cutover window;
(6) any post-write reverse synchronization or destructive rollback. These approvals
are independent. Completing local work authorizes none of them.

##### Image retry fix and two fresh implemented reruns (2026-11-11)

The owner authorized the image retry fix and fresh disposable local reruns.
Commit `125543b26b485f7fa5a04c3ae0ab57a6b493be5f` adds one four-line branch in
`src/composition/postgres/route.ts`: raw `image/*` request intent now hashes the
original bytes plus the route-consumed media type. Identical files replay the
stored response; changed bytes/type conflict with 409 before upload. A new key
for an intentional later upload saves the different bytes; replaying the old key
afterward returns its historical response without overwriting the newer image.
JSON canonicalization, ordinary text, multipart behavior and the Sheets bypass
are preserved. No route handler, schema, grant, environment or dependency change.

Six closed, offline regressions exercise the actual wrapper and command/hash
owners: three exposed the old behavior before the fix and all six pass afterward.
A new actual-PostgreSQL command-journal regression also passes on a separate
fresh local database. The original Phase 2 fixture is unchanged; the history
check reverses only the exact four-line addition before checking its original
hash. Browser inputs, response contracts, keys and revision rules are unchanged.
**Older raw-image journal keys computed by the lossy algorithm now safely return
409**, even for the same file. Their bytes cannot be recovered from the old
intent hash; no compatibility guess, journal rewrite or automatic new-key retry
is attempted. This is a staging-only compatibility consequence, not a migration.

The first fixed-code run stopped after 218 requests because the new positive
control used `imageUrl` instead of the existing response's `productImageUrl`.
The raw-byte/type checks had already returned the correct 409. The harness field
was corrected in a separate commit, the stopped copy/logs were retained, and all
its original 70,777 rows were verified unchanged. A private local service-file
format error was corrected before app execution on the new rerun copies; no
database reset, existing-data repair or assertion weakening occurred.

Two **new named copies** were then cloned from the verified untouched local
reference. Each matched all 51 tables/15 metadata before writes. Both used the
same fixed build and pinned corrected harness, with separate fake-provider
ledgers. The app was stopped after the campaigns.

| Check | Each of the two fresh reruns |
| --- | --- |
| Implemented API/browser work | 461 HTTP requests; 17 case entries including the new raw-image gate; 10 PASS for implemented checks, 7 retain broader coverage BLOCKED; zero FAIL. |
| Raw-image proof | First/same-byte replay 200/200; changed bytes and media type 409; new intended key 200 with exact different-byte upload; old key still replays exact body/revision after that later write, without another upload or row/revision change. |
| Other implemented checks | All 31 ordinary mutation methods' existing replay/auth/conflict proofs; receipt overlap/conflict retry, cost-override deletion/history, stock/payroll controls, 20 Orders same-key pairs, 20 stale-edit pairs, ten rollback and ten commit-ack-loss trials, mobile response loss and post-claim restart. |
| Original copied data | All original 70,777 rows unchanged; 24 archive tables and 15 security metadata sections unchanged. |
| Generated checkpoint | Captured and restored into a new local recovery database; all 51 tables/15 metadata match; no app/provider replay. Restore+hash: 3.819 s / 4.626 s. Full read-only recovery app readiness is still NOT RUN. |

Protected hosted staging matches all 51-table/15-metadata before/after hashes;
only bounded read-only TLS access was used (31.15 s preflight, 21.18 s afterward).
Production's 14 environment metadata entries match the PR #63 verified state,
with no STOCK_* override. No production credentials or Sheets records were read,
no hosted write occurred, and production remains Google Sheets.

All **577** regular regressions, **18** synthetic harness controls and the separate
actual-PostgreSQL image regression pass. Lint has only the inherited unused
`shipmentRow` warning; typecheck and both the exact-source credential-free
production build and attested fake-provider private build pass. No dependency,
original fixture, generated route contract or operational schema changed.

Private result receipt SHA-256:
`bf98821afdad1bf869e818503854442a7f54bd7f346ef3a812386d57ae982aef`.
The image defect is fixed and its scoped reruns pass. **Full PR #63 implementation,
seven broader family gaps, complete browser/crash repetitions, provider outcomes,
actual capacity workload/observer/oracle and recovery-app readiness remain
incomplete**; no full local/hosted acceptance or production cutover is inferred.

##### Local completion started: raw-image intent failure (2026-11-11)

The owner authorized PR #63 implementation and execution on fresh disposable
local copies. **Implementation and full acceptance remain incomplete.** The
priority raw-binary correctness check found an application defect, so the run
stopped before a second campaign or capacity load, as the plan requires.
Production remains Google Sheets; no existing data or production setting changed.

Added `local-write/completion.cjs` to run priority identity/auth/seed and raw-image
checks through the real private app/HTTP/PostgreSQL stack. Deterministic fixtures
create two distinct valid 1×1 PNGs, each with correct chunk CRCs and identical
pixels, whose ancillary binary bytes differ but decode to the same UTF-8 text.
The fixture control independently checks PNG structure, CRCs, decompression,
byte hashes and the decoded-text collision. Same-key identical bytes replay
exactly; same-key changed bytes **must return 409**.

The actual movement image route returned **200**, replaying the first image's
response, for the different bytes. Root cause witness:
`src/composition/postgres/route.ts` hashes `request.clone().text()` for non-multipart
requests, losing binary identity. The first upload, identical replay and changed
image received 200/200/200; no second upload/revision/business mutation occurred
on replay. The assertion remains 409: no behavior fix or weakened expectation
is included in this harness change.

A separate bounded capacity engine adds one/five-client pacing without catch-up,
60/25/15 mix checks, per-route/class nearest-rank percentiles, minimum samples,
10-second request deadlines, resource freshness/headroom gates, exact reviewed
correctness inventory/repetition/version prerequisites and failure cancellation.
Its synthetic negative controls cover bad/missing telemetry, slow routes hidden
by fast ones, undersampling, ignored aborts, and failure without retry. It is
**engine/control implementation only**: the fixed app workload, live observer,
fixture/oracle integration and real capacity run are still pending. CI runs the
synthetic controls, never this private campaign or its copied records.

| Evidence | Observed result |
| --- | --- |
| Backup/protected preflight | Independently recovered backup verified; protected staging 51 tables/15 metadata exact; bounded two-reader TLS check 21.60 s, no hosted writes. |
| Fresh copies | New labelled container/volume and two newly restored disposable databases; 51 tables/15 metadata match before setup, only declared local identity/runtime-login setup deltas; original 70,777 rows retained. Prior clusters/copies untouched. |
| First priority run | 83 HTTP requests; WT00 and implemented WT04 checks pass; WT01 retains hosted-only BLOCKED scope; `WT12-RAW-BYTES` FAIL. This is not full family/local acceptance. |
| Stop boundary | New-copy app stopped after the first failure; failed database/provider ledger retained; second copy not exercised; no load/fault expansion or blind retry. |
| Integrity afterward | All original copied rows unchanged; 24 archive tables/15 security metadata sections exact in both copies; unused second copy all 51 tables/15 metadata exact to baseline. |
| Protected staging afterward | All 51 tables/15 metadata equal the before snapshot; read-only two-reader TLS check 26.32 s. |
| Failed checkpoint recovery | Captured and restored into a third new local database; all 51 tables/15 metadata match, restore+hash 3.256 s; no app start/provider replay. Read-only app probe and full recovery acceptance remain NOT RUN. |
| Production | All 14 production environment metadata entries match the PR #63 verified state; no STOCK_* override, no production credential/data read and no storage switch. |

The unchanged application inputs passed all 571 existing regressions, typecheck
and isolated credential-free private build (443 unchanged source/assets checked,
one attested fake-Drive factory substitution). All 18 synthetic harness/oracle/
fixture/capacity controls pass with loopback permission; an initial restricted
redirect-server control failed with listen EPERM, then passed with loopback access.
Lint retains only the inherited unused `shipmentRow` warning. Source, routes,
schema, grants, original fixtures, environment and dependencies are unchanged;
CI only adds the new synthetic test files to its existing harness check.

Private evidence receipt SHA-256:
`76ade0b3dd8850a7d274d7fa2b2e950f3461b35e7448b7ee15d560963b2be130`.
Private identities, records, credentials and payloads remain outside Git.
Next: a separately scoped review of binary intent preservation, then complete
the remaining per-variant matrix/provider outcomes/upload/LINE/UI/fault controls
and two fresh correctness campaigns before capacity and read-only recovery-app
checks. The rest of PR #63 is **pending**, not silently marked implemented or PASS.

##### Remaining local coverage and capacity completion plan (prepared only)

**Planning only: no new harness implementation, fixture write, fault, load run,
restore, resource/configuration change or live-data inspection is authorized or
performed by this update.** Baseline: merged [PR #62](https://github.com/volkswg/stock-management/pull/62),
`40cc91cd2711559a249d43163ec38008385854d0`; source-matched
[CI run 42996521762](https://github.com/volkswg/stock-management/actions/runs/42996521762)
passed before merge. Production deployment was verified READY at that merge
with unchanged environment metadata and Google Sheets storage. Those are prior
receipts, not new production/data checks made during planning.

Two earlier copies each completed 455 HTTP requests and all implemented checks;
that does not prove every variant in any of the 16 families. This plan completes
**current-contract local** coverage and a bounded local capacity rehearsal.
Hosted Supabase Data API/pooler/protection, real provider integration and production
activation remain separate gates. A later owner instruction must authorize the
harness work and local execution packet; merging this plan alone runs neither.

**1. Freeze the case inventory and resolve scope before implementation.**
Inventory the pinned 35 API files, 31 ordinary mutation methods plus signed LINE
entrypoint, actual UI actions, validators and transition tables. Give every
success/rejection/retry/fault variant a case ID, current expected status/body,
allowed synthetic row/table deltas, command/revision/effect expectations, oracle,
fixture hash, repetitions and evidence file. Audit all 16 families, including the
nine previously labelled PASS for implemented checks. Record proposed dispositions:

| Requirement | Proposed local disposition; no historical result is relabelled |
| --- | --- |
| WT01 hosted Data API and Vercel protection | DEFERRED-HOSTED, excluded from the local denominator only after scope review; local SQL/RLS/auth/production-refusal checks remain mandatory. Bare PostgreSQL cannot certify hosted API/protection. |
| WT02 order cancellation and order soft deletion | NOT APPLICABLE to the current write contract: no exported Orders cancel/delete mutation. Verify unsupported method/path rejection and no delta; verify synthetic legacy cancelled/deleted records are retained/read correctly. A feature addition needs its own scope, not an invented successful mutation. |
| WT03 unlink and shipment cancellation | NOT APPLICABLE as successful writes. No unlink export; the current status use case permits only draft → ready_to_ship → shipping → delivered. Test refusal of cancellation/backward transitions and synthetic legacy cancelled history. Do not infer a cancellation operation from the display enum. |
| Copied historical-row edits | Replace with newly seeded synthetic legacy-shaped fixtures. All original 70,777 business rows, imported archive and original lookup identities remain immutable, including inside the test copies. Never select an original session/order/advance for mutation. |

The relevant contract witnesses are the pinned Orders/Shipments route exports,
`src/modules/shipments/application/update-shipment-status.ts`, and the immutable
route fixture. Record framework 404/405 and validation responses from the current
contract; do not force a uniform status. Until reviewed in the execution packet,
these are **proposed** N/A/deferred dispositions, not PASS. If excluded behavior
is actually required by the business, local completion stays BLOCKED pending a
separately scoped feature decision. Combined local+hosted acceptance stays false.

**2. Extend the test harness, preserving real operations.**
Use actual React UI, HTTP handlers, PostgreSQL adapters/transactions and current
application rules, with the offline Sheets-compatible oracle and independent
financial/stock controls. Add test-only provider outcome ledgers and fault hooks;
no production-source, route, schema or permission change is needed by this plan.
Use synthetic users, events, files, dates and IDs; keep original lookup identifiers
read-only and account configuration unambiguous. Account for any derived report
delta caused by new fixtures without exempting original rows from hash checks.

| Family | Remaining local work | Required pass evidence |
| --- | --- | --- |
| WT00–01 | Re-run target/UUID/role/TLS and all method auth/key gates; forged LINE-path bypass, invalid signatures and isolated production guard | Wrong targets stop before connection/mutation; ordinary token errors 401, invalid MAC 401, configured production/identity refusal 503; direct archive/elevated access denied; no business/journal/effect delta. No production setting is changed to test this. |
| WT02–03 | Full item/bill edits and rejection rollback; synthetic old-shaped links; link retry, bill association, each permitted transition and forbidden transition; unsupported actions above | Exact relationships, amounts, retained history and response contracts; no orphan or duplicate link/upload; source-defined repeat link remains 200/no duplicate. |
| WT04–05 | Missing/zero/invalid movement quantities, both supported journey modes, item edit/delete/image and repeated delivery; adjustment/reversal/replacement/return, invalid cross-account references and physical-count variance | Invalid delivery is atomic; each attributable stock effect occurs once; opening + delivered − net sales − other out + returned in and saved variance match per account/month; original rows unchanged. |
| WT06 | Keep overlap/conflict/corrected-same-key retry regressions; add repeated cursors, cancelled receipts, store/date boundaries and filters, profit/cost-override create/edit/archive/replacement | Exact distinct receipt/item/payment/sync counts; cancelled/filter semantics match current client; no partial completion; dashboard/profit/stock and retained override payloads agree with controls. |
| WT07–09 | Effective compensation and Bangkok day/month edges; valid multiple work shifts versus work/leave conflicts; synthetic unpaid legacy advance pay/cancel, stale settlement and settled-history retention; invalid shop/category mappings, soft-delete and monthly/profit totals | Existing month-selected pay/rounding rules preserved; no double pay/recovery/deduction; invalid edits atomic; independent payroll/expense/profit totals exact. No real employee/legacy ledger row is edited. |
| WT10 | Every upload endpoint: zero, limit−1, exact limit, limit+1, MIME, mixed/multiple files; missing record, replacement, upload failure, SQL failure after upload, cleanup failure and ambiguous provider acceptance | Route-specific size/status contracts: Orders/shipping bill 10 MiB; movement raw image 20 MiB. Rejected input has no business delta; original references never fetched/deleted; every fake file is referenced, compensated, or explicitly unresolved with evidence. Unknown/orphan outcomes cannot be hidden by blind re-upload. |
| WT11 | Full signed order bill/product/total journey and movement shop/quantity/photo/close/resume/summary; both supported movement modes, multiple events, regrouped/reordered redelivery, failed SQL, cleared/failed sessions and invalid command/image | Stable logical events commit once independent of reply token/batch grouping; exact checkpoint/history; failed SQL retries safely; fake replies attempted at most once; claimed/uncertain outcomes remain visible. Pin actual commands, not guessed labels. |
| WT12–14 | Every ordinary method: same/changed JSON, query, multipart and **raw binary** content intent; stale revision, concurrent first execution, replay after unrelated writes, rollback at its write boundaries | Missing/malformed key 428; changed intent/stale fresh operation 409; replay preserves original body/status/headers/revision and adds no effect; binary comparison must distinguish actual bytes. Target rows, journals, statement-level revision and unrelated original rows match expected deltas. |
| WT13 | Actual UI writes beyond Orders; desktop and mobile double-click, reload/reselection, intentional later identical action, post-commit response loss, lost acknowledgement and process restart | Same pending key survives uncertainty and resolves exactly once; a later intentional action gets a new key; no token in browser storage/bundles, blind new-key retry or Sheets fallback. Preserve visible error/retry/success evidence. |
| WT15 | Crash before business commit, after business commit before effect claim, after claim before send, after fake acceptance before outcome recording, and after recorded outcome; regrouped redelivery/restart | Rollback before commit; no repeat of committed business work; at most one fake send attempt for each logical effect; sending/uncertain is retained without auto-resend. Pair SQL state with the independent fake provider outcome ledger. |

Fakes must record attempt **and** acceptance/outcome, not merely that a call was
made. Key fake pagination by immutable account/date/store/cursor fixtures so five
clients cannot race a shared mutable page counter. Fault controls must target the
intended command/transaction and record the exact reached boundary before a crash.
Keep all fault trials separate from load and serialize their control changes.
Test the harness with synthetic fixtures first, including wrong-target/redirect/
provider denial and a deliberately failing control; never weaken an assertion to
turn a discovered application defect into a pass. A needed behavior fix is a
separate reviewed change followed by fresh affected-case runs.

**3. Prepare fresh isolated execution checkpoints, then run correctness first.**
Use only the previously created **task-owned** local cluster if its exact ID,
volume, image, UUID and limits are reverified; otherwise provision a separately
identified new local cluster in the execution packet. Never write in the original
hosted project, existing read-only preview, production or the two original
recovery containers. Preserve earlier failed/completed copies, backups and ledgers;
create new named databases/build directories, rather than resetting them in place.

Verify the independently recovered post-audit backup/checksums and complete
51-table/15-metadata restore before setup; enumerate only approved copy identity/
login deltas and reseal the baseline. Revalidate TLS expiry/CA and fresh copy-only
credentials. No source credentials or real provider secrets enter the runner,
build, app or browser. Pin source/harness/build/manifest/fixture hashes, actual
hardware, exact local destinations, reviewer roles, workload and limits. Missing
identity, comparator or isolation evidence is BLOCKED before the first test write.
Original rows and all archive/security metadata must remain exact; only newly
seeded synthetic entities and explicitly budgeted journals/effects may change.

Run two independent clean functional campaigns using the **same** reviewed
harness/case versions, each with a separate fake-provider ledger. Each ordinary
method gets 20 fresh same-key concurrent pairs and 20 stale-state pairs where an
actual state-changing operation exists; test no-op/replay routes against their
existing contract instead of demanding an invented revision change. Cover every
method's pre-commit failure point at least once and run ten trials per distinct
multi-table rollback/fault class. Run ten trials **per** browser uncertainty and
crash boundary above, not ten total over mixed faults. Earlier 20 Orders-only
pairs and one mobile/crash sample do not satisfy this completion requirement.
Set a proposed 60-minute budget per functional campaign; budget exhaustion is
BLOCKED, not permission to drop trials. No load starts until local correctness,
reviewed scope dispositions and harness controls pass.

**4. Run the following bounded local capacity protocol.**
This proposes the previous rehearsal latency limits for the **local** copy;
it does not execute or replace the separate hosted capacity gate. Use the full
saved dataset plus declared synthetic fixtures. Prepare distinct, valid per-client
orders, expense masters, shipments ready to ship, account/month scopes and fake
sales days before timing; seal that post-seed checkpoint. No copied historical row
may be used as an editable load target. Start each load level from a fresh clone
of this same checkpoint, so level two does not inherit level one's growth/cache.

| Setting | Proposed protocol / pass criterion |
| --- | --- |
| Concurrency/duration | One client, then five clients. Each level has 2 minutes of unscored warmup and 10 measured minutes; drain all in-flight work afterward. Warmup/load/drain total budget 30 minutes. Record cold startup/first request separately. |
| Pacing | At most one in-flight request per client and one new request/second/client; no queued catch-up backlog. Maximum measured requests 600 / 3,000. Record offered, started, completed, timed-out and unstarted slots plus actual throughput, not just concurrency. |
| Fixed 20-request block | 12 GETs (4 Orders, 3 Inventory, 2 Sales/profit, 2 HR/payroll/advances, 1 Expenses); 5 simple writes (2 fresh orders, 1 expense, 1 stock count, 1 cost override); 3 compound writes (1 multipart order, 1 shipping-bill transition, 1 fresh fake sales sync). Pin concrete URLs, bodies, sequencing and fixtures before execution. |
| Fixture sizing | Multipart uses two valid deterministic 256 KiB images, shipping uses a 256 KiB PDF; sales uses fixed two-page sale/refund data. Allocate distinct account/date/store/cursor and ready-shipment fixtures for every compound operation; no shared control-file edits during load. Oversize/failure cases stay outside normal load. |
| Sampling | Measure from dispatch until full body consumption, including app/pool/lock/fake-provider delay. Keep per-route and per-class p50/p95/p99/max with nearest-rank percentiles. At least 20 successful samples per scheduled concrete route/variant; insufficient samples are INCONCLUSIVE, not PASS or an automatic longer/higher load. |
| Latency | Warm read p95 ≤ 2 s; simple write p95 ≤ 3 s; compound write p95 ≤ 5 s; every normal request ≤ 10 s. Report each route as well as aggregates so cheap routes cannot hide a slow one. Cold samples are separate; a stalled normal request still fails the maximum. |
| Reliability | Zero unexpected 5xx, timeout, deadlock or connection-limit errors; zero incorrect totals/partial commits/duplicate effects. No retries erase a failed normal sample. Deliberate conflicts/faults have separate phases and expected statuses, not a load error allowance. |
| Database limits | Retain the reviewed 1 GiB memory / 1.5 CPU / no-swap container limits and pool max=2; do not tune them to pass. Reverify max_connections=24 and runtime-login limit=6 or block on drift. Keep total client backends ≤19 and runtime-login backends ≤4; reserve monitoring/recovery headroom. |
| Other proposed budgets | App processes combined RSS ≤1 GiB, load driver ≤512 MiB, one functional-browser process group ≤1 GiB; at most one browser/context during functional UI trials, HTTP clients during load. These are budgets to approve/reverify, not allocations performed now. Heap limits alone are not RSS limits. |
| Resource headroom | At least 20% free in each declared memory/connection/storage budget and on host/VM. Budget incremental test storage at 5 GiB, stop at 4 GiB growth, with at least 5 GiB absolute host free disk. Confirm room for clones/restores/evidence first. Stop on a hard-budget breach, OOM or unplanned restart; sustained CPU use above 80% of its 1.5-CPU quota for 10 seconds fails headroom. No resizing/stopping original resources. |

Poll sanitized PostgreSQL counts/wait states, cgroup CPU/memory/pressure/OOM and
app/driver RSS once per second; collect disk and database/index/WAL size every
10 seconds. Keep timestamps and instrumentation overhead. Use short read-only
monitor transactions and before/after counter deltas, without resetting stats or
logging SQL text/binds. PostgreSQL stats can lag and are cached within a transaction,
so a single long monitoring transaction is unsuitable ([PostgreSQL 17 monitoring](https://www.postgresql.org/docs/17/monitoring-stats.html)).
Docker CPU/memory limits and memory+swap semantics must be verified, not inferred
from a dashboard percentage ([Docker resource constraints](https://docs.docker.com/engine/containers/resource_constraints/)).
Missing metrics, counter resets, machine contention or an unenforceable budget
make the capacity result BLOCKED/INCONCLUSIVE; never stop unrelated workloads or
increase limits silently. Report shared-host limitations and the offered workload;
a pass is not an estimate of production peak traffic or hosted pooling behavior.

At the end of each level, stop ingress, account for every acknowledged command,
compare exact final rows/revisions/journals/effects to the seeded oracle and
independent workload ledger, and rehash all original rows/archive/security
metadata. Revision expectations count mutating SQL statements, not HTTP requests.
Do not run full fingerprints/backups or large oracle computations during timed
load; include their recovery cost afterward instead of distorting the sample.

**5. Prove recovery/protected-state boundaries and publish a scoped result.**
Freeze each completed checkpoint with its paired provider ledger, capture and
restore into a fresh named local target, and match all 51 table hashes/15 metadata
sections including commands/effects. Add a provider-denied, explicitly read-only
app probe on the restored copy; the current write-only test preload will need a
reviewed recovery-read-only mode before that probe. Never start a writable restored
webhook or automatically resend sending/uncertain effects. RTO ≤15 minutes runs
from declared new-target recovery start through restore, hash verification and
read-only app readiness; backup capture duration is reported separately. RPO=0
only for acknowledged operations inside that sealed checkpoint, not unknown
provider outcomes or later writes. Keep the previous backup/tooling intact.

With separately authorized read-only operator access, compare the original hosted
staging 51-table/15-metadata snapshot before/after; verify production environment
metadata is unchanged/Sheets without reading production Sheets or invoking live
providers. Source access stays in a separate process, never in the writer.
If source verification is unavailable, protected-state acceptance is BLOCKED;
this plan itself performs no live read. Never freeze or modify original data for
this local rehearsal.

Stop immediately on isolation/permission/egress failure, original-row/metadata
change, duplicate business effect, unexplained total, untracked orphan/uncertain
outcome, resource breach or failed recovery. Disable only new-copy ingress, retain
the failure/ledger/journals, and report FAIL/BLOCKED; no blind reset/new-key retry,
Sheets fallback, original-data repair or cleanup of prior resources. Resume from
a new approved checkpoint only after a scoped reviewed fix.

Deliver a private 0600/0700 execution packet with per-variant results, API/UI
proofs, expected/actual row and money/stock deltas, fault-hit records, paired
provider outcomes, load distributions/resource curves and restore checksums.
Publish only counts, case IDs, sanitized failures, commit/CI links and hashes.
Operator/business/recovery reviewers sign their parts. A **LOCAL PASS** requires
every in-scope supported variant in both campaigns, all repetition/resource/load/
recovery/protected-state gates and explicit reviewed N/A/deferred dispositions.
Any missing or flaky mandatory local variant is BLOCKED; assertion failure is
FAIL. Hosted/full-platform/real-provider/production readiness remains NOT RUN or
BLOCKED regardless of local success. This scoped local label supersedes no prior
combined-acceptance result and never authorizes a production storage switch.

##### Cost-override deletion fix and two local reruns (2026-11-11)

The owner authorized fixing the WT12 deletion defect and rerunning disposable
local writes. Commit `4aac657b705720a386336d655aa47da731207aea` enables the
existing `clearAsArchive` behavior **only** for `salesProfitCostOverrides`.
The existing worksheet-style clear now archives the SQL row, preserving its ID
and exact business cells, and excludes it from active reads. The common identity
guard, other bindings, schema, grants and normal Sheets behavior are unchanged.
No existing stored record is migrated, deleted or rewritten by this code change.

A new real-PostgreSQL regression failed before the fix and passed after it on
separate dedicated local databases. It verifies that a different nonblank ID is
still refused, deletion increments the row revision once while retaining the
original ID/payload, repeated deletion is a no-op, and setting a replacement
creates a distinct active identity. The immutable Phase 2 fixture remains
unchanged; its source witness permits precisely the one scoped binding addition.
The secret-free operational CI suite includes this regression.

The earlier failed copy was preserved under a distinct name. A fresh campaign
copy was cloned from the verified task-owned reference, and both campaign
baselines matched all **51 tables / 15 metadata sections** before writes.
The newly built private app retains fake providers and independent outbound
refusal. Both complete **implemented** runs used harness commit `943f870`:

| Check | Each clean-copy run |
| --- | --- |
| HTTP requests / attempted case families | 455 / 16; zero application failures |
| Ordinary mutation-method proofs | All 31: concurrent same-key request, exact replay, query conflict, stale revision and malformed key refusal |
| Explicit concurrency / stale-edit pairs | 20 / 20 |
| Forced multi-table rollback / committed acknowledgement-loss trials | 10 / 10 |
| Mobile UI post-commit response loss, reload and same-key replay | One successful trial |
| Crash after side-effect claim and regrouped redelivery | One successful trial; committed business operation is not repeated and sending/uncertain state is retained |
| Cost-override deletion through actual HTTP | 200; ID/business cells preserved, row revision advances once; fresh-key repeat returns removed=false without a revision change |

The receipt-overlap/conflict fixes also continue to pass. All **70,777 original
copied business records** are unchanged in each campaign. The archive's 24 tables
and all 15 security/metadata sections remain exact. Both generated checkpoints
were backed up and restored into fresh task-owned databases: all 51 table hashes
and 15 metadata sections match, in **3.717 and 3.127 seconds** respectively, with
zero checkpoint loss and no provider replay. Both campaigns and the prior failed
state are retained; the private app is stopped.

**This is not full mandatory acceptance.** Nine families passed their implemented
variants and seven retain coverage gaps: WT01 hosted Data API/protection; WT02
cancel/delete/legacy-update variants; WT03 unlink/full cancellation history;
WT10 oversize/uncertain upload and orphan cleanup; WT11 full LINE/photo/multi-event
journeys; WT13 full browser repetitions/double-click/new-intent cases; WT15 all
before/after-reply crash classes and repetitions. WT12 did exercise the product
image replacement route; that earlier WT10 label is not evidence of missing
route coverage. Generated backup/restore is now verified separately from the
remaining WT15 crash variants. Capacity workloads are NOT RUN. Full-family passes,
hosted write acceptance and production activation remain uncertified.

Final local checks: **571 regression tests, nine safety/oracle checks and one
new real-SQL regression pass**, as do lint/typecheck and an isolated credential-free
production build. Only the inherited shipmentRow warning remains. Final build
inputs match source; the route manifest retains its original hash. No route,
schema, privilege, dependency, environment-template or immutable-fixture change.

Protected hosted staging's **51 tables / 15 metadata sections** match exactly
before/after, and production environment metadata is unchanged with no `STOCK_*`
overrides. Production remains Google Sheets. No hosted write, real provider call,
production-data request, original recovery-resource mutation, merge or cutover.
Draft [PR #62](https://github.com/volkswg/stock-management/pull/62) records the
fixes and scoped results. Private result receipt SHA-256:
`b114a943afd42221ef464410128626013b90097fac1aacbbec4fae2b9261f77a`.
Raw business records, credentials, backups, screenshots and logs stay outside Git.
Next, complete the remaining variants/repetitions and capacity checks before any
separately authorized hosted write rehearsal or production decision.

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
At this initial stop, the next step was the cost-override archive binding fix;
the subsequently authorized fix and reruns are recorded above. Production
activation remains a separate owner decision.

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

This gate is not executable with the current production guard. First verify that
existing production access controls meet the approved policy and separately
review the production target/identity release path. If controls are inadequate,
retain NO-GO; new user authentication is planning only in the next milestone.
Obtain separate owner approval for production environment changes/deployment and
the exact cutover. No Vercel setting changes occur as part of this preparation.
Selection is deployment-level, not an atomic cross-provider switch: a global
write freeze is required to make it safe.

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
