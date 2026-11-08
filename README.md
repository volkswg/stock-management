# Stock Management

Next.js application for Orders, Shipments, inventory/movements, Sales, expenses and HR, using Google Sheets/Drive, LINE and Loyverse. The scoped modular refactor is complete through [PR #40](https://github.com/volkswg/stock-management/pull/40): active code uses canonical feature, infrastructure and composition owners; `src/externals/` is removed. Some other compatibility paths remain intentionally supported.

**Production safety:** completion of the refactor does not certify authentication, authorization, live provider behavior or concurrent writes. [Issue #38](https://github.com/volkswg/stock-management/issues/38) tracks access-control verification, CI and isolated smoke tests. Check access restrictions before exposing employee/payroll or write-capable APIs; do not run mutating smoke tests against production.

## Start here

- [Architecture guide](docs/architecture/README.md) for current ownership and documentation navigation; [engineering rules](AGENTS.md) for safe development.
- [Roadmap](docs/refactoring/roadmap.md) for **current and next work**; [progress ledger](docs/refactoring/progress.md) for completed PRs and archived evidence; [verification](docs/refactoring/verification.md) for safe commands and limits.
- Operational guides: [expenses](docs/expenses.md), [movement migration](docs/movement-migration.md), [LINE rich-menu links](docs/rich-menu-links.md) and [stock adjustments](docs/shop-stock-adjustments.md).

## Local development

Use Node 24 (verified 24.22.1) and the repository's existing dependencies and yarn.lock. Run `npm run dev`, then open [localhost:3000](http://localhost:3000). Source is under `src/`; Next routes are in `src/app`. Use approved development configuration. Architecture verification uses isolated copies without application credentials; do not start live integrations or run operational setup as a check.

## Loyverse Configuration

Configure one or more Loyverse accounts in `.env`:

```dotenv
LOYVERSE_ACCOUNTS_JSON=[{"id":"main-shop","shopName":"Main Shop","accessToken":"...","storeId":"optional-store-id"}]
```

Each account requires a unique `id`, a display `shopName`, and an
`accessToken`. `storeId` is optional and can be used to restrict receipt
queries to one Loyverse store.

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
