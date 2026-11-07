# Refactoring roadmap

This is the single authoritative forward plan, based on [current ownership](../architecture/migration-map.md). Completed PRs belong in [progress](progress.md), not as competing numbered future PRs. A target is not authorization to implement all layers at once.

## Next bounded work

1. Review the cohesive HR financial milestone: pure related contracts, original payroll/deduction rules, advance/settlement applications, salary adapter, explicit reader ports and named HTTP composition. The original type cycle and both remaining HR browser paths are closed. No financial-scope blocker remains.
2. Next large milestone: HR employee/compensation/attendance business ownership, including the existing read implementations behind payroll ports. Add a public Sales payroll-dashboard query seam if needed, then remove the explicit legacy reader bridge only after consumer/identity audits. Preserve effective dates, header initialization, leave/shift/validation and query behavior.
3. Continue Sales query/sync/report application ownership and remaining Orders/Inventory business seams from actual consumers. Reduce aggregate registry composition only after explicit injected ports cover its callers. Preserve compatibility exports until a complete external/type/script audit permits retirement.
4. Keep runtime/type browser isolation and an empty full-source file-cycle baseline. The formerly inherited payroll cycle and four registered erased browser paths are historical negative witnesses, not allowances for new debt. Preserve original fixtures and prove restored forbidden paths still fail.
5. Migrate LINE command/reply/session journeys after Orders/Inventory public contracts exist. Move pure quantity rules to Inventory first; preserve signatures, both movement modes, replies, state/retry/partial-failure behavior and rich-menu opt-in operations. Workspace shell/true generic shared cleanup follows proven ownership.
6. Retire named legacy forwards/barrels/registry only after full consumer and identity audits (including scripts/types/external compatibility). Separate provider replacement, if authorized, from compatibility retirement.

No full Orders, Shipments, Sales, Inventory or HR milestone is declared complete by a contract, worksheet or single-use-case move.

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
