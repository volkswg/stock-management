# Project roadmap

## Completed database milestone

The Supabase production cutover and storage cleanup are complete through
[PR86](https://github.com/volkswg/stock-management/pull/86): stable IDs, native
timestamps, operational sidecar retirement, typed mappings and shared validation.
Browser writes and LINE are open. Old business Sheets remain read-only. Current
storage contracts and release gates live in the [runbook](../database-migration.md);
dated proof is in [progress](progress.md#latest-production-release).

Do not restart the migration, rerun import/retirement SQL or treat completed
cutover plans as pending work. Retained import tables, journals, credentials,
snapshots and recovery evidence remain protected. A later live change still needs
its own exact scope, fresh recovery/freshness review and execution approval.

## Current scoped work: retire the remaining Sheets configuration source

Native PostgreSQL business storage shipped in PR87/88 (`296529d`). The current
branch moves the private Loyverse account configuration to an unexposed PostgreSQL
table with read-only runtime grants and token-free metadata reads. Preserve IDs,
order, provider behavior, account mappings, browser/LINE behavior and Drive uploads.
One focused PR contains the additive schema, reader, guarded private import tool,
synthetic acceptance and existing runbook updates. The old business tables need no
resynchronization. Historical fixtures/tools remain evidence, not runtime paths.

Production schema/grants, fresh private configuration capture/import, Vercel source
setting/deployment and real provider checks require separate approval. Original
workbook credentials remain available for rollback; no live retirement is automatic.

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
- Retained semantic service/script interfaces remain; business Sheets and positional
  adapter retirement are part of the currently approved native-storage conversion.

## Gates for future changes

Follow the [architecture rules](../architecture/rules.md) and [verification guide](verification.md).
Preserve financial/stock calculations, dates, IDs, routes/DTOs, LINE transitions,
retry/idempotency and provider ordering. Keep changes focused, use one reviewable
PR when practical, and distinguish implementation/merge from live execution.
Record new evidence once in [progress](progress.md). Historical phase descriptions
and prior local/CI results are indexed there rather than repeated as current plans.
