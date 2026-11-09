# Google Sheets → PostgreSQL migration

Phase 1 provides the immutable import foundation; Phase 2 adds opt-in isolated
operational persistence. Production still uses Google Sheets. Application ports,
business calculations and provider ownership remain unchanged. `stock_migration`
is an unexposed staging schema. Only its database owner
can import; there are no browser, anon, authenticated or service-role grants or RLS
policies. Never expose this schema through the Data API. Application authorization
for production remains a separate release gate. Phase 3 execution below is a plan,
not authorization to access records, apply hosted migrations or cut over.

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


## Phase 2 operational storage (opt-in isolated testing)

Start point: merged PR48 `57882d2989d5d8d1156c7dc7bdeb5a694050e7ad`.
The operational migration is
[`20261108191839_stock_operational.sql`](../supabase/migrations/20261108191839_stock_operational.sql).
It keeps the 23-table staging archive immutable and creates 23 separate operational
business tables plus command, audit, reply-attempt history and target-isolation metadata. All are private,
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
review command/audit records and Drive ownership before cleanup. There is no
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
identities immutable, advance revisions and append an audit snapshot. Hard-delete
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
The Free-tier database must hold immutable snapshots, operational data, audit,
indexes and recovery overhead; export bytes alone substantially understate disk
requirements. No unmeasured production capacity guarantee is made.

Back up both stock_migration and stock_operational, including commands, audit and
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
value. After a future cutover, stop all writers, retain journals/audit/tombstones
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

Baseline main is `e97a1c9ad9ca9402de33a9796933fece38a92eeb`, after merged PR48
and PR49. The [machine-readable status](../tools/migration/phase3-status.json)
records observations and actions **not executed**, with all 23 real-data row
counts explicitly unknown. No real export/import/reconciliation is claimed.

Metadata-only inspection on 2026-11-09 found stock-management
`orjnazrothkdgmzlsuto`, Tokyo/ap-northeast-1, PostgreSQL 17.11, 10,917,555 bytes,
max_connections=60, no public tables or migration schemas, no stock_runtime role,
an empty migration ledger and no security advisories. This is a staging candidate,
not proof of production isolation. Data API exposure, billing plan, pooler limits,
network restrictions and off-site backups need owner verification. The plugin
role bypasses RLS and must never be the application login. Production remains
Google Sheets; the runtime production guard is unchanged. No hosted write ran.

Cloud readiness is separate from plugin access. This executor reports Google
application configuration, but no PostgreSQL URL/service/password binding,
Supabase CLI token or read-only export token. Supabase destinations are absent
from its configured network policy. Google write-capable configuration was not
read or used. The owner must provision scoped credentials through private
environment settings and approve network endpoints; never paste them into chat
or presume plugin OAuth credentials exist in Cloud.

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
  archive/full-snapshot/audit/command growth and connection counts. Stats row
  estimates supplement exact reconciliation counts; they do not replace them.
- [ ] Recheck [current plan limits](https://supabase.com/pricing),
  [database size](https://supabase.com/docs/guides/platform/manage-your-usage/database-size),
  [backups](https://supabase.com/docs/guides/platform/backups) and
  [pooling](https://supabase.com/docs/guides/database/connecting-to-postgres).
  Free projects commonly have 500 MB database storage, limited compute/connections,
  inactivity pausing and no paid PITR guarantee. Do not assume automatic daily
  recoverable backups on Free. Confirm current quotas in the target dashboard.
  Drive images remain on Drive; exports/dumps and DB traffic still consume space
  and egress. Budget full archive duplication, indexes, audit/replay growth,
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

| Module | Required acceptance on an expendable approved clone |
| --- | --- |
| Orders/items/bills | List/detail/create/update/cancel/soft delete, quantities/prices and image references; multipart upload errors; retry/reload retains key; intentional duplicate payload gets new ID |
| Shipments | Create/link/unlink/status/bill; duplicate links and stale mutations; cancellation and historical links retained |
| Inventory | Journey/item/delivery transitions, stock counts, adjustments/reversals/replacements; exact per-account balances; simultaneous edits and retry races |
| Sales/Loyverse | Original receipts/items/payments, refunds/store/date filters, repeated paginated sync and failures; sync history atomic; unchanged dashboard/profit overrides |
| HR/payroll | Employee/status/compensation history; Bangkok clock-in/out/half days; advances/cancellation, revision conflicts, exact payroll/settlement snapshot and replay |
| Expenses/shops | Ledger/master CRUD and soft delete; existing names/account mappings; amounts, month filters and report totals |
| LINE/session | Valid/invalid signatures; text/photo/multi-event journeys; regrouped redelivery; clearing/history; failed event recovery; uncertain reply quarantine without double business mutation |
| Security/recovery | Missing/wrong bearer, production guard, wrong UUID/TLS/login, readonly SQL, forged LINE path, stale revisions, missing/reused keys, direct Data API/browser SQL denial; no secrets in bundles |

- [ ] Compare original Sheets-compatible fixture and SQL results for every
  existing operation, response/status and state transition; log remaining
  untested/unsupported paths explicitly. Any unexplained difference blocks.
- [ ] Inject concurrent writes, partial multi-table failure, stale views, lost
  COMMIT acknowledgements and retry storms. Require zero duplicate business
  commands, no partial rows and identical financial/stock outcomes.
- [ ] Review terminal failed LINE results, sending/uncertain replies and orphan
  Drive uploads privately. There is no atomic database+provider transaction or
  guaranteed reply delivery. Do not erase journal rows or invent new event IDs.

### Gate 6 — backup/restore and recovery sign-off

The reusable capture/verification tool was exercised on local synthetic promoted
and application-generated states. It uses an exported PostgreSQL snapshot shared
with pg_dump and fingerprints, holding both cooperative writer locks until
completion. The snapshot starts after earlier writers drain. It compares all
51 tables and schema/column/constraint/index/trigger/function/sequence metadata,
effective ACLs, RLS, runtime role flags/memberships and defaults. Equivalent NULL
and explicit default ACL representations are normalized; actual grant changes
fail. No private row/SQL/error body is emitted to ordinary logs.

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

- [ ] Dump **both** schemas, commands/audit/side_effects/environment, sequences,
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
| After SQL writes, DB available | Freeze all writers; preserve a new backup, audit/tombstones, journals/effects and provider outcomes. Prefer a reviewed forward fix against the same SQL state. Reconcile every post-cutover mutation before any return to Sheets |
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
