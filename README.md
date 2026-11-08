# Stock Management

Next.js application for Orders, Shipments, inventory/movements, Sales, expenses and HR, using Google Sheets/Drive, LINE and Loyverse. The scoped modular refactor is complete through [PR #40](https://github.com/volkswg/stock-management/pull/40): active code uses canonical feature, infrastructure and composition owners; `src/externals/` is removed. Some other compatibility paths remain intentionally supported.

**Production safety:** completion of the refactor does not certify authentication, authorization, live provider behavior or concurrent writes. [Issue #38](https://github.com/volkswg/stock-management/issues/38) tracks access-control verification, CI and isolated smoke tests. Check access restrictions before exposing employee/payroll or write-capable APIs; do not run mutating smoke tests against production.

## Start here

- [Architecture guide](docs/architecture/README.md) for current ownership and documentation navigation; [engineering rules](AGENTS.md) for safe development.
- [Roadmap](docs/refactoring/roadmap.md) for **current and next work**; [progress ledger](docs/refactoring/progress.md) for completed PRs and archived evidence; [verification](docs/refactoring/verification.md) for safe commands and limits.
- Operational guides: [expenses](docs/expenses.md), [movement migration](docs/movement-migration.md), [LINE rich-menu links](docs/rich-menu-links.md) and [stock adjustments](docs/shop-stock-adjustments.md).

## Local development

Use Node 24 (verified 24.22.1) and the repository's existing dependencies and yarn.lock. Run `npm run dev`, then open [localhost:3000](http://localhost:3000). Source is under `src/`; Next routes are in `src/app`. Use approved development configuration. Architecture verification uses isolated copies without application credentials; do not start live integrations or run operational setup as a check.

## Google Sheets worksheet names

`GOOGLE_SHEETS_SPREADSHEET_ID` is required for the workbook. The 23 `GOOGLE_SHEETS_*_WORKSHEET_NAME` settings are **optional**: `src/config/index.ts` supplies the existing worksheet-tab defaults, including `orders`, `shipments`, `movements` and `movement_details`. The `.env.example` template omits these redundant overrides.

Keep or add a worksheet-name environment variable **only if** its actual workbook tab differs from the default. For example, to use a tab named `shop_orders` instead of `orders`, set `GOOGLE_SHEETS_ORDERS_WORKSHEET_NAME=shop_orders`. Before deleting overrides from an existing environment (local or deployment settings), verify every actual tab matches the corresponding default. Changing the template does not change deployed environment variables or rename any Google Sheets tabs.

## Loyverse Configuration

`LOYVERSE_ACCOUNT_SOURCE=env|sheet` selects the server-only account source. Unset or blank defaults to **env**; unknown values fail validation. Existing JSON configuration remains supported, with the same array order, IDs and optional store filter:

```dotenv
LOYVERSE_ACCOUNT_SOURCE=env
LOYVERSE_ACCOUNTS_JSON=[{"id":"main-shop","shopName":"Main Shop","accessToken":"...","storeId":"optional-store-id"}]
```

Keep credentials in approved private configuration, never source control, screenshots, chat, logs or `NEXT_PUBLIC_*` variables. There is no credential editing page or management endpoint. Existing account/shop APIs return only their existing public metadata.

### Prepare the account worksheet in the existing workbook

These are **owner actions after review**, not steps performed by this PR:

1. Use the existing `GOOGLE_SHEETS_SPREADSHEET_ID` workbook. Sheet mode always reads that workbook; there is no account-specific spreadsheet ID or workbook fallback. Use a dedicated `loyverse_accounts` tab, never the existing `shops` tab.
2. **Every workbook reader can see the access-token cells. Hiding or protecting a worksheet does not provide separate read access.** Restrict and audit sharing before adding tokens. Keep access limited to the owner, required service account and only people explicitly trusted with credentials; remove broad/inherited/link sharing. If access cannot be restricted appropriately, keep env mode until it can. Keep the service account's existing operational permissions needed for business writes; do not downgrade them. The account reader still requests the read-only Sheets scope and never creates tabs, repairs headers or writes credentials.
3. In that existing workbook, create one worksheet named exactly `loyverse_accounts`. Put these six case-sensitive headers in A1:F1, in this order:

   ```text
   id,shopName,storeId,accessToken,active,sortOrder
   ```

   | Column | Value |
   | --- | --- |
   | id | Original `LOYVERSE_ACCOUNTS_JSON` account `id`, unchanged and unique across all rows |
   | shopName | Original display name |
   | storeId | Original store ID, or blank if absent; blank retains the existing unrestricted store behavior |
   | accessToken | Original private token; required for active accounts, may be blank for disabled accounts |
   | active | TRUE/FALSE (checkboxes or those case-insensitive text values) |
   | sortOrder | Unique nonnegative safe integer, including disabled rows; no ties, fractions or thousands separators |

4. Format A:D as **plain text** before manual copying, so IDs, store IDs and tokens retain leading zeros and exact text. Use ungrouped integer formatting for F. Privately copy each existing JSON account to a row, set active to TRUE and assign sortOrder in the **original JSON array order**, for example 10, 20, 30. Never generate replacement IDs or substitute `shops.id` or `storeId` for the existing account ID. Do not modify the operational shops, receipt, payroll or stock worksheets.
5. Compare the copied IDs, names, optional store IDs, token values and ordering privately with the existing configuration. Do not export that comparison into issue/PR attachments or logs. Existing values are trimmed as in env mode. Duplicate IDs/order values, malformed flags, missing enabled tokens, bad headers and a header-only/empty worksheet fail closed; fully empty rows are ignored. An all-disabled valid worksheet returns an empty active list.

The application sorts enabled accounts by sortOrder and uses the first as the existing default. Disabled accounts cannot be selected for provider reads/sync or new account mappings. Their stored financial history is preserved: combined reports and existing Shop Master mappings may still include historical records. Existing mappings remain editable even when an account is disabled or removed. Disabling does not revoke a provider token or cancel a request already in flight.

### Enable, verify and roll back on Vercel

1. Keep `LOYVERSE_ACCOUNTS_JSON` unchanged for rollback. In the project's **Settings → Environment Variables**, choose only the intended environment/branch. Set the source to sheet using the already configured operational workbook:

   ```dotenv
   LOYVERSE_ACCOUNT_SOURCE=sheet
   # Existing setting; this is also the account workbook.
   GOOGLE_SHEETS_SPREADSHEET_ID=<existing workbook ID>
   ```

   `GOOGLE_SHEETS_SPREADSHEET_ID` is the only workbook setting. The former `LOYVERSE_ACCOUNTS_SPREADSHEET_ID` setting is no longer read, even if an old deployment setting remains. If upgrading from a separate account workbook, manually copy the six-column tab into the existing workbook and verify IDs/order privately before switching to this code. No copying or Vercel setting changes are performed by this PR. Keep the existing service-account settings. Scope staging/preview to its own restricted test workbook and credentials, not production data. Never use `NEXT_PUBLIC_` prefixes.
2. After owner-approved deployment of the reviewed code, verify in an isolated staging environment first. Env changes apply to new deployments; changing the dashboard setting alone does not switch a running deployment. Sheet mode never evaluates the JSON account source. A missing/invalid `GOOGLE_SHEETS_SPREADSHEET_ID`, bad rows, a missing tab, denied access or provider failure produces a safe error. There is no alternate workbook or env/JSON fallback.
3. Check `/api/loyverse/accounts` returns only the expected active `id`/`shopName` pairs in the original order. Verify the default and explicitly selected account, optional store filtering, daily/dashboard/profit totals, sync-status lists, Inventory and attendance shop lists, and Expenses Shop Master account mappings. Inspect response keys and logs for confidentiality without copying tokens into them. Metadata requests must not return tokens, store credentials or raw Google errors.
4. Using staging fixtures, check a disabled account is absent and cannot be newly selected, an existing disabled-account Shop Master mapping can still be edited, and missing workbook access produces a safe failure. Verify Sales sync on an approved unsynced past date and its repeat/idempotency behavior; do not run test sync writes against production. Private accounts are read once per lookup without a cross-request cache or new retry policy; workbook outages therefore block affected lookups.
5. Roll back by setting `LOYVERSE_ACCOUNT_SOURCE=env` and deploying a new owner-approved deployment with the retained, valid `LOYVERSE_ACCOUNTS_JSON`. Verify IDs/order and normal operation again. There are no business-data migrations to undo; the account worksheet is simply unused in env mode.

Delete the deployed `LOYVERSE_ACCOUNTS_JSON` value **only after** successful owner verification, completion of the agreed rollback window, confirmation that every environment/deployment that needs it has migrated, and an approved secure recovery plan. Older deployments or an env-mode rollback still need it. Removing the variable is a separate owner operation; this PR retains JSON support and does not delete credentials, migrate production records or deploy anything. Live sharing, access and account correctness remain owner verification steps.

## Product Master and Order Item identification

Product Master is optional for Order creation, uploads and LINE journeys. Open an Order Detail page and choose **Identify product** on an item (including items without photos). Search by code/name/variant, select an active record and **Save association**. Different items can reference the same permanent product; codes need not be unique. Clear/remove or change an incorrect association without changing quantities, photos or financial values.

**Create new product** prefills the item's code and image URL. Enter a name and optional variant, review duplicate suggestions (including archived products), then explicitly confirm. Uploading an image never creates a product. Creation and linking are separate: after a link failure, retry the existing association; do not create a replacement. The browser retains pending request IDs and nonsecret form values in this tab's session storage across reloads. Keep the tab/storage until recovery finishes. An unresolved creation can be checked, retried with the same request, or permanently cancelled; if creation already won, its product is retained. An already created product can explicitly be kept unlinked. Editing/archiving is available in the same dialog; archival preserves all historical Orders and links.

### Owner setup and access

These are manual owner actions **after review**, first against an isolated test workbook:

1. In the existing `GOOGLE_SHEETS_SPREADSHEET_ID` workbook, create `products` with these exact case-sensitive A1:I1 headers:

   ```text
   id,productCode,productName,variant,referenceImageUrl,active,createdAt,updatedAt,createdBy
   ```

   Format text columns as plain text; F contains TRUE/FALSE. The application appends permanent `PROD-<request UUID>` IDs and UTC ISO timestamps, and records the authenticated staff ID as createdBy. Never edit IDs or creation attribution. No automatic historical registration/migration occurs. Reference images are HTTPS URLs to existing files, not copied/owned by Product Master; their sharing/lifetime remains the owner's responsibility.
2. In the existing Order Items tab (default `order_items`, existing name override respected), add **only `productId` in K1**. Preserve A:J and all historical rows exactly; blank K means unlinked. Do not backfill IDs automatically. Products and link operations validate headers and fail closed if setup is missing. Old order readers/writers retain A:J layouts and do not clear K; the new link adapter writes only K.
3. Retain the existing Google service account and its workbook edit access. No new workbook/provider/service account is introduced. Do not manually sort, insert/delete rows, modify product/link cells or developer metadata while application writes are possible. Use filter views instead of sorting physical rows. Existing legacy row-index writers have the same external-edit limitation.
4. Configure **server-only** `PRODUCT_MASTER_STAFF_KEYS_JSON` and `PRODUCT_MASTER_SESSION_SECRET` for the intended isolated environment. Both unset disables all new writes; reads and old Order/LINE operations continue. Generate one independent 32-byte base64url key per staff member and a separate signing secret using a trusted local secret tool. Example local generator (output contains secrets: run privately, never paste in source/PR/logs):

   ```sh
   node -e 'const c=require("node:crypto"),key=c.randomBytes(32).toString("base64url");console.log({staffKey:key,keyHash:c.createHash("sha256").update(key).digest("hex"),sessionSecret:c.randomBytes(32).toString("base64url")})'
   ```

   Store only `[{"id":"staff-id","keyHash":"<64 lowercase hex characters>"}]` in PRODUCT_MASTER_STAFF_KEYS_JSON; distribute the corresponding 43-character raw key privately to that staff member. Store the independent base64url secret in PRODUCT_MASTER_SESSION_SECRET. Neither setting uses a NEXT_PUBLIC prefix. IDs are unique ASCII letters/digits/underscore/hyphen, maximum64 characters; maximum100 staff entries. Duplicate IDs or key hashes and partial/invalid configuration fail closed.
5. Staff sign in inside the association dialog. New create/edit/archive/cancel/link writes require an eight-hour, host-bound signed HTTP-only cookie, same-origin requests and HTTPS (localhost HTTP allowed only for development). All configured staff can change the full catalog and item associations; there is no per-shop role model. Read-only catalog metadata follows the existing application read policy. Existing Order, LINE and other API authentication policy is unchanged; broader access-control work remains issue #38. Review deployment protection and sign-in abuse/rate limits before exposure; there is no distributed rate limiter in this feature.
6. Remove/rotate a staff key hash to revoke its existing sessions on the next request; rotate the signing secret to revoke all sessions. Redeploy configuration according to normal owner procedures. Sign out clears the browser cookie, but a previously stolen cookie remains valid until expiry or key/secret revocation. Raw keys are cleared from the form and never stored in browser storage or returned by APIs. Product metadata, image URLs and pending form data are not credentials.

### Reliability, rollout and rollback

New mutations atomically create a **fixed, unique Google developer-metadata ID in the same spreadsheets.batchUpdate** as the append/update. This is a server-enforced idempotency/CAS condition, not a Sheets read-check-write lock. Lost responses reconcile that same marker; retries use the same request and never probe a different marker slot. Product edits use updatedAt revisions; association changes use their own revision chain so old quantity/image edits cannot invalidate or erase links. Creating a product and linking it are deliberately separate durable operations. Distinct users confirming distinct creation requests may create similar products: suggestions do not enforce code/content uniqueness. Active-product/active-Order checks are read-time checks: a concurrent archive or legacy Order change can race a pending link. The permanent reference remains valid; no cross-record transaction or new legacy concurrency policy is claimed.

Guard metadata and cancellation tombstones are permanent and must **never be deleted/reused**, including during rollback. Google limits a workbook to **30,000 developer-metadata entries**, shared with all other users of metadata. Each successful creation, edit, association revision or cancelled creation consumes an entry. Monitor capacity operationally before enabling at scale; exhaustion fails closed. Fixed positive31-bit ID hashing can collide; collisions fail closed for operator review, never overwrite/probe. There is no automated compaction/migration or historical row repair. Report retained request IDs and safe error codes to the operator, without credentials; never repeatedly create new requests to work around ambiguous outcomes.

Deployment checklist: review scoped staff access and workbook sharing, prepare headers without touching history, configure only approved test settings, run synthetic create/search/edit/archive/link/unlink and reload/retry scenarios, check old Web/LINE uploads and quantity/code/status operations preserve K, check expired/revoked/anonymous sessions cannot mutate, and verify existing reports/route behavior. Only the owner may approve production setup/deployment; this PR performs none of those actions. Real Google metadata uniqueness/permissions/quotas and Drive URL accessibility need staging verification; local tests use fake services.

Rollback: first disable new writes/revoke sessions and drain in-flight requests, then roll back application code through the owner's usual process. **Retain products, K values, IDs, all guard metadata and tombstones.** Older A:J operations leave K intact. Do not delete new worksheets/columns or replay ambiguous writes with new IDs. Re-enable only after reviewing pending request outcomes and confirming compatible code/headers. No financial/schema backfill or historical-data deletion is needed.

## Movement creation mode

Set `MOVEMENT_CREATE_MODE` in the deployment environment, then redeploy:

- `quantity_photo` (default, including when unset): existing LINE journey —
  choose NJ/YY, enter quantity/breakdown, send photo, then repeat or close the bag.
- `photo_only`: choose NJ/YY, send product photos, then Close Bag → Another Shop
  or Summary. Forwarded text is not used as a quantity/note. Each photo is saved
  with an unset quantity; enter the note/quantity on the movement detail web page.
  Notes such as `ดำ 5` or `5` calculate quantity 5 and remain saved as entered.

The switch is global; LINE does not show a mode selector. Resumed sessions use
whichever mode the deployed environment selects. Existing saved items are not
converted. Delivery requires a positive quantity for every item in either mode.
Photo-only items use the LINE image message ID, so different images do not share
an item cursor and re-delivery of an already-saved image reuses its item.
This is not a distributed webhook queue; cross-request command ordering still
requires durable per-user serialization if strict ordering is needed.

## Salary advances and payroll settlement

Open **Human resources → Salary advances** (`/employees/advances`). This is a
shop-owner payment ledger, not an employee request/approval workflow.

1. **Record advance** after handing over/transferring money to an employee. Choose
   an active employee and shop, enter the actual amount paid, payment date,
   first payroll month to deduct from, optional reference and note, then
   **Save advance**. The entry is immediately paid and included in payroll;
   there is no separate request, approval or payment-confirmation stage.
   Paid advances cannot be edited, cancelled or deleted through the app.
2. In **Payroll**, review gross earnings, advance deductions, net salary and
   balance carried forward. Expand details or export the salary PDF for the
   individual payments and deductions. Deductions are oldest-first and capped
   at earnings, so net salary is never negative. Excess advances roll forward.
3. Pay the remaining salary, then **Settle payroll** with the final payment date
   and optional reference. This saves an immutable calculation snapshot and
   recovers only that month's allocated deduction. Merely viewing/exporting
   payroll does not recover an advance. Zero-net payroll can also be settled.

Existing unpaid records from the earlier workflow remain **Not paid** and never
become deductions automatically. The owner can **Record payment** directly,
without approval, or **Remove unpaid entry** to retain its cancelled history.
The API rejects the former approval action and cannot create new unpaid entries.
The worksheet layout is preserved: old `requestedDate` and `requestedAmount`
columns are compatibility metadata, set to the payment date and actual paid
amount on new records. No migration or rewriting of existing history is needed.

Example: ฿15,000 base + ฿2,000 commission − ฿3,000 advance − ฿2,000 advance =
฿12,000 remaining salary. The salary cost is ฿17,000, not ฿22,000.
These actions do **not** create expense entries; maintain the existing salary
expense separately and do not count advance payments again as extra salary cost.

Settlements are final in this version (no reopen/undo interface). Settle an
employee's months in chronological order. Once a month or later month is settled,
new advances/advance payments cannot be backdated into it. Older unpaid entries in
locked periods can still be removed and paid advances recorded in an open month. Salary or
attendance edits do not rewrite settled payroll. An employee with a paid advance
balance remains visible in payroll even without attendance; dates outside their
employment do not generate a new monthly base salary.

Two worksheets are added lazily on the first corresponding write, preserving
other sheets. Reads alone do not initialize these worksheets. Optional overrides:

- `GOOGLE_SHEETS_EMPLOYEE_ADVANCES_WORKSHEET_NAME` (default `employee_advances`)
- `GOOGLE_SHEETS_PAYROLL_SETTLEMENTS_WORKSHEET_NAME` (default `payroll_settlements`)

The service account needs permission to add worksheets. Unexpected existing
headers cause an error instead of being overwritten. Financial rows use RAW
cell input to preserve dates, references, notes and JSON snapshots literally.
A settlement and all its recovery allocations are stored in one row, avoiding
partial writes across the advance and settlement sheets. Creation identifiers,
state timestamps and payroll revisions protect ordinary retries/stale forms;
identical settlement retries return the existing settlement. Google Sheets has
no cross-instance transactions: process payroll/advance changes one operator at
a time rather than concurrently from multiple sessions. Do not manually alter
paid advances or settlement snapshots in Sheets.

## Shop stock adjustments

Record employee gifts, damage, samples, personal use, returns and corrections in
**Monthly stock count → Stock adjustments**. Entries update only the selected
shop/month; physical counts and finances remain separate. Corrections retain
history using reversals and linked replacements. See
[the stock-adjustment workflow](docs/shop-stock-adjustments.md) for calculations,
Loyverse duplicate prevention, warnings, optional photo links and worksheet setup.
