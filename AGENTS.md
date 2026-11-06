# Engineering rules

Read [the architecture guide](docs/architecture/README.md), [folder ownership](docs/architecture/folder-rules.md), and [dependency rules](docs/architecture/dependency-rules.md) before structural work. The [migration map](docs/architecture/migration-map.md) records actual ownership and remaining legacy; the [roadmap](docs/refactoring/roadmap.md) describes proposed work, not authorization to perform it all at once.

## Preserve observable behavior

- Keep existing page URLs, API paths/methods, status codes, request/response fields, query parameters, metadata, and user flows stable during structural refactors.
- Do not change business calculations, rounding, Bangkok date handling, identifiers, ordering, retry/idempotency behavior, or LINE command/state transitions as part of a move.
- Preserve Google Sheets worksheet names, headers, column ordering, ranges, RAW/USER_ENTERED modes, existing records, and all environment variable names. Preserve LINE, Loyverse, and Drive integration behavior.
- Separate behavior fixes from moves. Record discovered defects and baseline failures; do not silently repair them in an architecture PR.
- Do not add Supabase, authentication, billing, subscriptions, tenant filters, or data migrations under the guise of restructuring. Those require a separately scoped implementation task. Future persistence must preserve existing contracts until explicitly changed.

## Ownership and dependencies

- `src/app` owns Next.js route entrypoints, layouts, metadata, route validation/HTTP translation, and composition. Feature UI and business use cases belong in modules as they are incrementally migrated.
- Modules: `orders`, `shipments`, `inventory`, `sales`, `expenses`, `hr`, `line-workflows`, `workspace`. Create a directory only when real code needs it; do not scaffold empty module layers.
- `domain` contains framework-independent models and pure rules; no React, Next.js, configuration, IO, or infrastructure imports.
- `application` orchestrates use cases through explicit, narrowly scoped interfaces defined beside their consumer. Do not expose worksheet rows, ranges, API tokens, or concrete SDK clients in those interfaces.
- `ui` contains components, hooks, feature styles, and browser HTTP clients. Never import server code, configuration readers, Node-only modules, or credentials into its dependency graph. `import type` does not make an infrastructure-owned contract the right long-term owner.
- Infrastructure implements ports. Shared transport/auth plumbing belongs in root `infrastructure`; feature row mapping and repository adapters belong in that module's `infrastructure`. Wire implementations at server entrypoints, not inside domain/application.
- `shared` cannot import modules, app, config, infrastructure, or legacy business code. Promote utilities only when they are truly generic; avoid dumping-ground helpers.
- Cross-module imports use documented public contracts with named consumers. Use separate browser-safe contracts and server entrypoints; never a broad barrel mixing both. Do not introduce circular dependencies, including type-only cycles.
- Legacy paths remain in place until a scoped migration. Do not extend existing boundary violations. If a small bug fix must touch legacy code, keep it local; do not force an unrelated rewrite.

## Safe workflow

- Work on a dedicated branch; never push directly to `main`. Open reviewable PRs and do not merge or deploy unless the task explicitly authorizes it.
- Do not read production credentials, call live integrations, run rich-menu setup, or access/mutate production data for verification. Use synthetic fixtures and fake adapters. Run builds with integration credentials excluded; see [verification](docs/refactoring/verification.md).
- Before each move, add meaningful characterization tests for the affected behavior. Move one feature/layer at a time, update consumers, retain route entrypoints, and remove temporary compatibility exports only after all consumers migrate.
- Run `npm test`, `npm run lint`, `npm run typecheck`, and an isolated `npm run build`; report baseline and new failures separately. The route fixture must not be regenerated just to make an unintended URL/method change pass.
- Check the diff for accidental route/schema/env/dependency changes and client-to-server imports. Explain unverified UI or integration flows; passing static tests is not end-to-end verification.
- Prefer existing tooling; add no dependency without a concrete need. Existing `yarn.lock` is the dependency lockfile. Do not introduce a second lockfile.
- Keep docs, ownership mapping, contract registry, and applicable boundary checks current as code migrates. No generic repositories, dependency-injection container, speculative tenant model, or parallel persistence implementation without a real use case.


## Documentation maintenance

- Use the canonical architecture guide, one [roadmap](docs/refactoring/roadmap.md) and one [progress/evidence ledger](docs/refactoring/progress.md). Update existing sections instead of adding a Markdown file for every small PR.
- Create standalone documentation only for a subject with lasting independent value and link it from the guide. Keep operational/user guides stable.
- Distinguish actual current ownership from historical intermediate states and proposed work. Preserve original evidence through immutable PR/commit links and unchanged test fixtures, without repeating history across documents.
- At cleanup milestones, audit repository/PR references, links, obsolete plans and duplicate content before removal. Keep precise safeguards, outstanding debt and prerequisites; provide an old-to-new evidence index and report historical URL tradeoffs.
