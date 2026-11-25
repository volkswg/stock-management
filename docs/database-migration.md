# Supabase production operations

## Current production

Business storage and private Loyverse configuration run on PostgreSQL. The
[release ledger](refactoring/progress.md#latest-production-release) records the
last independently verified deployment; merged docs/test changes are not deployed
app changes. Browser/LINE reopening is recorded there. This guide is not a fresh
inspection or permission to execute a historical release packet.

| Identity | Approved existing target |
| --- | --- |
| Supabase project | `stock-management-production` / `hzynvirpedqnvtbifobx` |
| Database / purpose | `postgres` / `production` |
| Isolation UUID | `349b9289-f684-4ec5-ac22-924b2be1946b` |
| Vercel project / team | `prj_XH4nEje5cicuBuucGumuHgr73l1E` / `team_bkDqHUBMbLyAXmwZqvCmovcu` |
| Canonical domain | `inventra-beta-one.vercel.app` |
| Application region | Explicit staged release region `hnd1`; verify each build, not a project-name assumption |
| Runtime endpoint | `aws-1-ap-northeast-1.pooler.supabase.com:6543`, transaction mode, project-suffixed runtime login |
| LINE cutoff | `2026-11-16T15:00:00.000Z`; preserve signature verification and cutoff on unrelated releases |

The last verified schema has 53 private tables and four identity sequences:
28 operational (23 business plus media/commands/revision/effects/environment),
24 immutable migration tables and one private account-configuration table.
Use current schema/fingerprint tools to verify the next packet; do not infer
function/trigger counts or database freshness from older documentation.

Typed named columns are authoritative. Operational cells/row order/kinds/lexemes,
duplicate URL columns, `archived_at`, the unused purchase reference and the old
operational payment table are retired. Receipt payments are JSONB arrays; products
and movement shop IDs are installed. Import evidence and old operator artifacts
remain protected. Neither this guide nor a merge authorizes rerunning them.

## Production configuration and access

[`productionSettings()`](../src/infrastructure/persistence/postgres/database.ts)
binds source SHA, Vercel project, Supabase host/project/isolation/purpose and runtime
role. Verify exact identities, not names alone. A test target is never production.

| Setting | Contract |
| --- | --- |
| `STOCK_STORAGE=supabase` | Explicit production PostgreSQL selection; no Sheets fallback |
| `STOCK_PRODUCTION_ENABLED=true` | Production identity profile |
| `STOCK_DATABASE_URL` | Private server-only app login on the approved endpoint |
| `STOCK_DATABASE_CA` | Existing approved server CA where configured; TLS verification stays enabled |
| `STOCK_TARGET_ISOLATION_ID` | Exact approved isolation UUID |
| `STOCK_PRODUCTION_RELEASE_JSON` | Exact source/project/runtime/connection/access binding, matching deployed source |
| `STOCK_PRODUCTION_READ_ONLY` | Explicit deployment write guard; never toggle incidentally |
| `STOCK_LINE_ACCEPT_EVENTS_AT_OR_AFTER_UTC` | Existing migration cutoff |

Production refuses staging/test flags and mixed identities. Never disable TLS,
put overrides into the URL, substitute an owner credential or distribute a runtime
secret to a browser/Cloud task. Existing logins retain their limits: runtime 6,
reader 6, backup 2. Preserve memberships, grants, RLS and private schemas. Metadata
readers cannot read private account tokens. No public credential editor exists.

The owner-retained `legacy-as-is` policy does not implement staff login/RBAC/shop
authorization. Preserve existing API restrictions and LINE/raw-body controls; see
the separate [authentication plan](architecture/user-authentication-roadmap.md).
Backup automation remains deferred. A docs-only or database-only commit is not a
new deployed application SHA; do not rewrite its source binding.

## Connection pooling and failure handling

PR105 released the official Vercel pool lifecycle hook, transaction endpoint and
four-backend shared-pool budget, leaving room beneath runtime limit 6. The local pg
pool has maximum 2 **per Vercel instance**, not for the whole deployment. Preserve
the checked endpoint/port/mode and unnamed parameterized statements. Session/direct
modes use 5432 only in separately reviewed configurations; no automatic fallback.

Keep transaction-local role/timeouts/advisory locks, read-only enforcement, command
replay, row revisions and ambiguous-COMMIT handling. Safe connection logs expose
only phase and allowlisted codes; never driver messages, SQL, binds or credentials.
Investigate 53300/503, idle disconnects and incorrect target/TLS before retrying work.

A mode/pool-size change needs its own approved configuration packet, supervised
pause/drain and aggregate connection budget across direct/session/transaction
clients, pooler instances and old deployments. A client disconnect does not prove
old server sessions drained. Check actual dashboard setting scope and every
affected role; never raise runtime limit alone or assume a per-role setting exists.
Do not terminate sessions/reset pools without authorization. Rollback must pair the
exact compatible app, URL, release binding and recorded pool configuration, within
the same login budget. Session-mode rollback restores its capacity limitation;
do not declare recovery while it is still exhausted.

## Ownership and source mapping

The [ownership map](architecture/migration-map.md) is authoritative for current
modules and tables. The [original 23-tab catalog](../tools/migration/worksheets.json)
and [field policy](../tools/migration/cell-kinds-policy.json) are historical import
references, not a fresh workbook inventory or current runtime schema.
Private Loyverse configuration was excluded from that business export and later
transferred separately. It must never leak into business fixtures or GitHub.
Several stock/attendance consumers still use external account IDs; do not guess
shop relationships or invent missing IDs/dates while preparing a packet.

## Recovery checkpoint

Destructive/schema maintenance requires a fresh, independently restored one-off
checkpoint even while automated backups are deferred. Keep records, credentials,
keys, dumps, fingerprints and receipts on the Mac or approved private storage.
Archive listings/checksums alone are not restore verification.

1. Verify exact host/TLS/isolation/purpose, approved private PGSERVICE/passfile and
   complete SELECT/RLS coverage. Passwords never enter arguments, Git or chat.
2. Capture **all 53 tables**, all 15 core metadata sections, private configuration
   including tokens/permissions, Products and all four sequence values/is_called
   within one consistent exported read-only snapshot. Use the existing separately
   reviewed online wrapper when users must remain active; ordinary core capture
   takes cooperative writer locks and is not a non-blocking backup.
3. Core [recovery.py](../tools/migration/recovery.py) needs the explicit current
   layout flags `--include-media --without-legacy-payments --history revision`,
   `--target-id` and `--target-purpose production`; restricted exports also need
   `--row-security-reader`. Its fixed inventory is **not** complete 53-table recovery.
   Include private configuration separately and append the
   [Products fingerprint](../tools/product-uat/recovery-fingerprint.sql) inside
   that **same exported snapshot**. Capture all four sequences before/after online
   dumping and stop on advancement. Retain dump/fingerprint/receipt checksums.
4. Restore into an empty network-isolated local PostgreSQL target. Restore
   password-free role/membership metadata, locale and necessary dropped-attribute
   gaps; compare all data, products, configuration, sequence states, owners/grants,
   RLS and metadata. Rehearse exact forward/inverse and actual application/LINE
   consumers using fake providers. Retain the full comparison privately.
5. An online checkpoint can become stale. Recheck the complete frozen state before
   DDL; a matching global revision alone is insufficient. Refresh, independently
   restore and rehearse if anything differs, or abort/reopen within the window.

Core fingerprinting supports one/two bounded workers and row digests. Do not reuse
old 51/52-table wrappers, infer approvals from environment variables, or claim that
this covers Supabase Auth/Storage, service passwords, Drive image bytes or external
provider outcomes. Independent encryption/decryption and off-device key recovery
need separate evidence where included in the approved backup scope.
An application-only release may reuse verified retained recovery after checking
its applicability; never call that a fresh database checkpoint or restore it over
later work. Keep an exact compatible app/config rollback target.

## Maintenance procedure

Every live schema/deployment/traffic change needs explicit approval for its exact
target, source/SQL hashes and effects. Merge/CI or a closed earlier window is not
fresh execution approval. Keep users running during non-destructive preparation.

1. **Prepare:** verify merged source/CI, current dependencies, live deployment/env/
   LINE/protection bindings, fresh applicable recovery and local forward/inverse
   rehearsal. Prepare exact hashes/timeouts; historical SQL is not automatic setup.
2. **Confirm:** name the supervisor and reopening/abort deadline in Bangkok time.
   Confirm browser/LINE senders, direct editors, jobs/scripts and external writers
   are paused, with pending saves/uploads finished/accounted for and no uncertain
   provider outcome. Reserve enough time for verification and rollback.
3. **Fence/drain:** publish only the reviewed temporary rule denying methods other
   than GET/HEAD/OPTIONS. Prove browser mutations/LINE denied and reads available;
   drain active/prepared business transactions. Preserve original rules. WAF denial
   and LINE retries are not a durable event inbox: rely on the confirmed sender
   pause or a separately approved, verified loss-safe event-hold procedure.
4. **Reconcile:** compare all frozen data/metadata/configuration/sequence state to
   recovery. Capture approved private canonical GET baselines (orders, movements,
   shipments, employees plus affected flows), preserving values/types/order and
   revision/scope headers. Fresh business reads still need appropriate approval.
5. **Apply:** use only the approved owner/service and artifact, bounded timeouts,
   identity/purpose/source/revision/recovery guards before/after locks. Unknown
   dependencies, role/ACL drift, partial schema, insufficient time or uncertain
   outcomes are stop conditions. Inspect committed state before any retry; do not
   silently repair records, weaken guards or use CASCADE to force completion.
6. **Verify:** reconcile all 53 table values, sequence/configuration and metadata
   except the reviewed delta; preserve IDs, times, row/global revisions, journals,
   owners/ACLs/RLS. Compare approved app/LINE read behavior. No real provider or
   accepted-write canary is implied by local/fake-provider evidence.
7. **Reopen:** remove only this window's rule; check original firewall/settings,
   deployment/source, availability, signature/cutoff and missing-key rejection.
   Scan the actual live deployment's safe error counts and save private receipts.
   Announce reopening only after success. Firewall version/publication timestamps
   may change; compare their exact active version while preserving original rules.

Application-only releases without schema/traffic changes may use the narrower
[portable procedure](#cloud-application-only-release) below. It does not authorize
fresh business-record reads, new bypass links, provider calls or a write fence.

## Rollback and refusal conditions

- Failed guarded transactions must roll back atomically; inspect actual state on
  ambiguity before retrying. Never replay unknown business/provider outcomes.
- Before reopening, use only the reviewed/rehearsed schema inverse with exact
  forward-state and frozen revision gates, then verify original data/metadata.
- After later acknowledged writes, never restore an old dump or switch to stale
  Google Sheets. Re-fence if approved, inspect journals and prepare reconciliation
  or forward repair against current data.
- App rollback requires a known schema-compatible source, deployment and matching
  configuration. Pre-PR91 code cannot handle converted order-bill revision IDs;
  later session/item/product/removal contracts add further compatibility gates.
  Prior read success is not rollback proof.
- The old receipt-table inverse requires selective verified schema/data recovery
  plus current JSONB reconciliation and a matching application; its PR98 inverse
  alone cannot undo table retirement. Never rebuild JSONB from the stale ledger.
- Shop-ID rollback must retain added references unless separately approved, account
  for outstanding callbacks/sessions and old fixed-destination writers, and retain
  the PR105 transaction/pool 4 configuration. No automatic ID drop or stale restore.
- Preserve `stock_migration`, payment archive, protected staging/UAT and unrelated
  resources. No fresh Sheets synchronization, paid resource, role/account creation,
  permission change or provider operation is authorized by documentation.

## Product Master UAT

Product Master and item linking are released (PR103). Existing UAT tools are for
new authorized verification, not a release prerequisite to repeat. Use synthetic
records only. `tools/product-uat/local.py --snapshot <private-synthetic-fixture>
--artifacts <private-output> [--docker-host <existing-local-engine>] --serve`
starts a sanitized localhost app/database. Never pass production dumps/credentials.
The browser runner rejects non-local URLs and aborts external requests.

Any hosted UAT must reuse the approved existing staging project
`stock-management` / `orjnazrothkdgmzlsuto`, preserve its data/old operational schema,
and fit its existing free capacity. No new project/paid branch/upgrade is approved.
Keep staging target/bearer guards separate from production. Do not put a bearer in
page storage, use a global cross-origin header, connect a real provider or activate
a UAT bridge on production. Recheck target/capacity before future execution;
retained approval does not establish current UAT deployment readiness.

## Operator artifacts and historical procedures

Completed account transfer, identity/sidecar/media/payment/product/shop migrations
are archived in the [prior runbook](https://github.com/volkswg/stock-management/blob/950d31e9ce3e89dd6b76d98762112e4a0787829c/docs/database-migration.md).
Its exact operator paths, settings and inverses are history, not pending actions.
The [evidence index](refactoring/progress.md#historical-document-index) maps earlier
guides and records the tradeoff for old default-branch section links.
Read/review/rehearse a new exact packet before any later live change.

## Cloud application-only release

This portable procedure lets an authorized Codex Cloud operator prepare and execute
an application-only release in the **existing** Vercel project. It changes no schema,
business records, traffic controls, access protection, pool settings or provider
credentials. Private recovery/evidence stays on the Mac. A database change, fresh
record export, provider canary or maintenance release still uses its separately
approved operator packet above; do not adapt this procedure to bypass that gate.

`npm run cloud:release` is a **token-free packet builder**, not a deployment client.
It validates read-only metadata and emits exact requests for an authenticated
operator. It does not grant approval, establish a connection or make an API call.
No GitHub deployment secret, paid environment-review feature, new resource or
production setting is configured by adding it. Source/CI must first be reviewed and
merged; an unmerged source is refused even when its feature tests pass.

### One-time Cloud access

Use the existing connected Vercel tools and GitHub connection where their operations
are sufficient. If the Vercel tool cannot explicitly preserve `autoAssignCustomDomains:
false` and `hnd1`, use official Vercel CLI65.15.0, already used for the reviewed Mac
releases. Install it in an owned Cloud tools directory, outside the repository, and
have the owner approve a **new Cloud CLI session** through Vercel's official device
sign-in. Read its `--help`; never extract a connector token or copy this Mac's CLI
auth, DB profiles, passwords, `.env`, snapshots or cookies. Keep approval/setup
separate from release execution. A missing connection or denied command is a blocker,
not permission to weaken protection. Do not request a password/token in chat.

The Cloud environment needs its supported GitHub/Vercel tools and access to the
relevant HTTPS hosts/package registry. Allowing a host does not grant a service
credential. Setup/access controls belong to the Cloud environment, not a repository
sandbox-bypass option. See [Codex Cloud access](https://learn.chatgpt.com/docs/environments/cloud-environments)
and [Vercel deployments](https://vercel.com/docs/deployments).

### Prepare the packet without changing production

1. Use connected read-only tools to obtain GitHub main/source commit and tree IDs,
   complete changed-path comparison from the live source, and successful
   `.github/workflows/migration-acceptance.yml` CI for the same source or exact tree.
   Do not hand-author CI success. If needed run its manual exact-SHA entrypoint first.
2. Inspect Vercel project `prj_XH4nEje5cicuBuucGumuHgr73l1E` in team
   `team_bkDqHUBMbLyAXmwZqvCmovcu`, its current READY production deployment,
   canonical alias `inventra-beta-one.vercel.app` and active firewall. Read only
   **non-secret** `STOCK_PRODUCTION_RELEASE_JSON` and encrypted variable metadata;
   never pull/decrypt runtime/provider credentials. Do not fetch business APIs.
3. In an ignored private directory such as `migration-artifacts/cloud-release/`,
   save `stage-input.json` containing `project`, `live`, `binding`, `firewall`,
   `aliasDeploymentId`, `source` and `ci` from those verified tool results. The
   input contract is exported as the synthetic example in
   `tools/cloud/workflow.test.mjs`; example IDs/CI status are never production evidence.
   `source` has `sha`, `tree`, `mainSha`, `baseSha` (the live source), `changedPaths`; `ci` has `repository`,
   `workflowPath`, `sha`, `tree`, `status`, `conclusion`.
4. Run:

   ```sh
   npm run cloud:release -- stage-plan \
     --input migration-artifacts/cloud-release/stage-input.json \
     --out migration-artifacts/cloud-release/stage-packet
   ```

   Existing live source/binding, exact project/isolation/runtime, transaction pooling,
   disabled domain auto-assignment, CI/tree identity and absence of existing
   maintenance must match. Changed SQL/migration/env files refuse this path. Plan
   output contains only the non-secret binding, request bodies, rollback source
   binding and hashes. Keep it private; upload no environment snapshot or records.
5. Present that exact source, target, requests, HEAD-only checks, rollback deployment
   and rollback binding for owner approval. Also recheck the retained recovery
   reference with its Mac operator if required by the approved release scope. Do not
   invent fresh recovery verification from Cloud or export a dump there. The same
   explicit approval may cover staging/promotion/rollback when it names the complete
   packet; do not ask again for actions already covered.

### Execute only the approved application packet

- Recheck all input metadata immediately before writes. A drift invalidates the
  packet. Using the authenticated connection, apply only `bindingPatch.json` to the
  one production source-binding variable, then POST `deploymentRequest.json` to
  `/v13/deployments?forceNew=1` under the exact team. `requests.json` contains the
  paths/methods; append the exact team query. When using CLI, pass bodies through
  `vercel api ... --method ... --input FILE`; no tokens in arguments or logs.
- Record the attempt before each request. On timeout, inspect committed state before
  retrying. The build is target `production`, fixed reviewed Git SHA, `hnd1` and
  `autoAssignCustomDomains:false`; the canonical domain must still point to the
  previous deployment. Restore only the source binding if creation/build fails and
  the old deployment remains active. Never resubmit an uncertain create blindly.
- Poll that deployment until READY or failure. Check exact source, region, target,
  protection and unchanged environment/firewall/alias. A HEAD request to its protected
  host must be denied/redirected to Vercel; do not create a bypass or access link.
- Save the refreshed `project`, `live`, `binding`, `firewall`, `aliasDeploymentId`,
  `staged` and the observed `protectedDeploymentVerified:true` as `ready-input.json`.
  The `live` entry remains the previous active deployment. Run:

  ```sh
  npm run cloud:release -- ready-plan \
    --input migration-artifacts/cloud-release/ready-input.json \
    --manifest migration-artifacts/cloud-release/stage-packet/manifest.json \
    --out migration-artifacts/cloud-release/ready-packet
  ```

- After the packet's owner promotion approval, execute its exact `promotionCommand`
  (`vercel promote DEPLOYMENT --yes`). Do not promote a preview/rebuilt substitute.
  Verify project/canonical alias now identify this deployment and only the release
  binding's source commit changed. This protocol uses promotion followed by immediate
  status/guard checks and approved app rollback; it does not claim pre-promotion
  business-data comparisons through a protected host.
- Run only the packet's **HEAD** checks and rejected probes. HEAD responses carry no
  business-record body. Invalid LINE signature must return401 and a missing
  Idempotency-Key must return428; neither request is allowed to write or invoke a
  provider. Check the source static helper and deployment error counts/allowlisted codes only;
  do not fetch raw business/provider log values or publish private contents. No accepted-write canary or fresh
  business-record GET is included. Stop on unexpected responses; never weaken guards.
- If any live check fails, invoke the approved `rollbackCommand`, restore the exact
  `rollbackBinding.json` via the same variable ID, and verify the previous domain,
  binding and guards. Preserve all records and existing schema. If rollback is
  uncertain, report the actual state immediately and use the approved operator;
  do not restore a stale database snapshot or announce success.
- Record source/deployment, check statuses, CI, preserved settings, rollback result
  if used, and the private evidence reference. Announce release only after success.
  Keep credentials/records/private artifacts out of PRs and CI artifacts.

The installed workflow grants no release permissions. Cloud may implement, test, open PRs
and prepare packets autonomously; merge, production deployment and any database or
traffic operation still require their explicit owner authorization.
