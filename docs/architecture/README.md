# Architecture guide

## Current system

Orders, Shipments, Inventory, Sales, Expenses, HR and LINE own their business
workflows. Shared infrastructure owns provider transports and PostgreSQL sessions;
composition wires feature-owned ports. `src/externals/` and `src/features/` are
retired. Current consumers use canonical module owners; standalone script
entrypoints remain explicit.

Production's last verified application release is PR97 `7aaa063`: row-only edit
protection is live; the schema is unchanged. PR96's unused service
forwards and inactive reference mappings are retired. Order images
upload individually on selection, and order creation sends verified media
references. PR94 removed the unused movement purchase reference. All23 business
tables use native `deletedAt`; operational cell/ordinal/kind/lexeme sidecars and
duplicate media URLs are gone. This records the verified release checkpoint,
not a new live inspection. See the [evidence ledger](../refactoring/progress.md#latest-production-release).

Business storage and private Loyverse account configuration use PostgreSQL.
Each feature owns explicit column maps and semantic port adapters; root transport
owns SQL, transactions and private ID/revision handles. Worksheet classes, the
Sheets configuration client, range/header repair, the business Sheets aggregate
and its runtime fallback are retired. Google auth remains for Google Drive uploads.
Existing API/report names and old-request recovery remain supported contracts.

This cleanup removes67 unused `src/services/` forwards and the unused movement
reference layout branch. Current UI copy describes sales and employees without
obsolete storage labels. Retained database rollback guards, LINE behavior,
request recovery and API fields are unchanged. PR98 prepares lean Loyverse sync plus a guarded single-payment receipt layout;
products remain separate. Production is unchanged, and the old-data rebuild
requires resolution of cardinality exceptions and separate release approval. See [ownership](migration-map.md), [verification](../refactoring/verification.md)
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
