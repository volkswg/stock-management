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
**Migration acceptance** workflow. Its new manual entrypoint takes a full40-character
`source_sha` and checks out exactly that commit. The workflow contains no production
credentials and never deploys. PR checks still run automatically. After this change
is merged, an authenticated Cloud GitHub CLI can run:

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

Pooling acceptance reproduces SQLSTATE53300 with six idle direct sessions, then
holds24 client sockets across12 copies of the actual current transport behind a
four-backend transaction pool. It verifies concurrent reads/writes, backend
affinity, read-only enforcement, role reset, permission denial, rollback, exact
command replay/conflict and lost-COMMIT recovery. The pinned Vercel helper is also
exercised with a synthetic request context and real pg idle timers. Unit tests
cover production endpoint/source/target/TLS/role guards and diagnostic redaction.
The Docker verifier owns/removes only its fresh local container, passes no app
env files and invokes no providers. PostgreSQL/PgBouncer exercise the transaction
semantics locally; they do not certify hosted Supavisor settings or Vercel's
actual suspension behavior. Those require the separately approved release checks.

`connection-pooling-before.json` contains exact hashes and bounded line inverses
for the changed historical witnesses. The historical copy/loader applies that
inverse before the older fixture chain; no original migration fixture is updated.
Current pooling tests always execute the current physical transport.

`npm test` runs the immutable pre-native regression/type witnesses in an owned,
credential-free, fully hash-pinned source copy, then current native source checks.
The root TypeScript config excludes only the old `tests/*.types.ts` signatures;
those signatures still compile against their pinned predecessor during `npm test`.
New native type checks live under `tests/native-postgres/` and compile with current
source. Historical copy Git identity is synthetic and has no user hooks/credentials.

The native PostgreSQL verifier independently proves the predecessor schema history,
then runs **current physical source**, with no source overlay, against separate
fresh final-schema copies. Runtime EXECUTE on all46 `typed_input_*`/`typed_project_*`
functions is revoked. Owner-only projections are independent comparison oracles,
never runtime dependencies. It checks all23 named projections and existing feature,
media, LINE and browser flows. No hosted resources or real providers are used.

The pinned predecessor's typed verifier tests the released final schema, then the PR81 CHECK/
shared-guard artifact on independent synthetic copies. Its constraints phase is
[`verify-constraint-validation.sh`](../../tools/migration/verify-constraint-validation.sh),
**sourced by the parent**, not a standalone production command. It checks exact
51-table/15-metadata preservation, guarded refusals/atomic rollback, 23-table write
parity, all 47 timestamp fields, permissions, real application/LINE owners, native
times and browser lost-response/reload/replay. The same parent also creates a
fresh final-schema copy for `concurrent-edits.test.cjs`: actual Order/Movement
HTTP handlers, simultaneous isolated browser sessions, stale-record rejection,
child/direct-write invalidation and upload replay. Providers are forbidden.

The final parent phase also sources `verify-media-catalog.sh` on fresh final-schema
copies. It checks the guarded operator artifact and inverse, all five reference
paths, eleven catalog columns, restricted reader permissions, browser/LINE uploads,
retry/uncertainty behavior, 52-table recovery coverage and current-app operation
after rollback. It uses synthetic URLs/bytes and fake providers only.

The media phase also sources `verify-media-url-retirement.sh`. It uses new synthetic
copies for the retained URL, ID-only and column-restored layouts. Actual feature
ports, browser retry/reload, both LINE image workflows and the prior released app
exercise ID persistence, canonical URL DTOs, clearing/revision conflicts, metadata,
uncertainty/replay and rollback. Guard tests refuse missing approval, stale/wrong
target, limited readers and external dependencies; a full52-table proof excludes
only the five retired operational fields and retains import-schema evidence.

Historical verifiers intentionally use the matching older adapter and hash-bound
pre-scoped-token route/client in a disposable
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

## Private PostgreSQL account configuration — local verification

Current acceptance uses actual PostgreSQL configuration/metadata composition and
the existing provider transport with synthetic credentials only. `npm test` retains
all703 pinned historical regressions/type witnesses and runs current graph/account
checks separately. `tests/fixtures/postgres-accounts-before.json` is a bounded,
hash-checked source inverse; it contains source text, never private account rows.

`bash tools/native-postgres/verify-accounts.sh` creates a fresh localhost-only
PostgreSQL container and removes only that owned container afterward. It checks
the actual migration/importer, wrong-identity rejection, populated-target refusal,
exact metadata HTTP output, provider-bound token/store filters, runtime write
denial, reader token denial, CHECK/UNIQUE behavior, timestamp updates and a
configuration-only dump/restore with matching records/RLS/column permissions.
Unit checks cover malformed/empty/all-disabled configuration, source selection,
no fallback and secret redaction. Google auth files retain exact predecessor bytes
at their shared path; Drive factory changes are import-only. No production token,
source record, provider call, rich-menu operation or live database is used.

Type checking, lint (one pre-existing unused `shipmentRow` warning) and the isolated
credential-free build pass. The build retains the route manifest and113 browser
chunks, with no private database strings. Local acceptance does not certify real
Loyverse connectivity, browser visuals or the future production transfer; follow
the [separate release packet](../database-migration.md#private-account-configuration-release).


## Legacy payment table retirement compatibility

Current runtime requires the released receipt JSONB layout. The old operational
payment repository/fallback is removed; the original archive/catalog fixtures and
operator rebuild/inverse are unchanged. `receipt-payment-retirement-before.json`
binds PR98 source hashes and bounded source inverses. Older schema campaigns run
only in their owned pinned copy. Current physical owners run separately with the
operational table absent, using the operator-only schema-guard compatibility SQL.
No production credentials, records or providers are used.

The native acceptance adds exact report/split comparisons, zero/none entries,
command replay, late transaction failure, schema-guard refusal and dependency/
DDL atomicity checks. It dumps/restores the absent-table layout and compares all
remaining recovery fingerprints,15 metadata sections, private configuration rows
and all three sequence value/is_called states. This test-only comparison uses
visible column positions because logical restore compacts dropped physical slots;
all column names/order/types/defaults/ACLs stay exact. One pair of complete known
`media_dates` CHECK definitions is also canonicalized for PostgreSQL reparse
parentheses, with an independent343-case SQL equivalence check. Other definitions
and validation flags stay exact. Actual current reports then run on
the restore. The migration payment archive is always present and unchanged.
This prepares removal but does not authorize a live DROP or certify provider IO.

## Product catalogue UAT

`npm test` includes current catalogue browser/domain/port/boundary regressions.
The PostgreSQL acceptance campaign adds a fresh `np_product_uat` clone only after
the final schema is proven; it runs `tools/product-uat/postgres.test.cjs` against
actual current Orders/Products/HTTP owners. Existing predecessor fixtures remain
immutable behind a new exact test-only inverse; none of that inverse is runtime
compatibility code. The isolated build allows only three new catalogue route
entries and requires every previous route entry to retain its original hash.

On the Mac, `tools/product-uat/local.py --snapshot <private-synthetic-fixture>
--artifacts <private-output> [--docker-host <existing-local-engine>] --serve` starts
a sanitized synthetic browser target; see the [UAT runbook](../database-migration.md#product-master-uat).
Use an existing Playwright installation through `NODE_PATH` and set
`STOCK_CHROMIUM_EXECUTABLE`, then run
`node tools/product-uat/browser.cjs <printed-localhost-order-url> <private-screenshot>`.
It exercises create/link, duplicate review, a dropped post-commit response, page
reload and exact-key replay against the real HTTP server/database. It refuses
non-local URLs and aborts any external browser request. These tools are not hosted
access adapters and must never receive production credentials or real snapshots.
