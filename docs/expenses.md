# Independent expense module

Expense storage is PostgreSQL. Use the [operations guide](database-migration.md)
for identity, recovery and approved maintenance; no runtime Sheets backend remains.

## Menu and ownership

- `/expenses?month=YYYY-MM`: individual expense entries, scope/shop and category filters, totals, add/edit/delete.
- `/expenses/categories`: reusable category master, including activation/deactivation.
- `/expenses/shops`: independent shop master. Loyverse mapping is optional and unique per account. The master also supplies LINE movement destinations and report attribution; several other flows remain account-based.
- `/api/expenses`: GET by month, POST create/update by ID, DELETE by ID (soft delete).
- `/api/expenses/masters/{categories|shops}`: GET/POST master records.

Expense operations do not read sales receipts or call Loyverse. Profit reporting consumes expense records and aggregates by accounting month and mapped account (or independent shop ID). Shared costs are deducted once at the month level. Inactive masters remain available for historical records and corrections, but not for new assignments. Changing a shop's Loyverse mapping changes its report attribution, including historical expenses.

## Responsive expense list

Entries are grouped alphabetically by shop, followed by shared expenses. Each group shows its filtered count and subtotal. Overall, shop, and shared totals use the same active filters.

Desktop rows align category, actual date, amount and actions in columns. At 700px and below, category/date stack under the name, management destinations move into the Manage menu, and Add expense stays pinned above the device safe area. Notes remain visible; unknown dates are explicitly unrecorded. Edit opens the existing form; Delete stays in the overflow menu with a separate confirmation and retryable errors. Master-data pages retain their card layout.

## Authoritative storage

Expenses owns `stock_operational.expenses`, `expense_categories` and `shops` through
its named PostgreSQL maps. The accounting month and actual expense date remain
separate; unknown dates stay unknown. Soft deletion sets `deletedAt`, and financial
reads exclude deleted expenses. Creation preserves the existing request identity
and exact retry behavior. Categories/shops keep their active/history rules.

No worksheet names/header setup or Google connection check is required. Old
column/setup instructions and previous rebuild evidence remain in the
[archived guide](https://github.com/volkswg/stock-management/blob/950d31e9ce3e89dd6b76d98762112e4a0787829c/docs/expenses.md).
Do not recreate retired storage or rerun a rebuild. Private recovery/retirement
reports remain outside Git. Profit consumes the independent expense projection;
item-cost overrides stay with Sales.

## Verification

Use mock storage and intercept every `/api/**` browser request. Cover individual expense CRUD, multiple entries per shop/month, shops without Loyverse mappings, inactive master handling, category filters, scope conversions, cancellation and retries, and profit aggregation. Application verification must not write test fixtures to production.

For visual changes, include light/dark responsive geometry and widths beyond the 1400px content maximum. For storage or configuration changes, verify the independent expense API and profit deductions using synthetic storage, then run TypeScript, targeted lint, and the production build.
