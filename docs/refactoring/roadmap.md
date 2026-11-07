# Refactoring roadmap

This is the authoritative forward plan; [migration map](../architecture/migration-map.md) describes current source and [progress](progress.md) retains immutable execution evidence.

## Authorized completion sequence

The owner authorized four cohesive stacked PRs, each based on its exact parent head. Publication does not authorize merges, auto-merge or deployment.

| Milestone | Branch / review | Status |
| --- | --- | --- |
| Sales + Inventory | refactor/sales-inventory-application / [PR34](https://github.com/volkswg/stock-management/pull/34), base main | Published; 510 tests and lint/typecheck/isolated build pass |
| Orders + LINE | refactor/orders-line-workflows / [PR35](https://github.com/volkswg/stock-management/pull/35), base PR34 branch | Published; 520 tests and all gates pass |
| External infrastructure | refactor/external-infrastructure / [PR36](https://github.com/volkswg/stock-management/pull/36), base PR35 branch | Published; 526 tests and all gates pass |
| Final cleanup | refactor/final-architecture-cleanup, base exact PR36 head | Completed; 531 tests and all gates pass. Evidence in progress/verification; review link supplied at publication |

No remaining safe implementation milestone in this assignment should be inferred from earlier historical follow-up suggestions. Review and merge the dependency chain only after independent System Architect review and owner authorization. Do not rebase/force-push reviewed branches or push to main.

## Next bounded work

The remaining aggregate construction and legacy full-service contracts/forwards are intentionally supported. Retiring them requires an explicit compatibility decision and new consumer audit; changing lazy construction/connection checks would change observable behavior. No business implementation remains in services/backend compatibility paths. Workspace shell ownership was explicitly outside this task.

Supabase/PostgreSQL/storage migration, authentication/authorization, tenancy/subscriptions/billing, Purchase Order Master, transaction/concurrency/retry/queue/reconciliation policy and provider replacement remain separately scoped product decisions. Existing partial-write and concurrency behavior is preserved, not repaired by this refactor.

## Gates for future authorized changes

Capture original source/behavior first. Preserve financial/stock formulas, Bangkok dates/IDs, route/JSON contracts, schemas/modes, provider configuration and error/evaluation order. Use consumer-owned semantic ports; avoid generic repositories/DI containers or parallel persistence. Retain every historical fixture/negative guard and verify actual current runtime/type/browser graphs independently.

Run [verification](verification.md): tests, lint, typecheck, isolated credential-free build, route/manifests, source/compatibility inventory and final diff. No production data/live providers, operational scripts, merge or deploy during verification. Local fake-provider evidence is not independent CI or visual/live-integration verification.
