# Architecture guide

PR34–37 are merged. Issue [#39](https://github.com/volkswg/stock-management/issues/39) retires the external compatibility directory from verified main `5867348d86d57cc98322362fa175140626c7f5d7`; this branch awaits System Architect review. Codex has not merged or deployed it.

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

All scoped business use cases and worksheets now have feature owners. Google/Drive/LINE/Loyverse transport and the existing ID runtime have root infrastructure owners; pure protocol/message helpers live in shared. Explicit composition wires the unchanged aggregate Sheets registry and consumer readers outside feature cores. Active HTTP paths use canonical imports. Remaining services/backend compatibility callables retain named aliases and one physical implementation. `src/externals/` is removed; its consumers use canonical module, infrastructure or composition owners. Full-service Sheets declarations live in the pure root `service-contracts.ts` leaf. Workspace/Next shell and unrelated product work remain unchanged.

## Documentation maintenance

Update these canonical documents when ownership or behavior evidence changes. Do not create one Markdown file for each small PR. A standalone document requires lasting independent value (for example, an operational procedure), a clear owner and a link from this guide or the project README.

Keep one authoritative roadmap and one progress ledger. Record completed work and verification provenance once in progress; link immutable original PR/commit evidence instead of repeating old status paragraphs throughout architecture pages. Current-state statements describe the current source, not an earlier PR's temporary exception. Never overwrite historical test fixtures or source hashes to match a refactor.

At cleanup milestones, review links, obsolete plans, duplicate evidence and remaining debt. Before removing a document, audit tracked source/tests/fixtures, other docs and published PR references; preserve required evidence and provide an old-to-new index. Do not delete merely to reduce a file count. Keep operational guides at stable paths unless a separate need justifies moving them.
