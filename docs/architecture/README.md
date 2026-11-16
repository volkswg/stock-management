# Architecture guide

## Current system

Business workflows belong to the Orders, Shipments, Inventory, Sales, Expenses, HR and LINE modules. Production already uses Supabase and LINE is open; former business Sheets remain read-only. The prepared named-column release replaces authoritative business_cells arrays with named typed values and validated per-field representation evidence, retaining synchronized arrays during a reversible compatibility window. Final removal requires a separate manual approval and migration outside ordinary deployment discovery. See the [current release runbook](../database-migration.md#named-column-authority-release-prepared-production-execution-not-authorized). No production changes are executed by this preparation. Shared provider transports remain in `src/infrastructure/`; composition wires the existing feature interfaces.

The external compatibility directory `src/externals/` was retired in [PR #40](https://github.com/volkswg/stock-management/pull/40); the pure aggregate Sheets service contract is at `src/infrastructure/persistence/google-sheets/service-contracts.ts`. The seven `src/features/` forwards and unused `@/feature/*` alias are also retired; their canonical owners are unchanged. Reviewed `services/` and standalone script compatibility surfaces remain. This is a structural milestone, **not** a database replacement or production-security certification.

## Find the right document

| Question | Authoritative source |
| --- | --- |
| Who owns each module, worksheet or compatibility path? | [Current migration/ownership map](migration-map.md) |
| Where may dependencies point? How are boundaries enforced? | [Dependency rules](dependency-rules.md) |
| Where should new code live? | [Folder rules](folder-rules.md) |
| Which behavior and API invariants must remain unchanged? | [Architecture decisions](decisions.md) |
| What is complete and what is next? | [Roadmap](../refactoring/roadmap.md) |
| Why did previous changes happen? Which PR and fixture proves them? | [Historical progress and evidence](../refactoring/progress.md) |
| How do I test safely and what was actually verified? | [Verification procedure and results](../refactoring/verification.md) |
| How should I prepare a change? | [Engineering rules](../../AGENTS.md) |
| What follows the database migration for staff access? | [User authentication roadmap](user-authentication-roadmap.md), planning only |

## Database migration preparation

The [database migration runbook](../database-migration.md) describes the private PostgreSQL schemas, source audit, offline tools, synthetic verification and the comprehensive [Phase 3 execution checklist](../database-migration.md#phase-3-real-data-validation-and-controlled-cutover). Phase 2 adds opt-in isolated PostgreSQL persistence through the [operational persistence decision](decisions.md#phase-2-postgresql-operational-persistence); that section records historical preparation. Production has since cut over, as recorded in the current release runbook. Further hosted schema execution and deployment require separate approval.

Phase 3 preparation adds exact historical JSON-number handling, guarded/private
extraction and reconciliation, existing-application snapshot parity, deployment
planning and consistent backup/recovery tools. The [execution record](../database-migration.md#current-execution-record-and-reproducible-preparation)
distinguishes inspected metadata and synthetic acceptance from unexecuted real
export/hosted import. The production profile now adds an explicit new-target/release
binding and read-only default; it is unassigned/disabled and leaves the live Sheets
selection and staging restrictions unchanged. See the current runbook assessment.

## Documentation ownership

Keep **current state** in this guide, the ownership map and the roadmap; keep **historical results** in progress and verification. Link rather than copy the same PR history into multiple files. Preserve original test fixtures, historical evidence and stable operational-guide paths. Audit local links and source references before deleting or renaming documents. Do not create one Markdown note per PR.
