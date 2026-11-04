# Incremental PR plan

This document tracks incremental PRs. PR 1 established preparation; PR 2 implemented [browser-safe Orders contracts](orders-contracts.md); PR 3 implements the [Orders UI migration](orders-ui-migration.md). PRs 4–11 remain proposed work. Keep every existing route file and URL stable. Never combine directory moves with financial fixes, schema/env changes, provider replacement, or SaaS feature work.

| PR | Scope and sequence | Required evidence / exit condition |
| --- | --- | --- |
| 1 — Preparation | Engineering rules, dependency audit, destination map, offline regression baseline, boundary recommendation | No `src` changes; lint/typecheck/build/test; route manifest unchanged |
| 2 — Browser-safe order contracts | Characterize order list/detail status, quantity and API error shapes; extract only used DTOs/enums out of mixed service barrels | Client dependency graph reaches no server services; runtime enum values and JSON shapes unchanged; lint boundaries enabled for the migrated slice |
| 3 — Orders UI (implemented) | 15 UI/client/style files moved under `modules/orders/ui`; four route wrappers and three external gallery consumers updated; no duplicate implementations | Original contract tests plus pre/post-move callback/request tests, body/CSS fingerprints, runtime/type cycle checks and unchanged route manifests. No browser visual verification was available; limitation explicitly recorded |
| 4 — Orders use-case seam | Pick one read then one write; characterize IDs, row mapping, image failures/retries; define narrow ports; extract Sheets adapter; preserve legacy facade for untouched callers | Fake-adapter and adapter contract tests; no production calls; HTTP statuses/payloads stable; remove compatibility facade only after consumers move |
| 5 — Shipments | Extract contracts, UI, use cases, adapters in separate commits/PRs if large; consume orders public query; inject shipment projection into order detail through its consumer-owned port at app composition | Linking/status/fee and missing-order tests; existing URLs and shipment/order invariants preserved; no orders ↔ shipments module cycle |
| 6 — Inventory core | Move count/adjustment/movement contracts and UI separately; extract core use cases and adapters after characterization | Stock equations, shop/month filtering, reversals/replacements, duplicate prevention and delivery quantity tests; no header/range/mode changes |
| 7 — Sales | Separate protocol client from sync and reports; extract adapters and query contracts used by HR/inventory | Refunds/discounts/cost/margin, Bangkok day boundaries, receipt pagination, sync retries and existing identifiers; synthetic provider responses |
| 8 — Expenses | Extract ledger/shop/category contracts, UI and repositories; retain current shop-master ownership | Money rounding, category/shop references, totals/filtering/error shapes; no financial side effects added |
| 9 — HR | First expand payroll/attendance/advance characterization, then contracts/UI, then pure rules/ports/adapters in small PRs | Compensation effective dates, employment boundaries, commission buckets, attendance/leave, oldest-first advance allocation/carry-forward, immutable settlement and retry/stale checks; preserve known Sheets concurrency limitations |
| 10 — LINE workflows | After order/inventory contracts exist, move command routing, reply builders and sessions; move rich-menu content separately from operational entrypoint | Both movement modes, order journeys, image retry/partial failure, ordering and signature handling; no messages sent or menu setup executed; preserve existing failure responses until a separate fix |
| 11 — Shared infrastructure and shell cleanup | Deduplicate proven transport/auth plumbing, retire legacy registry/barrels after all consumers migrate; move home/breadcrumb to workspace | No legacy consumers remain before deletion; no cycles; shared has no feature dependencies; all tests and routes pass |

PRs 5–10 can be split into contract/UI/port/adapter PRs to stay reviewable. Follow actual dependency order: extracting a small sales/shop read contract may precede migrating inventory or HR; do not migrate an entire provider feature just to satisfy one consumer. Each PR description identifies the exact files from the map and any remaining legacy exceptions.

For each PR:

1. Capture behavior with synthetic fixtures before moving it. Record current errors as baseline; a characterization test must not silently bless a known defect as desired behavior.
2. Separate pure models from IO only where a real consumer needs that seam. Define narrow consumer-owned ports, implement the existing Sheets/Drive/provider behavior, and wire at app server entrypoints.
3. Move one slice, update imports, keep public DTO values and routes stable. Temporary compatibility exports must be narrow, server/client separated, documented, and assigned removal criteria.
4. Run the offline checks in [verification](verification.md), compare routes and response fixtures, inspect the transitive client graph, and check cycles including type-only edges. Update the audit/map/registry and ratchet boundary rules for that slice.
5. Review and merge through normal project review. Roll back a structural PR by reverting code only; it must not require undoing writes, schema changes, env changes, or data conversion.

## Deferred design decisions

Supabase adapter design, schema/data migration, transactional semantics, tenant ownership/IDs, authorization, workspace membership, billing and subscriptions each need separate requirements and threat/data migration review. The current shop master is not a tenant model. Do not add tenant columns, change IDs, dual-write stores, introduce fake tenancy, or promise transactional behavior while Sheets remains the backend. Port extraction is preparation for these decisions, not implementation of them.
