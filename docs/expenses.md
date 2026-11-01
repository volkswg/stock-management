# Independent expense module

## Menu and ownership

- `/expenses?month=YYYY-MM`: individual expense entries, scope/shop and category filters, totals, add/edit/delete.
- `/expenses/categories`: reusable category master, including activation/deactivation.
- `/expenses/shops`: independent shop master. Loyverse mapping is optional, unique per account, and only used for sales-profit attribution.
- `/api/expenses`: GET by month, POST create/update by ID, DELETE by ID (soft delete).
- `/api/expenses/masters/{categories|shops}`: GET/POST master records.

Expense operations do not read sales receipts or call Loyverse. Profit reporting consumes expense records and aggregates by accounting month and mapped account (or independent shop ID). Shared costs are deducted once at the month level. Inactive masters remain available for historical records and corrections, but not for new assignments. Changing a shop's Loyverse mapping changes its report attribution, including historical expenses.

## Authoritative worksheets

`expenses` has these columns:

`id, month, expenseDate, shopId, scope, categoryId, name, amount, note, createdAt, updatedAt, createdBy, deletedAt`

`expense_categories`: `id, name, active, createdAt, updatedAt`

`shops`: `id, name, active, loyverseAccountId, createdAt, updatedAt`

The accounting month and actual expense date are separate. Actual dates may be blank when unknown; importing a historical record must not invent a date from its entry timestamp. Expense deletion sets `deletedAt`; financial reads exclude these rows. Creation requests accept an optional UUID requestId, used as the expense ID for safe identical retries.

Override worksheet names with `GOOGLE_SHEETS_EXPENSES_WORKSHEET_NAME`, `GOOGLE_SHEETS_EXPENSE_CATEGORIES_WORKSHEET_NAME`, and `GOOGLE_SHEETS_SHOPS_WORKSHEET_NAME`. Destination names must not collide with another configured worksheet.

## Rebuild existing data

Read-only preview:

```sh
node --env-file=.env src/scripts/migrate-expenses.cjs
```

Apply, with a private backup directory outside this repository:

```sh
node --env-file=.env src/scripts/migrate-expenses.cjs --apply --backup-dir /absolute/private/backup-directory
```

The rebuild reads `sales_profit_expenses`, validates every source row, and splits explicit shop-note breakdowns into individual rent/electricity/salary/etc. entries. Every split must exactly match its original total in cents. Shared records retain their names, categories, amounts, notes, and audit timestamps. No legacy columns or combined legacy-total category are added to the new schema. Original-to-rebuilt provenance is retained in the backup and deterministic entry IDs, not in additional expense fields.

All breakdowns are validated before any destination writes. The command saves a permission-restricted source backup, provisions only new tables with expected schemas, retains original audit timestamps, imports with deterministic IDs, then verifies every rebuilt row. Re-running an unchanged rebuild adds no duplicates. If an imported entry has subsequently changed or been deleted, reconciliation fails rather than resurrecting or overwriting it. Unknown nonempty schemas are never overwritten. The source worksheet remains unchanged and is never combined with the new table in reporting.

Rebuild from a stable source before deploying the new app. Changes in the old application after copying require reconciliation; the command does not overwrite edits to the new source of truth. The old sales expense mutation endpoint returns 409 rather than applying monthly-total updates over itemized data.

## Verification

Use mock storage and intercept every `/api/**` browser request. Cover malformed or mismatching source breakdowns, rerun safety, exact totals, multiple shop entries, CRUD, no-mapping shops, inactive master handling, category filters, scope conversions, cancellation and retries, profit aggregation, and light/dark responsive geometry including widths beyond the 1400px content maximum. Application verification must not write test fixtures to live worksheets.

## Retire the old worksheet

The runtime connection check uses `expenses`, `expense_categories`, and `shops`, not `sales_profit_expenses`. The old-sheet adapter is retained only for the one-time rebuild utility.

Before deleting the old worksheet:

1. Run the rebuild with a fresh external backup and require successful reconciliation. A retry with unchanged data should add zero rows.
2. Identify the actual stock-management production service. `PUBLIC_BASE_URL` can point to a separate LINE/purchase app; a successful HTTP response alone does not identify the correct deployment.
3. Deploy this code to the verified service. Confirm the real expense API returns the new schema and the category/shop masters work, and ensure older app instances are no longer writing monthly totals.
4. Repeat source/new-table reconciliation immediately before deletion. Preserve the source backup.
5. Delete only the configured old expense worksheet by its exact spreadsheet worksheet ID, never the entire spreadsheet or any of the three new worksheets. Verify that production expense and connection reads still work afterward.

After deletion, the old-sheet rebuild command is historical tooling; restore the worksheet from the backup before using it again. Do not silently recreate the old worksheet as part of runtime health checks.
