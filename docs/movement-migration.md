# Movement creation migration

LINE movement creation is handled by `stock-management` at
`POST /api/line/webhook`. The `purchase-line-webhook` app retains its movement
list/detail pages and editing APIs, but no longer creates movements or holds
movement drafts in memory.

## Configuration and rollout

1. Configure stock-management with the same Google Sheets spreadsheet used by
   the legacy movement pages. Grant its Google credentials access to that
   spreadsheet and configure Google Drive uploads.
2. The movement tabs default to `movements` and `movement_details`. Override
   them with `GOOGLE_SHEETS_MOVEMENT_MASTER_WORKSHEET_NAME` and
   `GOOGLE_SHEETS_MOVEMENT_DETAIL_WORKSHEET_NAME` if the legacy app uses other names.
3. Set `MOVEMENT_PUBLIC_BASE_URL` to the public base URL of the app serving
   `/movements`. When omitted, summary links use the origin of
   `LINE_LEGACY_WEBHOOK_URL`. Without either setting, summaries are text-only.
4. Deploy stock-management and point the LINE channel webhook to its
   `/api/line/webhook` route before deploying the legacy handler removal.
   Keep `LINE_LEGACY_WEBHOOK_URL` configured for remaining purchase commands.
5. Complete any partially entered legacy items before switching. Only the old
   master and saved item rows can be recovered; shop/quantity values held solely
   in the old process's memory cannot be imported.

No live Google Sheet or LINE channel configuration is changed by these code edits.
On first use, the application ensures the movement tabs and the `user_state`
header exist. Existing movement columns stay in the same order, including
`stockCounted` in movement-detail column M.

## Persisted state

`user_state` keeps its existing columns A–G and adds `context` in column H.
Each user has one row with `flowname = MovementCreate`. Accepted transitions
update its current milestone and context instead of appending a history log.
The JSON context contains the master/item IDs, user ID, selected shop, quantity,
note, image URL, current step, and last processed LINE event ID. When the flow
reaches `complete`, the milestone remains in column E and context is cleared.
Starting the next movement reuses the same row. OrderCreate rows are left intact.

The steps are `shop`, `quantity`, `product_image`, `close_bag`, `bag_closed`, and
`complete`. An unfinished flow has no in-memory timeout. `resume:movement`
restores its exact checkpoint; if no active checkpoint exists, it can recover
the latest legacy `in_progress` master and its saved items.

The commands remain `create:movement`, `create:new-movement`, `resume:movement`,
NJ/YY shop selection, quantity text, image upload, `close bag`, `another shop`,
and `summary` / `movement summary`. Explicitly creating a new movement starts a
new active draft; earlier unfinished masters remain available for later resume.

Images upload to Drive before an item is written. A saved upload URL is reused
on retry, stable item IDs avoid duplicating an already saved item, and the last
event ID protects the current transition from an immediate redelivery. Sheet failures
return HTTP 503 rather than forwarding the message to the legacy purchase flow.
Enable LINE webhook redelivery for automatic retries; otherwise users can retry
their last action. Drive and Sheets are separate services, so a failure before
the upload URL checkpoint can still leave an orphaned Drive file. Sheets does
not provide a cross-request lock: simultaneous messages from the same user
should be avoided while an item is saving.

## Verification

In `stock-management`, run:

```bash
yarn build
```

In `purchase-line-webhook`, run `yarn build:server`, then `yarn build`.

For a manual integration check, start a movement, choose NJ, send a quantity,
restart stock-management, and send `resume:movement`. It should ask for the
product image and retain the quantity. Upload two items, close the bag, add a
YY item, then request the summary. Verify totals and the new rows in Sheets;
open the legacy detail page and check Packed, Stock counted, and Delivered.
Also verify a Drive failure leaves the draft waiting for an image and inserts
no item, and that normal order creation still works after the movement completes.
