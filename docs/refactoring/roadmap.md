# Project roadmap

This page describes the **current plan**, not the full migration diary. See the [current ownership map](../architecture/migration-map.md), [merged PR ledger](progress.md#merged-implementation-ledger) and [verification evidence](verification.md).

## Current priorities approved on 2026-11-12

1. Complete Supabase migration acceptance, performance/capacity measurements,
   backup automation preparation, dedicated production database preparation and
   the final Sheets synchronization and controlled cutover plan. Preserve existing
   authentication, LINE signatures, API restrictions and database permissions.
   Inadequate existing production access control is a **NO-GO**, not permission to
   weaken it or add authentication features within this milestone.
2. User authentication is the next major milestone. The separate
   [architecture and implementation roadmap](../architecture/user-authentication-roadmap.md)
   covers login, sessions, roles, shop authorization, user administration and API
   access. It is planning only; no authentication implementation is authorized now.

Continue independently authorized migration work in the existing cohesive PR.
Final production cutover and paid infrastructure require explicit owner approval.
The standing separation between disposable local work and separately approved
hosted mutations/source synchronization remains in force.

## Completed: modular architecture and legacy external cleanup

- [PRs #1–37](progress.md#merged-implementation-ledger) completed the scoped modular migration and final composition. Feature business logic and worksheets have owners; Google/Drive/LINE/Loyverse transport moved to root infrastructure.
- [PR #40](https://github.com/volkswg/stock-management/pull/40) closed [issue #39](https://github.com/volkswg/stock-management/issues/39), physically removed all 65 files under `src/externals/` and migrated internal imports and full-service Google Sheets type declarations. No further external-directory refactor is planned.

The cleanup landed at `3c870ef122c640c6ed8958dadb83ae714094dfb5`; PR43 then landed at main `2d2dc18a5c1112e9f6368599ad0d6d67defa79af`, the base for the current features retirement. Codex reported **534 passing offline tests**, lint/typecheck and isolated build at PR #40; those are not independent CI, live-provider or browser acceptance evidence. Keep historical per-PR counts in [progress](progress.md), not here.

## Completed: private Loyverse account configuration (PR43)

Merged [PR43](https://github.com/volkswg/stock-management/pull/43) supports account credentials in a separate privately shared Google workbook behind a server-only reader, with explicit env/sheet selection and env as the default. All metadata/client consumers use that seam without changing business worksheets, IDs or calculations. JSON support remains for rollback; owner-run sharing, data copy, Vercel enablement and live verification are described in [README](../../README.md#loyverse-configuration). This work neither performs production migration/deployment nor implements issue #38.

## Completed: retire src/features (PR44)

Merged PR44 removed the seven obsolete backend forwards and unused singular path alias, migrated test/type consumers to existing owners and preserved every historical witness. Business implementations, production imports, schemas, environment settings and provider behavior remain unchanged. The audit found no known required external consumer. Remaining service/script compatibility is outside that cleanup scope.

## Current bounded change: one Loyverse workbook

Sheet mode uses the existing operational workbook only; remove the account-specific workbook setting and any workbook-selection fallback. Preserve env rollback, account validation/order, public metadata and credential confidentiality. The owner must restrict/audit workbook readers before storing tokens; hiding a tab does not isolate read access. No production workbook, sharing, Vercel setting or deployment changes are part of implementation.

## Next: production-readiness gate (open, not implemented)

[Issue #38](https://github.com/volkswg/stock-management/issues/38) covers access controls for all production domains and sensitive APIs, independent CI, critical-path smoke tests and safe staging/provider isolation. Documentation cleanup was prioritized first at the owner's request; that sequencing does **not** remove the potential access-control risk. Verify external exposure before treating this deployment as safe for unrestricted production access.

Do not merge security policy changes, launch write-capable smoke tests or touch real Google Sheets, LINE, Loyverse or payroll records as part of documentation maintenance. A separately reviewed implementation and operational verification are required.

## Supabase migration

Phase 1 merged as [PR48](https://github.com/volkswg/stock-management/pull/48),
commit `57882d2989d5d8d1156c7dc7bdeb5a694050e7ad`: private import schema, offline
tools and synthetic verification. Production persistence remains Google Sheets.

Phase 2 implements the private operational schema, exact archive promotion,
feature-owned PostgreSQL bindings to existing persistence ports, request-wide
transactions, durable response replay, safe pooling/access and isolated storage
selection. The owner approved stable Supabase request keys; Sheets remains the
production default. See [architecture](../architecture/decisions.md#phase-2-postgresql-operational-persistence)
and the [migration runbook](../database-migration.md).

Phase 3 now has one [execution checklist and automation plan](../database-migration.md#phase-3-real-data-validation-and-controlled-cutover),
including read-only source approval, secure artifacts, isolated deployment/import,
business acceptance, capacity, recovery, freeze/final full-load and cutover/rollback.
The immutable importer cannot merge changed/deleted rows; final delta review plans
a fresh approved target. Verification of existing production access controls,
monitoring, production target enablement and safe reverse reconciliation remain
release prerequisites. New user authentication belongs to the separate next
milestone; inadequate current controls are a NO-GO for activation.

The approved real-data execution has advanced beyond preparation: isolated
schema deployment, latest-source manual CSV import and record reconciliation
are complete. The manual import bypassed the archive/import-batch step; it is
not an archive-promotion result. Offline application comparisons passed, while
hosted runtime/business/security/performance acceptance remains separate.
See the [current progress ledger](progress.md#database-migration--current-operational-status-2026-11-11)
and [machine-readable status](../../tools/migration/phase3-status.json) for the
verified counts, evidence timestamp and limitations.

Post-audit encrypted backup recovery and two complete disposable local functional
campaigns have passed; their preserved evidence and remaining capacity/hosted
gates are in the [current migration assessment](../database-migration.md#current-migration-go-no-go-assessment-2026-11-12).
The earlier pause is historical and does not describe the currently authorized
local work. Existing populated staging and production remain protected; the
application still uses Google Sheets.

Finish local write/capacity acceptance first. Prepare the separate hosted
acceptance packet, disabled backup/restore automation configuration, dedicated
production target specification, final source synchronization and controlled
cutover/rollback gates. Hosted writes, production provisioning, new Sheets
business reads/exports, production configuration and final cutover retain their
separate approval boundaries. Future operators must verify their own scoped
credentials and network/TLS rather than assume access from an earlier session.

## Deferred product decisions — not refactoring leftovers

The aggregate Sheets construction/connection behavior and selected `services/`, backend and standalone-script compatibility remain intentionally supported. Workspace/Next shell ownership, PostgreSQL/Supabase migration, authorization/tenancy, subscriptions/billing, Purchase Order Master, provider replacement, and cross-provider transactions/queues/reconciliation need their own product decisions. Existing race, retry and partial-write behavior was preserved, not repaired.

## Gates for future changes

Preserve financial and stock formulas, Bangkok dates/IDs, routes/JSON contracts, schemas and provider error/operation ordering. Audit actual consumers and compatibility before removing surfaces; do not introduce a speculative repository or DI container. Use [verification](verification.md) for test, lint, typecheck, isolated build, historical fixtures, route manifests and runtime/type/browser graphs. Record fresh evidence for each change; do not infer a pass from an older PR or Vercel preview status.
