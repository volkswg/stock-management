# Architecture guide

## Current system

Orders, Shipments, Inventory, Sales, Expenses, HR and LINE own their business
workflows. Shared infrastructure owns provider transports and PostgreSQL sessions;
composition wires feature-owned ports. `src/externals/` and `src/features/` are
retired. Current consumers use canonical module owners; standalone script
entrypoints remain explicit.

Production's last verified application release is [PR101](https://github.com/volkswg/stock-management/pull/101),
merge `e3d5dfc`: native Sales names, canonical expense/movement API fields and the
unused browser order-helper retirement. Its CI and 11 private live read comparisons
passed; users and LINE may operate normally. PR99 already retired the operational
payment table; its migration archive remains protected. See the
[evidence ledger](../refactoring/progress.md#latest-production-release).

Business storage and private Loyverse account configuration use PostgreSQL.
Each feature owns explicit column maps and semantic port adapters; root transport
owns SQL, transactions and private ID/revision handles. Worksheet classes, the
Sheets configuration client, range/header repair, the business Sheets aggregate
and its runtime fallback are retired. Google auth remains for Google Drive uploads.
Existing API/report names and old-request recovery remain supported contracts.

The service forwards, old feature directories and business Sheets adapters are
retired. Current cleanup removes only unused LINE server wrappers and the old
synchronous Loyverse factory, and corrects obsolete internal wording. The public
LINE server retains payload parsing and the transactional webhook dispatcher;
active session/resumption functions stay in their application owners. Browser
recovery, database rollback support and provider behavior remain unchanged.
No production action is authorized by this source cleanup. See
[ownership](migration-map.md), [verification](../refactoring/verification.md)
and [operations](../database-migration.md).

New staff authentication/RBAC/shop permissions and backup automation remain deferred.
Existing access controls are preserved; migration completion is not an access-
control certification. Future live changes require their own approval.

## Find the right document

| Question | Authoritative source |
| --- | --- |
| Where do files belong and which dependencies are allowed? | [Architecture rules](rules.md) |
| Who owns current modules, worksheets and compatibility paths? | [Ownership map](migration-map.md) |
| Which observable contracts must remain stable? | [Architecture decisions](decisions.md) |
| How is production stored, recovered and maintained? | [Supabase operations](../database-migration.md) |
| What is the next authorized scope? | [Roadmap](../refactoring/roadmap.md) |
| Which PR/CI/release proves a result? Where is older evidence? | [Evidence ledger](../refactoring/progress.md) |
| How are local/CI checks run safely? | [Verification guide](../refactoring/verification.md) |
| How should work be prepared and reviewed? | [Engineering rules](../../AGENTS.md) |
| What is planned for staff access? | [Authentication roadmap](user-authentication-roadmap.md) |

## Feature guides

[Expenses](../expenses.md), [movements](../movement-migration.md),
[stock adjustments](../shop-stock-adjustments.md) and
[LINE menu links](../rich-menu-links.md) keep their established paths. Their feature
workflows and historical Sheets-backend instructions are separate from current
production storage and do not authorize provider or production mutations.

## Documentation ownership

Maintain current ownership here and in the map, implementation rules in one guide,
operations in one runbook, next work in one roadmap, and historical results in one
evidence ledger. Verification contains commands/limits rather than per-release logs.
Use immutable links for archived detail. Keep user-guide paths and original source/
test fixtures stable; check links and consumers before consolidating documents.
