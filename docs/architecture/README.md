# Architecture guide

Base ownership verified against merged main `48cf8d6d011544206cafa7ac35eeeafde5f22be9` (PR28); this branch moves only the LINE UserStateSheet and its mutable headers after the PR27/28 dependency prerequisites. This guide separates implemented slices from remaining work; it does not claim the repository fully conforms to the target architecture.

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

Orders contracts/UI/list/simple-create/detail seams and Shipment contracts/UI/core server seams are implemented. Shared Google transports and sixteen Orders/Shipment/Sales/HR/Inventory/LINE worksheet classes have physical owners. Legacy facades, aggregate Sheets composition, other feature workflows and worksheets remain. PR23 delivered the Inventory employee-directory prerequisite and PR25 moved the three HR core worksheet/header pairs. PR26 moved only StockCountsSheet, its headers and MovementSheet. PR27 detached movement schemas from session state and PR28 isolated the Inventory Sales query. User-state persistence now has a LINE-owned physical class/header; legacy forwards and business consumers remain. See the map and roadmap before choosing a slice.

## Documentation maintenance

Update these canonical documents when ownership or behavior evidence changes. Do not create one Markdown file for each small PR. A standalone document requires lasting independent value (for example, an operational procedure), a clear owner and a link from this guide or the project README.

Keep one authoritative roadmap and one progress ledger. Record completed work and verification provenance once in progress; link immutable original PR/commit evidence instead of repeating old status paragraphs throughout architecture pages. Current-state statements describe the current source, not an earlier PR's temporary exception. Never overwrite historical test fixtures or source hashes to match a refactor.

At cleanup milestones, review links, obsolete plans, duplicate evidence and remaining debt. Before removing a document, audit tracked source/tests/fixtures, other docs and published PR references; preserve required evidence and provide an old-to-new index. Do not delete merely to reduce a file count. Keep operational guides at stable paths unless a separate need justifies moving them.
