# Architecture guide

Verified base: merged PR33, main `9ab9f2095342c66f30acf9612d79ed92063b8597`. HR financial/workforce ownership is complete. This branch completes Sales reporting/sync and Inventory business ownership; Orders/LINE, external clients and final compatibility/composition cleanup follow as separately reviewable stacked PRs under the current assignment.

| Read for | Canonical document |
| --- | --- |
| Engineering workflow and behavior preservation | [AGENTS](../../AGENTS.md) |
| Folder responsibilities and feature owners | [Folder rules](folder-rules.md) |
| Allowed edges, public surfaces and scoped ESLint enforcement | [Dependency rules](dependency-rules.md) |
| Actual owners, compatibility paths and remaining legacy | [Migration map](migration-map.md) |
| Port decisions and exact workflow invariants | [Architecture decisions](decisions.md) |
| Next work and prerequisite/exit gates | [Roadmap](../refactoring/roadmap.md) |
| Merged PR ledger, original evidence and old-document index | [Progress](../refactoring/progress.md) |
| Safe commands, current results and limits | [Verification](../refactoring/verification.md) |

Orders and Shipment browser/server seams remain as recorded in the map. All existing worksheet implementations now have feature or shared transport owners. StockAdjustmentsSheet belongs to Inventory; PayrollRecordsSheet belongs to HR. Expenses owns ledger/category/shop headers and exposes the shared RecordsSheet constructor. Its generic read/write implementation lives in root Google infrastructure, preserving the original superclass identity for all three consumers. Expenses now owns listing, saves, soft deletion, shop/category reads and master operations through application ports, a Sheets adapter and named server composition. HR now owns pure employee/payroll/advance contracts, financial domain rules, payroll/advance/settlement applications, salary persistence and named payroll server composition. HR workforce applications and persistence are also owned. Payroll consumes the public Sales dashboard reader through its existing injected consumer port. Sales reports/sync and Inventory reconciliation/adjustments/movements now have applications and semantic persistence adapters. Legacy facades, aggregate Sheets composition and the remaining Orders/LINE workflows await their next audited milestones.

## Documentation maintenance

Update these canonical documents when ownership or behavior evidence changes. Do not create one Markdown file for each small PR. A standalone document requires lasting independent value (for example, an operational procedure), a clear owner and a link from this guide or the project README.

Keep one authoritative roadmap and one progress ledger. Record completed work and verification provenance once in progress; link immutable original PR/commit evidence instead of repeating old status paragraphs throughout architecture pages. Current-state statements describe the current source, not an earlier PR's temporary exception. Never overwrite historical test fixtures or source hashes to match a refactor.

At cleanup milestones, review links, obsolete plans, duplicate evidence and remaining debt. Before removing a document, audit tracked source/tests/fixtures, other docs and published PR references; preserve required evidence and provide an old-to-new index. Do not delete merely to reduce a file count. Keep operational guides at stable paths unless a separate need justifies moving them.
