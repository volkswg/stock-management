# Shop-level unit adjustments

Use **Monthly stock count → Stock adjustments → Record adjustment**. The feature
tracks total units for each configured stock-count/Loyverse shop, not SKU balances.
It is a direct owner entry form; there is no employee request or approval stage.

## Recording

1. Choose the count month, then the shop and transaction date within that month.
2. Choose Employee gift, Damaged items, Samples, Personal use, Employee return,
   or Stock correction. Gifts/damage/samples/personal use are stock out; employee
   returns are stock in. Corrections allow either direction.
3. Enter a positive whole-unit quantity. Employee is required for gifts and
   employee returns. Former employees can be used for dates within their employment.
4. Optionally add an item description, existing HTTPS photo/Google Drive link,
   and note. The photo field is a link; this version does not upload a new file.
5. Confirm the transaction is not already recorded in Loyverse, then save.
   If a zero-price giveaway/sale or refund already exists in Loyverse, use that
   source only; recording it here as well would double-count the stock change.

The history preserves shop and employee names, quantity, direction, reason,
transaction date, notes/photo link, references, creation timestamp and the
`web-owner` recorder label. It has shop, direction, reason and text filters.
Clickable Other stock out/Adjustments in figures filter and scroll to history.

## Calculation

Calculated stock = previous month's saved physical count + delivered movements
− net sold units (sales less refunds) − other stock out + adjustments in.

For NJ: opening 100 + delivered 20 − net sales 30 − employee gift 1 = 89.
YY is unaffected. Real employee returns add units. Adjustments only apply in the
transaction month. Next month starts from the actual saved physical count; the
same adjustment is not carried forward and subtracted again.

Saving/reversing an adjustment never edits physical counts, delivery quantities,
sales, salary advances/payroll or expenses. Unsaved physical-count and note drafts
are preserved when an adjustment refreshes the report. Saving one shop's physical
count also retains other shops' unsaved drafts.

Warnings identify missing previous counts (opening assumed zero), missing complete
sales sync dates through the selected month/today, negative calculated stock,
and adjustment history recorded after a physical count. Closed dates should be
synced as zero sales rather than assumed complete. Negative figures are flagged,
not silently clamped or blocked: incomplete inputs can cause them. The report is
a monthly calculated estimate, not guaranteed real-time on-hand stock.

## Corrections and reversals

There is no destructive edit/delete of posted history. Reverse opens a deliberate
confirmation naming shop, quantity and transaction date, with a required reason.
A single append-only counter-entry cancels the original in its original month.
Both entries remain in history, but reversed pairs do not inflate report in/out
totals. A reversal cannot itself be reversed; a new normal entry can be recorded.

Choose **Review a corrected replacement after reversing** to reverse first and
then inspect a prefilled replacement. The replacement has no effect until it is
saved. Cancelling this second form leaves the original reversed; use **Record
replacement** on its history row to resume. Replacement records link back to the
original, and an original can have only one replacement. Further corrections
reverse the replacement and create a new linked entry.

Historical reversals change the historical calculated stock/variance, not saved
physical measurements or later opening counts. Review physical variances separately.

## Storage and verification

`GOOGLE_SHEETS_STOCK_ADJUSTMENTS_WORKSHEET_NAME` optionally overrides the default
`stock_adjustments` worksheet. It is initialized on the first write, not ledger
reads. Existing unexpected headers are rejected, not replaced. Inputs use RAW
cell values to preserve dates/URLs and prevent notes being interpreted as formulas.
No new environment setting is required when the default name is suitable.

Saves use a client-generated UUID retained across retries. Identical copies with
one ID count once; conflicting payloads with the same ID fail closed. Reversals
use a deterministic original-linked ID and are retry-safe. Invalid reversal and
replacement references are rejected. Google Sheets does not offer cross-instance
transactions/unique constraints: use a single owner workflow rather than
concurrent edits to the same transaction, and never modify ledger rows manually.

Checks are kept in temporary scripts outside this repository. Financial service
and browser verification uses in-memory Sheets and intercepted application APIs;
production Sheets writes are not exercised just to verify this feature.
