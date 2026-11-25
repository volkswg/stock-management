# Architecture guide

Business storage and private Loyverse account configuration use PostgreSQL.
Google Drive remains the image provider; there is no runtime Google Sheets business
backend. Orders, Products, Shipments, Inventory, Sales, Expenses, HR and LINE own
their workflows. Shared infrastructure provides transport and transactions;
explicit composition wires feature-owned ports.

The [release ledger](../refactoring/progress.md#latest-production-release) is the
single source for the last verified deployment and the distinction between merged
and deployed work. Product Master, shop-ID movement destinations and the pooling
fix are released. Old business Sheets remain read-only. This guide and its cleanup
do not authorize a deployment, data change or fresh production inspection.

## Find the right document

| Question | Authoritative source |
| --- | --- |
| Where do files belong and which dependencies are allowed? | [Architecture rules](rules.md) |
| Which module owns a workflow/table or retained compatibility path? | [Ownership map](migration-map.md) |
| Which observable behavior must remain stable? | [Decisions and invariants](decisions.md) |
| How are production, recovery, maintenance and rollback operated? | [Supabase operations](../database-migration.md) |
| What is complete, deferred or next? | [Roadmap](../refactoring/roadmap.md) |
| Which release/CI proves a result, and where is earlier evidence? | [Release and evidence ledger](../refactoring/progress.md) |
| How are local, historical and CI checks run? | [Verification](../refactoring/verification.md) |
| How is engineering work scoped and reviewed? | [AGENTS.md](../../AGENTS.md) |
| What is planned for staff access? | [Authentication roadmap](user-authentication-roadmap.md) |

## Feature guides

[Expenses](../expenses.md), [movements](../movement-migration.md),
[stock adjustments](../shop-stock-adjustments.md) and
[LINE menu links](../rich-menu-links.md) retain their established paths. They
describe feature behavior; the operations guide owns storage/release safeguards.

## Documentation ownership

Record release status once in the ledger, operational gates once in the runbook,
implementation rules here and in the ownership/decision guides, and proposed work
in the roadmap. Link those sources rather than copying release packets or test
logs. Historical procedures and source witnesses remain immutable in Git and tests;
use the [history index](../refactoring/progress.md#historical-document-index).

Staff authentication/RBAC/shop authorization and backup automation remain deferred.
Existing controls are preserved; a completed storage migration is not an access-
control certification. Future live actions require their own explicit approval.
