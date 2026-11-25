# Shop-level unit adjustments

Business records use PostgreSQL. Use the [operations guide](database-migration.md)
for storage, recovery and approved maintenance. There is no optional runtime
Google Sheets backend; the [original setup notes](https://github.com/volkswg/stock-management/blob/950d31e9ce3e89dd6b76d98762112e4a0787829c/docs/shop-stock-adjustments.md) remain in Git.

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

`stock_adjustments` is an append-only PostgreSQL business ledger. The shop/account
identity in this flow remains account-based; the LINE destination migration does
not convert it to a product/location balance system. Do not edit posted ledger
rows directly; use the reviewed reversal/replacement workflow.

Saves preserve client-generated UUID request identity across retries. Identical
replays reuse the confirmed outcome; conflicting input fails closed. Reversals use
their original-linked identity; invalid reversal/replacement references are rejected.
Current transaction, revision and command guards remain active. Do not remove
them or infer that database storage makes external provider effects atomic.

Run [canonical checks](refactoring/verification.md) using fake ports/intercepted
APIs and fresh disposable SQL targets where needed. Cover totals, month boundaries,
employment eligibility, reversal/replacement links, response loss and pending drafts.
Do not write fixtures to production or reinitialize historical Sheets.
