# Google Sheets → PostgreSQL migration

This is preparation and synthetic validation, not runtime cutover. Application ports,
module adapters, composition, business calculations and provider integrations remain
unchanged. `stock_migration` is an unexposed staging schema. Only its database owner
can import; there are no browser, anon, authenticated or service-role grants or RLS
policies. Never expose this schema through the Data API. Application authorization
and port implementations belong to the next phase.

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

4. With separate authorization for live reads, remove `--dry-run`. Export reads
   unformatted evaluated values (dates formatted as strings) and formula cells,
   twice, and rejects changing captures. This is drift detection, not a substitute
   for a write freeze. Decimal JSON tokens are decoded without binary arithmetic.
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
   psql -X -v ON_ERROR_STOP=1 -f migration-artifacts/import.sql
   python3 tools/migration/migrate.py database-snapshot --output migration-artifacts/target.json
   python3 tools/migration/migrate.py reconcile migration-artifacts/source.json migration-artifacts/target.json
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

Existing authorized project: `stock-management` / `orjnazrothkdgmzlsuto`, PostgreSQL
17.11, **Tokyo (`ap-northeast-1`)**. Do not create a replacement or paid branch.
Singapore (`ap-southeast-1`) is geographically closer to Bangkok and may reduce
latency, but measure from the actual application host and consider residency,
recovery and egress requirements. Region selection is a deployment decision;
changing an existing project's region requires a separate migration. This PR
makes no region change.

Free-tier planning baseline: 500 MB database, limited compute/connections,
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
