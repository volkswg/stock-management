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

## Current scoped work: remove unused integration wrappers

PR99's operational payment-table retirement and PR101's Sales/API/browser cleanup
are deployed. Remove only unused LINE server wrappers and the synchronous Loyverse
factory, correct internal Sheets names/comments and stale current-status docs,
and preserve current regression coverage through canonical session owners.

Keep production, credentials, migration archives and recovery evidence unchanged.
Browser pending-operation guards, multipart server support, upload reconciliation,
identity rollback and active LINE session resumption remain supported. This is one
application-only review PR, with no database migration or deployment authorization.

## Product Master UAT (current approved feature scope)

Use branch `uat/product-master-from-order-item` for both service and schema.
Create a product from an active order item, reuse its media row, explicitly review
similar products, or link an existing product. Catalogue edits protect the product
row; linking protects the item row. Quantities, remarks, original product codes,
order APIs and LINE journeys retain their existing behavior. No staff login,
automatic historic backfill, stock aggregation or Loyverse SKU mapping is included.

The local UAT uses only synthetic records. Hosted UAT must reuse the existing
`stock-management` project (`orjnazrothkdgmzlsuto`), preserve its data, and fit its
existing capacity. Do not create projects/paid branches, upgrade a plan or add paid
services. Its previous operational schema is retained intact for recovery; the UAT
dataset uses current native tables and synthetic records only. See the
[UAT procedure](../database-migration.md#product-master-uat).
Production remains unchanged until a separately approved release.

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
- Standalone script interfaces remain; business Sheets and positional adapter
  retirement are complete.

## Gates for future changes

Follow the [architecture rules](../architecture/rules.md) and [verification guide](verification.md).
Preserve financial/stock calculations, dates, IDs, routes/DTOs, LINE transitions,
retry/idempotency and provider ordering. Keep changes focused, use one reviewable
PR when practical, and distinguish implementation/merge from live execution.
Record new evidence once in [progress](progress.md). Historical phase descriptions
and prior local/CI results are indexed there rather than repeated as current plans.
