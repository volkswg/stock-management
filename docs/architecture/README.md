# Architecture guide

## Current system

Orders, Shipments, Inventory, Sales, Expenses, HR and LINE own their business
workflows. Shared infrastructure owns provider transports and PostgreSQL sessions;
composition wires feature-owned ports. `src/externals/` and `src/features/` are
retired. Supported service/script compatibility remains explicit.

Production's last verified application release is PR87/88 `296529d`: all 23 business tables use
native `deletedAt`, with 67 lifecycle timestamps including media, 61 operational
functions and 52 triggers. LINE remained open during that application-only release.
Operational cell/ordinal/kind/lexeme sidecars and duplicate media URLs are gone.
Old business Sheets remain read-only; Drive and private integration accounts keep
their existing ownership. This records the last checkpoint, not a fresh live read.

Business storage uses PostgreSQL-only named-record adapters. This branch retires
the remaining Sheets configuration reader in favor of private PostgreSQL accounts.
Each feature owns its explicit column maps and semantic port adapters;
root transport owns SQL, transactions and private ID/revision handles. Worksheet
classes, range/header repair, the aggregate Sheets business service and its runtime
fallback are retired. Google Drive uploads and the fixed read-only account
configuration remain. Existing public report type names are retained API contracts.
This source work does not deploy, alter the schema or authorize a live change.
See [verification](../refactoring/verification.md), [operations](../database-migration.md)
and the [evidence ledger](../refactoring/progress.md#latest-production-release).

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
