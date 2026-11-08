# Project roadmap

This page describes the **current plan**, not the full migration diary. See the [current ownership map](../architecture/migration-map.md), [merged PR ledger](progress.md#merged-implementation-ledger) and [verification evidence](verification.md).

## Completed: modular architecture and legacy external cleanup

- [PRs #1–37](progress.md#merged-implementation-ledger) completed the scoped modular migration and final composition. Feature business logic and worksheets have owners; Google/Drive/LINE/Loyverse transport moved to root infrastructure.
- [PR #40](https://github.com/volkswg/stock-management/pull/40) closed [issue #39](https://github.com/volkswg/stock-management/issues/39), physically removed all 65 files under `src/externals/` and migrated internal imports and full-service Google Sheets type declarations. No further external-directory refactor is planned.

The cleanup landed at `3c870ef122c640c6ed8958dadb83ae714094dfb5`; the current account-source change starts from main `36b5cc10828c7b9c57b2201e606762ad92ec0c05` after the documentation/template updates. Codex reported **534 passing offline tests**, lint/typecheck and isolated build at PR #40; those are not independent CI, live-provider or browser acceptance evidence. Keep historical per-PR counts in [progress](progress.md), not here.

## Current bounded feature: private Loyverse account configuration

Move account credentials to a separate privately shared Google workbook behind a server-only reader, with explicit env/sheet selection and env as the default. Migrate every metadata/client consumer without changing business worksheets, IDs or calculations. Keep JSON support for rollback; owner-run sharing, data copy, Vercel enablement and live verification are described in [README](../../README.md#loyverse-configuration). This work neither performs production migration/deployment nor implements issue #38.

## Next: production-readiness gate (open, not implemented)

[Issue #38](https://github.com/volkswg/stock-management/issues/38) covers access controls for all production domains and sensitive APIs, independent CI, critical-path smoke tests and safe staging/provider isolation. Documentation cleanup was prioritized first at the owner's request; that sequencing does **not** remove the potential access-control risk. Verify external exposure before treating this deployment as safe for unrestricted production access.

Do not merge security policy changes, launch write-capable smoke tests or touch real Google Sheets, LINE, Loyverse or payroll records as part of documentation maintenance. A separately reviewed implementation and operational verification are required.

## Deferred product decisions — not refactoring leftovers

The aggregate Sheets construction/connection behavior and selected `services/`, backend and standalone-script compatibility remain intentionally supported. Workspace/Next shell ownership, PostgreSQL/Supabase migration, authorization/tenancy, subscriptions/billing, Purchase Order Master, provider replacement, and cross-provider transactions/queues/reconciliation need their own product decisions. Existing race, retry and partial-write behavior was preserved, not repaired.

## Gates for future changes

Preserve financial and stock formulas, Bangkok dates/IDs, routes/JSON contracts, schemas and provider error/operation ordering. Audit actual consumers and compatibility before removing surfaces; do not introduce a speculative repository or DI container. Use [verification](verification.md) for test, lint, typecheck, isolated build, historical fixtures, route manifests and runtime/type/browser graphs. Record fresh evidence for each change; do not infer a pass from an older PR or Vercel preview status.
