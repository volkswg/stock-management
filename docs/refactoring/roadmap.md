# Refactoring roadmap

This is the authoritative forward plan; [migration map](../architecture/migration-map.md) describes current source and [progress](progress.md) retains immutable execution evidence.

## Completed architecture milestones

PR34–37 (Sales/Inventory, Orders/LINE, external infrastructure and final composition) are merged. Their original evidence remains in [progress](progress.md) and [verification](verification.md).

## Current bounded work: issue #39

Retire all 65 `src/externals/` files in one PR against main. Migrate remaining full-service types to a pure root contract leaf and all active consumers/tests to canonical owners. Preserve every inherited fixture, behavior comparison and negative guard. Exact historical overlays remain test-only; actual current imports/graphs cannot resolve the removed namespace. Publication awaits independent System Architect review; no merge/deploy is authorized.

The aggregate construction/connection behavior and services/backend/standalone-script compatibility remain intentionally supported. No additional retirement is implied: each surface needs its own consumer/identity audit. Workspace shell ownership remains outside scope.

Supabase/PostgreSQL/storage migration, authentication/authorization, tenancy/subscriptions/billing, Purchase Order Master, transaction/concurrency/retry/queue/reconciliation policy and provider replacement remain separately scoped product decisions. Existing partial-write and concurrency behavior is preserved, not repaired by this refactor.

## Gates for future authorized changes

Capture original source/behavior first. Preserve financial/stock formulas, Bangkok dates/IDs, route/JSON contracts, schemas/modes, provider configuration and error/evaluation order. Use consumer-owned semantic ports; avoid generic repositories/DI containers or parallel persistence. Retain every historical fixture/negative guard and verify actual current runtime/type/browser graphs independently.

Run [verification](verification.md): tests, lint, typecheck, isolated credential-free build, route/manifests, source/compatibility inventory and final diff. No production data/live providers, operational scripts, merge or deploy during verification. Local fake-provider evidence is not independent CI or visual/live-integration verification.
