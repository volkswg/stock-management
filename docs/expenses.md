# Independent expense module

## Menu and ownership

- `/expenses?month=YYYY-MM`: individual expense entries, scope/shop and category filters, totals, add/edit/delete.
- `/expenses/categories`: reusable category master, including activation/deactivation.
- `/expenses/shops`: independent shop master. Loyverse mapping is optional, unique per account, and only used for sales-profit attribution.
- `/api/expenses`: GET by month, POST create/update by ID, DELETE by ID (soft delete).
- `/api/expenses/masters/{categories|shops}`: GET/POST master records.

Expense operations do not read sales receipts or call Loyverse. Profit reporting consumes expense records and aggregates by accounting month and mapped account (or independent shop ID). Shared costs are deducted once at the month level. Inactive masters remain available for historical records and corrections, but not for new assignments. Changing a shop's Loyverse mapping changes its report attribution, including historical expenses.

## Responsive expense list

Entries are grouped alphabetically by shop, followed by shared expenses. Each group shows its filtered count and subtotal. Overall, shop, and shared totals use the same active filters.

Desktop rows align category, actual date, amount and actions in columns. At 700px and below, category/date stack under the name, management destinations move into the Manage menu, and Add expense stays pinned above the device safe area. Notes remain visible; unknown dates are explicitly unrecorded. Edit opens the existing form; Delete stays in the overflow menu with a separate confirmation and retryable errors. Master-data pages retain their card layout.

## Authoritative worksheets

`expenses` has these columns:

`id, month, expenseDate, shopId, scope, categoryId, name, amount, note, createdAt, updatedAt, createdBy, deletedAt`

`expense_categories`: `id, name, active, createdAt, updatedAt`

`shops`: `id, name, active, loyverseAccountId, createdAt, updatedAt`

The accounting month and actual expense date are separate. Actual dates may be blank when unknown; importing a historical record must not invent a date from its entry timestamp. Expense deletion sets `deletedAt`; financial reads exclude these rows. Creation requests accept an optional UUID requestId, used as the expense ID for safe identical retries.

Override worksheet names with `GOOGLE_SHEETS_EXPENSES_WORKSHEET_NAME`, `GOOGLE_SHEETS_EXPENSE_CATEGORIES_WORKSHEET_NAME`, and `GOOGLE_SHEETS_SHOPS_WORKSHEET_NAME`. Destination names must not collide with another configured worksheet.

## Storage setup

For a new installation, create the three authoritative worksheets above with their exact header rows before using expense management. The environment template lists their default names. Existing installations already use these tables; do not rerun a historical rebuild or recreate retired storage.

The shared connection check reads the three authoritative worksheets. It does not require any retired expense table. Profit reports consume only the independent expense service; item-cost overrides remain part of sales reporting.

Historical data has been rebuilt and the previous storage retired. Backups and retirement verification reports are retained privately outside the repository. No historical rebuild utility or obsolete mutation endpoint is shipped with the application.

## Verification

Use mock storage and intercept every `/api/**` browser request. Cover individual expense CRUD, multiple entries per shop/month, shops without Loyverse mappings, inactive master handling, category filters, scope conversions, cancellation and retries, and profit aggregation. Application verification must not write test fixtures to live worksheets.

For visual changes, include light/dark responsive geometry and widths beyond the 1400px content maximum. For storage or configuration changes, verify the independent expense API and profit deductions using mocked storage, then run TypeScript, targeted lint, and the production build.
