# Architecture guide

Base verified at merged PR30, main `5c72e122b54d296cedc3d0f16a1e466128d63aaf`. This branch migrates the Expenses business layer, adds its public browser contracts and cleans up the actual HR/Sales consumers. Worksheet ownership is already complete and is unchanged.

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

Orders and Shipment browser/server seams remain as recorded in the map. All existing worksheet implementations now have feature or shared transport owners. StockAdjustmentsSheet belongs to Inventory; PayrollRecordsSheet belongs to HR. Expenses owns ledger/category/shop headers and exposes the shared RecordsSheet constructor. Its generic read/write implementation lives in root Google infrastructure, preserving the original superclass identity for all three consumers. Expenses now owns listing, saves, soft deletion, shop/category reads and master operations through application ports, a Sheets adapter and named server composition. Legacy facades, aggregate Sheets composition and other feature workflows remain.

## Documentation maintenance

Update these canonical documents when ownership or behavior evidence changes. Do not create one Markdown file for each small PR. A standalone document requires lasting independent value (for example, an operational procedure), a clear owner and a link from this guide or the project README.

Keep one authoritative roadmap and one progress ledger. Record completed work and verification provenance once in progress; link immutable original PR/commit evidence instead of repeating old status paragraphs throughout architecture pages. Current-state statements describe the current source, not an earlier PR's temporary exception. Never overwrite historical test fixtures or source hashes to match a refactor.

At cleanup milestones, review links, obsolete plans, duplicate evidence and remaining debt. Before removing a document, audit tracked source/tests/fixtures, other docs and published PR references; preserve required evidence and provide an old-to-new index. Do not delete merely to reduce a file count. Keep operational guides at stable paths unless a separate need justifies moving them.
