# Project roadmap

## Completed database milestone

The Supabase production cutover and storage cleanup are complete through
[PR81](https://github.com/volkswg/stock-management/pull/81): stable IDs, native
timestamps, operational sidecar retirement, typed mappings and shared validation.
Browser writes and LINE are open. Old business Sheets remain read-only. Current
storage contracts and release gates live in the [runbook](../database-migration.md);
dated proof is in [progress](progress.md#latest-production-release).

Do not restart the migration, rerun import/retirement SQL or treat completed
cutover plans as pending work. Retained import tables, journals, credentials,
snapshots and recovery evidence remain protected. A later live change still needs
its own exact scope, fresh recovery/freshness review and execution approval.

## Current scoped work: media URL retirement

PR84's eleven-column media catalog and five references were released on 2026-11-18.
The owner now approved normalizing Drive URL aliases to `media.sourceUrl`, keeping
the images, public API fields, LINE behavior and Sheets compatibility. Implement
ID-based projections/writes and prepare guarded removal of the five duplicate
operational URL columns in one review PR. Test retained, final and inverse schemas
on fresh synthetic local copies. [Operations and release/rollback gates](../database-migration.md#media-url-retirement-prepared-production-unchanged)
are authoritative. Production remains unchanged until a separate maintenance/schema/
app approval; old apps must not run against the final layout without the inverse.
No new auth, backup automation or optional framework expansion belongs to this task.

## Next major milestone: user authentication

The [authentication roadmap](../architecture/user-authentication-roadmap.md)
covers user login, secure sessions, roles, shop-level authorization, administration
and API access control. It remains planning only until separately approved.
Preserve current LINE signatures/cutoff, API restrictions, verified TLS and database
permissions. The owner's `legacy-as-is` release policy does not mean access gaps
are repaired or new exposure is authorized. [Issue38](https://github.com/volkswg/stock-management/issues/38)
retains the historical security tracking context.

## Deferred work and decisions

- Backup automation/failure-alert activation remains deferred. Verified one-off
  recovery checkpoints remain required for approved destructive maintenance.
- The cross-table Order/Movement revision-conflict fix was released in PR83.
  It uses record-scoped tokens and preserves same-record conflicts. See [evidence and release requirements](progress.md#concurrent-browser-edits-2026-11-18).
  Broader conflict-merging UI and other feature scopes remain deferred.
- Further removal of typed mapping functions needs an explicit adapter/consumer
  migration. Their current count alone is not a removal approval.
- Broader provider replacement, cross-provider transactions/queues, tenant/billing
  features and Workspace redesign need separate product decisions.
- Supported legacy service/script interfaces and the Google Sheets backend remain
  compatibility contracts until their own consumer audit and removal approval.

## Gates for future changes

Follow the [architecture rules](../architecture/rules.md) and [verification guide](verification.md).
Preserve financial/stock calculations, dates, IDs, routes/DTOs, LINE transitions,
retry/idempotency and provider ordering. Keep changes focused, use one reviewable
PR when practical, and distinguish implementation/merge from live execution.
Record new evidence once in [progress](progress.md). Historical phase descriptions
and prior local/CI results are indexed there rather than repeated as current plans.
