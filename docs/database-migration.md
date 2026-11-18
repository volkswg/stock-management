# Supabase production operations

## Current production

The Google Sheets → Supabase business-data migration is complete. Browser writes
and LINE are open. The old business Sheets remain read-only; Google Drive images
and the separate private integration-account configuration keep their existing
provider ownership. No new user authentication system was introduced.

The app remains on PR80 source `31af820cbe47a543805c0904ca3db6ad3b2ec085`.
PR81's schema-only change, merged as `2471ac1106a9501f2a084b2d0825572b1b6fb1fe`,
was separately applied on 2026-11-18 after recovery, a supervised freeze and exact
reconciliation. It required no app deployment or environment change. The
[evidence ledger](refactoring/progress.md#latest-production-release) records the result.
This status is the last verified release checkpoint, not a new live inspection.

| Component | Current contract |
| --- | --- |
| `stock_operational` | 23 business tables plus commands, revision, side effects and environment: 27 tables |
| `stock_migration` | 23 retained source tables plus import batches: 24 immutable tables |
| Record identity and ordering | Stable record IDs; native `createdAt`, unknown times last, deterministic ID tie-breaks; feature-specific business sorts remain |
| Authoritative values | Named typed columns; transient row projections preserve existing feature interfaces |
| Retired operational fields | `business_cells`, `row_order`, `created_at_instant`, `cell_kinds` and all 48 `__lexeme` columns are absent |
| Lifecycle timestamps | 47 fields retain their existing `createdAt`, `updatedAt`, `deletedAt` names as `timestamptz` |
| Operational functions | 52: 46 typed mappings, one shared write guard, one statement revision function, three timestamp helpers and one schema contract |
| Operational triggers | 23 row guards and 23 statement revision triggers |
| Timestamp constraints | 23 validated CHECK constraints cover all 47 lifecycle fields, with the existing NULL allowance and UTC years 1–9999 |
| Retained import protection | 48 triggers share `stock_migration.reject_mutation`; source evidence is not operational cleanup material |

Do not modify the hidden compensation identity, primary keys, archive/revision
fields, command/effect journals, policies or retained import evidence casually.
The shared guard preserves empty-text normalization, immutable identity, archived
record protection and automatic row revision increments. It does not automatically
stamp every `updatedAt`. Keep existing date, rounding, null and retry behavior.

## Ownership and source mapping

Use the [23-table catalog](../tools/migration/worksheets.json),
[explicit field policy](../tools/migration/cell-kinds-policy.json) and
[feature ownership map](architecture/migration-map.md). Business calculations
remain in feature-owned applications/adapters. Shared PostgreSQL transport lives
in `src/infrastructure/persistence/postgres`; composition selects and binds it.

The immutable import schema retains original source representations. Retiring
operational sidecars did not authorize deleting archive cells or reconciling away
historical differences. Do not infer a fresh workbook inventory from the catalog.

The private `loyverse_accounts` configuration worksheet is excluded from the 23
business-table export. Never copy its tokens into business tables, fixtures or
GitHub. Attendance `employee_timesheets.shopId` refers to the external account ID,
not the expense `shops.id`. Preserve opaque IDs and approved metadata mappings;
do not invent accounts, employee IDs, relationships or missing historical dates.

## Production configuration and access

The authoritative parser is
[`productionSettings()`](../src/infrastructure/persistence/postgres/database.ts).
It binds the exact database host/project/isolation UUID, production purpose,
runtime login, Vercel project and deployed application commit. A test target is
never implicitly production. Verified TLS and server identity are mandatory.

| Setting | Purpose |
| --- | --- |
| `STOCK_STORAGE=supabase` | Select the PostgreSQL path explicitly |
| `STOCK_PRODUCTION_ENABLED=true` | Enable the production identity profile |
| `STOCK_DATABASE_URL` | Private server-only runtime connection; never use administrator/browser credentials |
| `STOCK_TARGET_ISOLATION_ID` | Must match the approved production isolation UUID |
| `STOCK_PRODUCTION_RELEASE_JSON` | Exact application/source/project/connection binding checked by the parser |
| `STOCK_PRODUCTION_READ_ONLY` | Explicit read-only deployment guard; do not change it as an incidental test |
| `STOCK_LINE_ACCEPT_EVENTS_AT_OR_AFTER_UTC` | Existing LINE migration cutoff; preserve it during unrelated maintenance |

Keep TLS settings and CA material in approved private configuration. Never disable
certificate verification or add URL overrides. Production refuses staging/test
flags and foreign target identities. A schema change's Git commit is not a new
application deployment SHA: do not rewrite the release binding for a docs-only or
database-only release.

Existing service logins have separate roles: runtime writer (six connections),
read-only reader (six), and backup reader (two). Preserve their existing grants,
membership, RLS, limits and credentials. No administrator or bypass-RLS role belongs
in Vercel runtime or a browser. Private schemas must stay private.

Production preserves the owner's existing `legacy-as-is` application access policy.
That is not staff login, RBAC or shop authorization and does not certify those gaps
as fixed. Preserve API restrictions, raw-body LINE signature verification, the
cutoff, idempotency and database controls. The
[authentication roadmap](architecture/user-authentication-roadmap.md) is planning
for the next milestone; this guide grants no security or live-setting changes.

## Recovery checkpoint

Backup automation remains deferred by the owner. A verified one-off checkpoint is
still required before destructive/schema maintenance. Keep business records,
credentials, keys, dumps, hashes and reconciliation receipts on the Mac or approved
private storage. Do not publish them in a PR or upload CI production artifacts.

1. Verify the exact target, purpose, read-only TLS profile and complete SELECT/RLS
   coverage. Use the existing approved private service/passfile setup; never paste
   credentials into shell arguments, documentation or chat.
2. Capture all 51 private tables and 15 metadata sections with one consistent
   exported snapshot. Retain the dump, fingerprint and receipt checksums. An archive
   listing/checksum alone is not a verified restore.
3. Restore into a new empty, network-isolated local PostgreSQL target. Reconstruct
   password-free role/membership metadata, locale and necessary dropped-attribute
   gaps so the strict owner/ACL/column fingerprint remains meaningful.
4. Verify every stored table and metadata section. Rehearse the exact approved SQL
   and a schema-only rollback; compare actual application/LINE consumers and local
   create/edit/archive behavior. No live provider or business canary is implied.
5. An online checkpoint may precede subsequent writes. Recheck all tables and
   metadata under the final write fence. Refresh and restore/rehearse if anything
   differs; a matching revision alone is insufficient.

The versioned [recovery tool](../tools/migration/recovery.py) supports `capture`
and `verify`, exact `--target-id` / `--target-purpose production`, one or two
bounded workers and `--row-digests`. A restricted backup reader also needs
`--row-security-reader`. Its ordinary snapshot takes cooperative writer locks;
do not run it on live production while describing it as a non-blocking backup.
Use the separately reviewed online capture packet when users must keep working.
Do not borrow an old wrapper or assume its timeouts and approvals still apply.

The checkpoint covers the private application schemas and password-free recovery
metadata, not managed Supabase Auth/Storage, service passwords, Drive image bytes
or external provider outcomes. Verify independent encryption/decryption and
off-device key recovery when those are part of the approved backup scope. Do not
claim those properties from a successful local database restore.

## Maintenance procedure

Every live schema/deployment/traffic change needs separate explicit approval for
its exact target, source/SQL hashes and effects. Merge, CI and an earlier closed
window are not fresh execution approval. Keep users running during preparation.

1. **Prepare:** verify merged source and passing CI, current schema dependencies,
   live deployment/env/LINE/protection bindings, fresh recovery and local rehearsal.
   Prepare an exact forward/inverse packet; use original migrations as history,
   not instructions to rerun them against the final production schema.
2. **Confirm the window:** name the supervising owner and reopening/abort deadline.
   Confirm browser/LINE users, direct Supabase editors, jobs and scripts are paused,
   with all pending saves/uploads finished or accounted for without uncertain
   provider outcomes. Pause external writers too; do not assume Vercel covers them.
3. **Fence and drain:** publish only the reviewed temporary rule denying methods
   other than GET/HEAD/OPTIONS. Verify browser mutations/LINE are denied, reads are
   available and active/prepared business transactions have drained. Preserve all
   original rules. LINE retries/WAF denial are not a durable event inbox; this
   procedure relies on the confirmed sender pause. Other event-hold arrangements
   need their own verified loss-safe procedure and approval.
4. **Reconcile:** match the complete frozen checkpoint, not only its revision.
   Capture the same four canonical GET baselines: orders, movements, shipments,
   employees. Keep response bodies private and transient; retain hashes, order,
   type and revision evidence. Stop or refresh recovery on drift.
5. **Apply:** execute only the reviewed operator artifact and hash-bound settings.
   Bind isolation/purpose/revision/source/recovery before and after writer/table
   locks; use the artifact's bounded timeouts. Unknown dependencies, role/ACL drift,
   partial schema or insufficient time are abort conditions. Inspect uncertain
   outcomes before retrying. Never silently repair records to pass a gate.
6. **Verify:** require all 51 table values and metadata unchanged except the
   explicitly approved schema delta, preserving owners/ACLs/RLS, journals, IDs,
   revisions and timestamps. Compare the four HTTP responses exactly. Do not
   replace signed-LINE/provider evidence with an unapproved real transaction.
7. **Reopen:** remove only this window's rule. Verify the original firewall,
   deployment/env, LINE cutoff/signature rejection and idempotency guards, plus read
   availability. Scan the actual live deployment's runtime error counts and save
   private receipts. Reopen users/jobs only after the checks pass.

Vercel's firewall version and publication timestamp change when a reviewed rule is
published. Compare them against that exact active configuration; all protection
settings and original rules must remain unchanged. Do not disable a protection to
make a health check pass or create a broad deployment bypass.

## Rollback and refusal conditions

- Before commit, a failed guarded transaction must roll back atomically. Check
  actual schema state and transaction outcome rather than blindly resubmitting.
- After commit and before reopening, keep the fence active. Use only the reviewed,
  locally rehearsed schema-only inverse if its exact forward-state and revision
  gates still hold. Verify records and original metadata before reopening.
- After reopening, newer acknowledged writes must never be overwritten by an old
  dump or a switch back to stale Google Sheets. Stop, inspect journals/provider
  uncertainty and prepare an approved rollback/reconciliation against current data.
- Application rollback needs an exact compatible schema/deployment/config binding.
  Never assume an older build supports removed columns or new writes merely
  because its reads once passed. Current PR80 code supports the PR81 schema change;
  that specific compatibility is not a general permission to roll back releases.
- Keep protected staging, retained imports and unrelated resources untouched. No
  paid resource, account creation, provider action or fresh Sheets synchronization
  is authorized by this document.

## Operator artifacts and historical procedures

Original versioned migrations are under [`supabase/migrations`](../supabase/migrations).
Released guarded retirement artifacts are under
[`tools/migration/final-removal`](../tools/migration/final-removal); they are outside
automatic discovery and must not be replayed on the already-cleaned schema.
For PR81, the canonical forward artifact is
[`20261118100705_constraint_record_validation.sql`](../tools/migration/final-removal/20261118100705_constraint_record_validation.sql)
and its exact metadata proof is
[`constraint-validation-proof.py`](../tools/migration/constraint-validation-proof.py).
Private checkpoints, inverse SQL and execution packets stay outside GitHub.

Historical export/import, staging, capacity, cost, frozen synchronization and
per-release procedures are indexed once in the
[evidence ledger](refactoring/progress.md#historical-document-index). They describe
their recorded stage and cannot authorize another cutover, overwrite or restore.
For synthetic verification use the [verification guide](refactoring/verification.md);
for the next milestone use the [roadmap](refactoring/roadmap.md).
