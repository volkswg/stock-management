# Project roadmap

## Completed database milestone

The Google Sheets-to-Supabase production migration is complete. Business records
and private Loyverse configuration use PostgreSQL. Native IDs/timestamps/media,
row-level edit protection, receipt-owned payments, Product Master and movement
shop IDs are released. Runtime business Sheets adapters and unused integration
wrappers are retired. See the [release ledger](progress.md#latest-production-release)
for exact deployed versus merged status; old preparation headings are not pending work.

Do not rerun imports, sidecar retirement, identity conversion or old rebuild SQL.
Retained archives, command/effect journals, credentials, snapshots and recovery
evidence remain protected. [Operations](../database-migration.md) owns future
release/recovery gates; this roadmap grants no live execution authority.

## Current scope

Consolidate current documentation, link completed procedures to immutable history,
and correct outdated status. Keep production and all existing user/LINE behavior
unchanged. No new feature, authentication implementation, database migration,
provider action, paid resource or deployment is included.

## Next major milestone: user authentication

The separate [architecture and implementation roadmap](../architecture/user-authentication-roadmap.md)
covers login, secure sessions, roles, shop authorization, administration and API
access. It is planning only until explicitly approved. The owner-retained
`legacy-as-is` access policy does not mean those gaps are repaired or new exposure
is authorized. Preserve LINE signatures/cutoff, current API restrictions, TLS,
database grants/RLS and replay boundaries. Historical tracking remains in
[issue38](https://github.com/volkswg/stock-management/issues/38).

## Deferred work and decisions

- Backup automation and failure alerts: deferred, not enabled by documentation.
  One-off recovery remains required for approved destructive/schema maintenance.
- Stock-by-product and warehouse/shop balances: a separate product/schema design;
  Product Master links do not implement an on-hand inventory ledger.
- Broader shop-master identity conversion: LINE movements use `shops.id`, but
  stock-count/adjustment and other account-based consumers still retain Loyverse
  identities/mappings. Do not treat the entire system as converted.
- Further compatibility retirement: browser pending operations, multipart order
  retries, cached command replies, LINE resumption and text-ID rollback support
  need explicit consumer/data/rollback review. They are not blanket cleanup.
- Provider replacement, cross-provider queues/transactions, tenant/billing features,
  wider conflict-merging UI and Workspace redesign require separate requirements.
- Cloud account connectivity must be established independently; repository tooling
  cannot grant Vercel/GitHub permissions or inherit Mac credentials.

## Gates for future changes

Use the [architecture rules](../architecture/rules.md), [behavior invariants](../architecture/decisions.md)
and [verification guide](verification.md). Preserve calculations, Bangkok dates,
IDs, ordering, routes/DTOs, LINE transitions and retry/provider outcomes. Prefer one
focused PR; distinguish source implementation, merge, deployment and live schema
execution. Keep new evidence in the ledger, not a second history document.
