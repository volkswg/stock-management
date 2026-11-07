# Refactoring roadmap

This is the single authoritative forward plan, based on [current ownership](../architecture/migration-map.md). Completed PRs belong in [progress](progress.md), not as competing numbered future PRs. A target is not authorization to implement all layers at once.

## Authorized completion sequence

The owner has authorized a continuous multi-PR assignment. Each later branch starts at the exact previous head and targets that parent branch; publication does not authorize merge or deployment.

1. Sales + Inventory: business applications, semantic persistence ports/adapters and public Sales dashboard consumers are complete with 510 passing tests and successful lint/typecheck/isolated build; published as PR34 for review. HR applications are reused unchanged.
2. Orders + LINE workflows: implemented on refactor/orders-line-workflows, stacked on PR34. Orders mutations/images/attachments and LINE sessions/journeys/webhook orchestration use owned applications and semantic adapters, with public Inventory journey decisions. Verification/publication gates precede the external milestone.
3. External infrastructure: move LINE/Loyverse protocol clients/factories into root external infrastructure, preserving constructor/export identities, HTTP/pagination/error behavior and provider configuration.
4. Final cleanup: audit obsolete implementations/barrels/forwards and aggregate composition against every runtime/type/script/test/external consumer; retire only proven unnecessary surfaces, enforce final boundaries and consolidate canonical documentation.

All milestones preserve source routes, calculations and existing concurrency/partial-failure limits. Keep original fixtures and historical negatives intact. Continue independent safe work if a concrete dependency blocker requires a split; document the exact affected surface rather than claiming completion.

## Required behavior evidence by future slice

| Slice | Preserve and characterize before editing |
| --- | --- |
| Inventory | Shop/month stock equations, counts vs financial separation, delivery positivity, reversals/replacements/idempotency, quantity parsing and duplicate prevention |
| Sales | Refunds/discounts/payment amounts, landed/margin/profit override math, receipt pagination/IDs, Bangkok date bounds, original sync retries/partial failures |
| Expenses | Money precision, category/shop references, filtering/totals/errors, current shop-master ownership, no new financial side effects |
| HR | Employment/compensation effective dates, commission/attendance/leave, oldest-first capped deductions/carry-forward, unpaid exclusions, immutable settlements, retry/stale checks and original concurrency limitations |
| Orders/LINE | Existing image upload/write order, ID/time/partial failures, command/state transitions and original success/error responses |
| Provider/registry cleanup | Every constructor/export/header identity, source restoration, default/explicit ranges/modes, batch/error order, zero live calls |

## Gates for every implementation PR

Capture exact original sources/hashes and executable synthetic outcomes first. Define consumer-owned business ports only where needed, preserve deferred evaluation and sync/async failure timing, implement with current infrastructure, wire at composition. Keep routes, public contracts, schemas/env/IDs/provider modes unchanged. No generic repository/DI container/cache/domain scaffolding or parallel persistence.

Run the [verification procedure](verification.md): baseline/final tests/lint/typecheck, isolated credential-free builds, route/manifests, runtime and type ownership/cycles, browser reachability, exact historical witnesses and final diff. Keep existing fixtures authoritative, exceptions named and reversible; never regenerate expectations or expand closed loaders broadly. Reviewable PRs only; no main writes, merge/deploy or live operational checks under this plan. Structural rollback should be a code revert, not a data/schema rollback.

## Separately deferred product decisions

Supabase/PostgreSQL adapters and schema/data migration, authentication/authorization, tenant/workspace ownership, billing/subscriptions, Purchase Order Master, concurrency/transactions, retry/queue frameworks and provider replacement require separate requirements. No fake tenancy, changed IDs, dual writes or new persistence during architecture moves. See [known risks](../architecture/decisions.md#deferred-behavior-and-security-work).
