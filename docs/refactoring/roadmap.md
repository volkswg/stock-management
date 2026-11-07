# Refactoring roadmap

This is the single authoritative forward plan, based on [current ownership](../architecture/migration-map.md). Completed PRs belong in [progress](progress.md), not as competing numbered future PRs. A target is not authorization to implement all layers at once.

## Next bounded work

1. PR25/26 completed HR/Inventory worksheet slices and PR27 removed the direct movement schema/session coupling. This branch implements only the confirmed Inventory→Sales→mixed Sheets registry prerequisite: direct query/header/type imports and one verbatim DTO contract transfer. Defer the two-file LINE user-state worksheet move to PR29, after this prerequisite merges, a fresh main is verified and complete runtime/type/browser/consumer audits pass. No wider query extraction or registry retirement is bundled.
2. Continue other worksheet ownership only after their real consumers permit it: Inventory StockAdjustmentsSheet, Expenses/shop/records, payroll records and LINE user-state require separate scope/graph decisions. Keep aggregate service/factory/indexes until all consumers migrate. No blind whole-directory move.
3. Expand one business seam at a time. Orders draft/image/mutations and legacy facade cleanup; Inventory counts/adjustment/movement core; Sales sync/report queries; Expenses ledger/shop/category contracts; HR payroll/attendance/advance rules. Choose prerequisites from actual callers instead of migrating a whole feature to serve one query.
4. Resolve remaining legacy erased client-to-server paths through real public DTOs, not type-import exceptions. Four roots remain (salary advances, payroll, expense master, expenses); preserve current runtime isolation and do not import newly moved providers into clients.
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
