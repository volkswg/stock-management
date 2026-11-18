# Verification guide

This guide contains reproducible checks and their limits. Dated results and CI/
release evidence belong in the [single evidence ledger](progress.md), not repeated
here. A successful preview is not proof of tests, provider availability or access
control. Use existing Node 24 dependencies and `yarn.lock`; do not add a lockfile.

## Offline checks

```sh
npm test
npm run lint
npm run typecheck
python3 -m unittest discover -s tools/migration -p 'test_*.py' -v
```

Run the relevant characterization before a behavior-sensitive move, then final
checks. Report introduced versus inherited failures and actual counts/skips.
Built-in `node:test` uses `--test-isolation=none`. Closed source loaders execute
actual owners with fake ports/auth/fetch; TypeScript transpilation is not type
checking or a security sandbox. Preserve exact allowlists, source witnesses and
historical fixtures rather than regenerating expectations to make a change pass.

## Credential-free build

Next can load `.env` files even with a cleared process environment. Prepare an
owned empty directory containing the exact reviewed source, public assets and build
configuration, existing dependencies, and only tracked `.env.example`. Inspect
filenames without printing or copying private application env files. Exclude
`.next`, caches, `.vercel`, private Git configuration and operational artifacts.

Use [`verify-build.sh`](../../tools/migration/verify-build.sh) with a real dependency
directory. On this Mac the checkout's `node_modules` is a shared symlink; its
resolved directory must be copied into the owned isolated root. Preserve the shared
install. Then, in that isolated root:

```sh
env -i PATH="$PATH" CI=1 NEXT_TELEMETRY_DISABLED=1 npm run build
```

For uncommitted work, copy the reviewed working files and verify their bytes;
building an archive of old HEAD does not verify those edits. Clearing credentials
is not network isolation. If prerendering gains IO, use explicit fake dependencies.
Do not run rich-menu setup, production startup, imports or real providers as checks.

## Actual PostgreSQL and historical schemas

```sh
# Fresh disposable synthetic PostgreSQL only; Docker and existing browser tools.
bash tools/migration/verify-typed-postgres.sh

# Explicit older-schema evidence with the hash-pinned PR79 record adapter.
bash tools/migration/verify-persistence-history.sh
```

The current typed verifier tests the released final schema, then the PR81 CHECK/
shared-guard artifact on independent synthetic copies. Its constraints phase is
[`verify-constraint-validation.sh`](../../tools/migration/verify-constraint-validation.sh),
**sourced by the parent**, not a standalone production command. It checks exact
51-table/15-metadata preservation, guarded refusals/atomic rollback, 23-table write
parity, all 47 timestamp fields, permissions, real application/LINE owners, native
times and browser lost-response/reload/replay. Providers are forbidden.

Historical verifiers intentionally use the matching older adapter in a disposable
credential-free tracked-source copy. `--hosted-tooling` selects the inherited
synthetic hosted-tooling campaign through that same wrapper; it is not hosted
production acceptance. Keep the pinned adapter hash, original SQL and every old
assertion. Do not introduce a production fallback to satisfy historical tests.

The GitHub [acceptance workflow](../../.github/workflows/migration-acceptance.yml)
also covers archive/recovery fingerprints, restricted backup and bundle boundaries.
Reuse passing evidence when runtime/schema code is unchanged; broaden tests when
the actual delta or a failure warrants it. Tests never authorize hosted execution.

## Compatibility and boundaries

- Use actual application, adapter and HTTP owners with fake external capabilities.
  Characterize defaults, synchronous errors, pending IO, partial failures, provider
  ordering, response loss and retries; do not mock away the behavior under test.
- Preserve money/quantity precision, nullable/empty values, Bangkok calendar rules,
  opaque IDs, stable ordering, public scalar types and LINE state/selection rules.
- Check actual flat-config lint and TypeScript-resolved runtime/type-inclusive
  graphs, browser reachability, cycles and named cross-feature public contracts.
  Keep archived inverse fixtures separate from current physical-source checks.
- Retain [`route-contracts.json`](../../tests/fixtures/route-contracts.json).
  Compare actual API/page paths and methods, response contracts and the build
  manifest; never regenerate fixtures merely to approve an accidental route change.
  Current app-paths SHA-256 is
  `32f92c7a1ef17213d7a8642ca89e3e71218984982bf1bdce66b560ef35893e1e`.
- Audit packages/env/schema/assets and browser bundles for unintended changes or
  private database strings. Follow the [architecture rules](../architecture/rules.md).

## Documentation-only changes

Verify the diff contains only intended Markdown changes. Audit every local link,
fragment, renamed path and inbound repository reference, including `AGENTS.md` and
README. Preserve original rules/invariants and map removed history to immutable
commit URLs in [progress](progress.md#historical-document-index). Historical fixture
strings and published PR bodies retain their original text; do not rewrite them.
Record the old/new file/line totals and historical URL tradeoffs. Do not create
synthetic database tests that simply mirror documentation edits.

## Limits of evidence

Offline/fake-provider results do not establish real LINE delivery, Google OAuth,
Drive uploads, Loyverse outcomes, UI visual equivalence, production concurrency,
staff authorization or recovery RTO/RPO. Distinguish local, CI, private-checkpoint
and hosted evidence in the ledger. Production read checks are not a real business
write canary. Follow the separately approved
[maintenance and recovery procedure](../database-migration.md) for live work.
