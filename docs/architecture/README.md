# Architecture guide

## Current system

Orders, Shipments, Inventory, Sales, Expenses, HR and LINE own their business
workflows. Shared infrastructure owns provider transports and PostgreSQL sessions;
composition wires feature-owned ports. `src/externals/` and `src/features/` are
retired. Supported service/script compatibility remains explicit.

Production uses Supabase with stable IDs, named-column authority and 47 native
lifecycle timestamps. The operational cell/ordinal/kind/lexeme sidecars are gone.
PR81's database-only release consolidated validators and added timestamp CHECKs;
there are 52 operational functions and 46 operational triggers. Browser writes and
LINE reopened after reconciliation. The runtime app remains PR80 source `31af820`.
Old business Sheets are read-only; Drive and private integration-account ownership
are unchanged. See [production operations](../database-migration.md) and the
[latest release evidence](../refactoring/progress.md#latest-production-release).

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
workflows and optional Sheets-backend instructions are separate from current
production storage and do not authorize provider or production mutations.

## Documentation ownership

Maintain current ownership here and in the map, implementation rules in one guide,
operations in one runbook, next work in one roadmap, and historical results in one
evidence ledger. Verification contains commands/limits rather than per-release logs.
Use immutable links for archived detail. Keep user-guide paths and original source/
test fixtures stable; check links and consumers before consolidating documents.
