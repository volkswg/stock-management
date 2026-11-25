# Stock Management

Next.js application for Orders, Products, Shipments, inventory/movements, Sales,
expenses and HR, using PostgreSQL/Supabase, Google Drive, LINE and Loyverse.
Canonical feature modules own workflows; shared infrastructure and explicit
composition connect them. Active retry/rollback compatibility remains intentional.

**Production safety:** completion of the refactor does not certify authentication, authorization, live provider behavior or concurrent writes. [Issue #38](https://github.com/volkswg/stock-management/issues/38) tracks access-control verification, CI and isolated smoke tests. Check access restrictions before exposing employee/payroll or write-capable APIs; do not run mutating smoke tests against production.

Business records and private Loyverse configuration use PostgreSQL. Google Drive
remains the image provider; no runtime business Sheets backend remains. See the
[single release ledger](docs/refactoring/progress.md#latest-production-release)
for the last verified deployment and merged-versus-deployed status. The
[operations guide](docs/database-migration.md) owns recovery, maintenance and rollback.

## Start here

- [Architecture guide](docs/architecture/README.md) for current ownership and documentation navigation; [engineering rules](AGENTS.md) for safe development.
- [Roadmap](docs/refactoring/roadmap.md) for **current and next work**; [progress ledger](docs/refactoring/progress.md) for completed PRs and archived evidence; [verification](docs/refactoring/verification.md) for safe commands and limits.
- Operational guides: [expenses](docs/expenses.md), [movement migration](docs/movement-migration.md), [LINE rich-menu links](docs/rich-menu-links.md) and [stock adjustments](docs/shop-stock-adjustments.md).

## Local development

Use Node 24 (verified 24.22.1) and the repository's existing dependencies and yarn.lock. Run `npm run dev`, then open [localhost:3000](http://localhost:3000). Source is under `src/`; Next routes are in `src/app`. Use approved development configuration. Architecture verification uses isolated copies without application credentials; do not start live integrations or run operational setup as a check.

## Business storage

Current source uses PostgreSQL-only business storage. Keep the existing
`STOCK_STORAGE=supabase` production setting and strict private connection/release
binding. Worksheet classes/ranges and the former Sheets business fallback are
retired. Google Drive uploads remain. Private integration-account reads also use PostgreSQL; keep Drive credentials
separate from retired Sheets business settings.

## Loyverse Configuration

`LOYVERSE_ACCOUNT_SOURCE=postgres` reads the private
`stock_configuration.loyverse_accounts` table using the existing verified
PostgreSQL connection. `env` (also the unset/blank default) retains the existing
`LOYVERSE_ACCOUNTS_JSON` alternative. There is no automatic fallback; `sheet` is
no longer accepted by this source. The unused synchronous factory is retired; active routes use server composition.

Account IDs, active flags, explicit sort order, default account and optional store
filters retain their existing meaning. All-disabled configuration returns no
active accounts; missing/empty storage fails closed. Existing disabled-account
shop mappings and financial history remain editable through their existing rules.
Account/shop APIs return only their existing public metadata. Tokens are
server-only and remain inside provider closures; there is no credential editor or
new management API.

The table is in an unexposed private schema with RLS. The app can read but cannot
edit its configuration. The existing production reader can select metadata columns
but not accessToken. Owner-approved SQL/administration handles future account edits.
Keep tokens out of GitHub, browser bundles, ordinary logs and `NEXT_PUBLIC_*`.

The account transfer was released in PR89; its
[original procedure](https://github.com/volkswg/stock-management/blob/950d31e9ce3e89dd6b76d98762112e4a0787829c/docs/database-migration.md#private-account-configuration-release)
is historical evidence, not setup to rerun. Use the current
[recovery/configuration safeguards](docs/database-migration.md#recovery-checkpoint)
for future separately approved changes. Original credentials remain private;
Google Drive's OAuth/service-account settings must not be deleted as Sheets cleanup.

## Movement creation mode

Set `MOVEMENT_CREATE_MODE` in the deployment environment, then redeploy:

A production setting change or deployment requires separate release approval.

- `quantity_photo` (default, including when unset): existing LINE journey —
  choose an active shop master, enter quantity/breakdown, send photo, then repeat or close the bag.
- `photo_only`: choose an active shop master, send product photos, then Close Bag → Another Shop
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
The stored `requestedDate` and `requestedAmount` fields remain compatibility metadata, set to the payment date and actual paid
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

`employee_advances` and `payroll_settlements` are PostgreSQL business tables;
reads do not create storage and no worksheet permission/header setup is required.
Transactions, stable request identity and existing payroll revisions protect
retries and stale forms; identical settlement retries reuse the confirmed result.
Keep each settlement snapshot and recovery allocations immutable. Do not manually
alter paid advances or settled payroll in the database. Earlier Sheets setup and
partial-write constraints remain in the [archived README](https://github.com/volkswg/stock-management/blob/950d31e9ce3e89dd6b76d98762112e4a0787829c/README.md).

## Shop stock adjustments

Record employee gifts, damage, samples, personal use, returns and corrections in
**Monthly stock count → Stock adjustments**. Entries update only the selected
shop/month; physical counts and finances remain separate. Corrections retain
history using reversals and linked replacements. See
[the stock-adjustment workflow](docs/shop-stock-adjustments.md) for calculations,
Loyverse duplicate prevention, warnings, optional photo links and current storage guidance.
