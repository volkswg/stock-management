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
The historical runner uses `--test-isolation=none` with its matching source.
Current native files run separately; do not replace `npm test` with a current-source
glob. Bill/item identity mocks have suite-scoped hooks, including for deliberately
grouped diagnostics. Closed source loaders execute
actual owners with fake ports/auth/fetch; TypeScript transpilation is not type
checking or a security sandbox. Preserve exact allowlists, source witnesses and
historical fixtures rather than regenerating expectations to make a change pass.

### Codex Cloud

Use Node24, Python3.9+ and the existing locked dependencies:

```sh
npm run cloud:doctor
npm run cloud:test
npm run lint
npm run typecheck
bash tools/migration/verify-build.sh
```

The doctor tests both Node and Python child-process execution with a credential-free
environment. `EPERM`/`EACCES` is a blocked environment, not a failed SQL assertion or
a passing check. Change execution permissions only through supported environment
controls; do not disable security or edit tests to hide the denial. Configure and
publish the reusable environment, then start a new task when necessary; existing
Cloud tasks retain their own setup. See the [official environment guide](https://learn.chatgpt.com/docs/environments/cloud-environments).

When local Cloud execution is blocked, publish the source and use the existing
**Migration acceptance** workflow. Its manual entrypoint takes a full40-character
`source_sha` and checks out exactly that commit. The workflow contains no production
credentials and never deploys. PR checks still run automatically. An authenticated Cloud GitHub CLI can run:

```sh
gh workflow run migration-acceptance.yml --ref main -f source_sha=FULL_COMMIT_SHA
```

Read the resulting run's source SHA, conclusion and artifacts. Cancelled, stalled or
permission-blocked runs remain incomplete. Use the [application release procedure](../database-migration.md#cloud-application-only-release)
only after successful source/tree CI and separate owner release approval.

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
# Fresh minimal synthetic PostgreSQL/PgBouncer; no hosted access.
bash tools/native-postgres/verify-pooling.sh

# Fresh disposable synthetic PostgreSQL only; Docker and existing browser tools.
bash tools/native-postgres/verify-postgres.sh

# Explicit older-schema evidence with the hash-pinned PR79 record adapter.
bash tools/migration/verify-persistence-history.sh
```


Pooling acceptance reproduces 53300 using six idle direct sessions, then exercises
24 client sockets/12 actual-transport copies behind a four-backend pool. It checks
affinity, role reset, read-only enforcement, permissions, rollback/replay/conflict
and lost-COMMIT recovery, with synthetic request context for the Vercel hook.
Local PostgreSQL/PgBouncer does not certify hosted Supavisor/Vercel behavior.

`npm test` reconstructs immutable pre-native source/type witnesses in an owned
credential-free copy, then runs current physical-source checks separately. Old
`tests/*.types.ts` signatures compile against their predecessor; current types
compile with current source. Do not substitute a glob, mock out SQL behavior or
use an old overlay as evidence of current execution.

The three historical Python copiers and CJS history loader validate exact current
and restored hashes before earlier fixture chains. A docs cleanup can also affect
those pins: add a bounded test-only inverse for the reviewed files, never rewrite
existing fixtures, skip assertions or silently accept arbitrary documentation drift.
Keep source witnesses compact; original human-readable history stays linked in Git.

Native acceptance independently proves historical schemas, then runs actual current
owners on fresh synthetic final-schema databases. It revokes runtime execution of
old typed row mappings, checks named projections, media, row edits, both LINE image
flows, image retry/reload, Products and receipt JSONB with the operational payment
table absent. Historical rebuild/inverse witnesses run only with matching source.
Recovery checks retain archives, private configuration/permissions, Products and
four sequence states. Known test-only canonicalizations of dropped column slots
and exact equivalent media CHECK parentheses remain narrowly scoped in source;
other definitions/validation flags stay exact. This does not change production
fingerprint formats or authorize a DROP/restore.

`bash tools/native-postgres/verify-accounts.sh` separately checks synthetic private
account configuration, metadata/token separation, runtime/reader denials, constraints,
wrong-target/populated-target refusal, redaction and dump/restore permissions.
No real tokens, records, providers or hosted resource are involved.

The [acceptance workflow](../../.github/workflows/migration-acceptance.yml) runs
regression/lint/types, historical/current PostgreSQL, pooling, accounts, recovery
and the credential-free production build. Parent-owned historical scripts may be
sourced phases, not standalone production commands. Reuse passing evidence where
the delta permits; a failure warrants investigating/rechecking the affected chain.
Detailed older campaign counts are in the [archived verification guide](https://github.com/volkswg/stock-management/blob/950d31e9ce3e89dd6b76d98762112e4a0787829c/docs/refactoring/verification.md).

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

- Audit packages/env/schema/assets and browser bundles for unintended changes or
  private database strings. Follow the [architecture rules](../architecture/rules.md).

## Documentation-only changes

Verify the diff contains only intended documentation and archived-log changes.
Record commands, source SHA, results and immutable evidence links in the ledger;
keep raw test output in CI artifacts or pinned history rather than growing docs.
Audit every local link,
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


## Product catalogue UAT

Current catalogue/domain/browser/boundary tests are part of `npm test`. The native
PostgreSQL campaign runs `tools/product-uat/postgres.test.cjs` against actual
Orders/Products/HTTP owners on a fresh synthetic clone. The existing
`tools/product-uat/browser.cjs` exercises create/link, duplicate review, lost response,
reload and exact-key replay against a localhost-only app. Use the
[UAT procedure](../database-migration.md#product-master-uat) for target and privacy
limits; Product Master is already released, not an unactivated production feature.
