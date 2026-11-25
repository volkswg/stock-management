# Movements and LINE workflow

Business records use PostgreSQL; Drive remains the image provider. LINE enters
through `POST /api/line/webhook`; summary/detail pages use `/movements` and the
native `/api/movements` routes. Current release status is in the
[ledger](refactoring/progress.md#latest-production-release).

## Configuration and rollout

`MOVEMENT_PUBLIC_BASE_URL` controls summary links, falling back to `PUBLIC_BASE_URL`;
without either, summaries are text-only. Preserve the configured channel webhook,
raw-body signature verification, migration cutoff and private Drive credentials.
No runtime movement Sheet/tab/header setup exists. The old configuration and
row-verification procedure remains in the
[archived guide](https://github.com/volkswg/stock-management/blob/950d31e9ce3e89dd6b76d98762112e4a0787829c/docs/movement-migration.md).
Documentation does not authorize changing LINE, Vercel, credentials or data.

## Persisted state

`user_state` stores the active `MovementCreate` milestone and JSON context:
master/item/user IDs, selected shop identity/label, quantity, note, confirmed image,
step and last event ID. Accepted transitions update the checkpoint. Completion
clears that movement session through existing lifecycle handling; OrderCreate
sessions retain their separate behavior. Session IDs are bigint internally and
strings through business APIs; no worksheet columns/row position are identities.

Steps remain `shop`, `quantity`, `product_image`, `close_bag`, `bag_closed`,
`complete`. `resume:movement` restores a saved checkpoint or the latest recoverable
in-progress master/items. Commands, quantities, close-bag/another-shop/summary
behavior and deferred state remain. Explicit new movement creation does not
silently discard earlier resumable masters.

Images upload before an item is saved. Stable item/event/operation identity and
confirmed media are reused during reconciliation; failures/unknown commits must
not cause blind re-upload. Durable SQL journals do not make Drive atomic with the
database or guarantee exactly-once reply delivery. LINE redelivery is useful for
normal retries, but is not a loss-safe maintenance inbox. Use the
[operations guide](database-migration.md#maintenance-procedure) before pausing writers.

## Verification

Use [canonical verification](refactoring/verification.md) with synthetic data and
fake providers. An approved isolated integration check should cover movement
start, active-master selection, quantity/photo, process restart/resume, repeat
image/event reconciliation, bag close, another shop, summary and web Packed /
Stock counted / Delivered behavior. Also verify provider failure preserves a
resumable draft and ordinary Orders still work. No live write/provider canary or
separate legacy-app build is authorized by this guide.

### Photo upload counts

Movement photo replies now show confirmed image-bearing rows for the original
shop and the whole movement. These are saved-so-far counts from the existing
post-insert read, not a guarantee that every image in a concurrently delivered
LINE image set has finished. Concurrent replies may arrive out of order. No
additional Sheets reads or cross-request counters are introduced.

The webhook JSON includes `images` and `imageResults` on normal and movement-error
responses. `images.received` counts image events in this HTTP payload;
`routedToMovement`, `otherFlows`, `unprocessed` and `failedBeforeRouting` explain
routing. Upload/save outcomes have movement-only scope:

- `uploaded`: new Drive uploads confirmed in this request.
- `saved`: new detail appends confirmed in this request.
- `alreadySaved`: existing records reused; never counted as a new upload/save.
- `completed`: movement image handlers finished, including their reply.
- `failed`, `ignored`: processing failures and images not accepted in the current step.
- `saveUncertain`: an append was attempted without a confirmed response; the row
  may already exist. Retrying checks the stable item ID before uploading again.

A confirmed append remains counted as saved even if master synchronization or a
later reply fails and the webhook returns HTTP 503. `imageResults` includes each
routed movement image's message ID, stage flags and, after successful master sync,
confirmed shop/movement photo totals. Counts describe this HTTP request, not all
requests comprising a LINE image set. Order-flow uploads are not counted as
movement uploads. The HTTP JSON is not itself displayed by LINE; the chat text
is sent through the existing reply flow.


## Shop-master destination IDs

The released PR104 replaces the fixed NJ/YY destination list with active, non-deleted
Shop master records. LINE shows names and sends a movement-bound postback carrying
`shops.id`; a choice from another movement is rejected. Lists paginate within LINE's
quick-reply limits. Existing quantities, images, remarks, Home origin, delivery,
image reconciliation and durable retry keys retain their behavior.

`movement_details.shopId` is a nullable text FK with `ON DELETE RESTRICT` and an
index. `shopName` and `toLocation` remain saved display labels. Web details group
by ID, including records saved under different names; old name-based detail links
still resolve. List responses retain `shopQuantities` and add `shopIdQuantities`
and `unlinkedShopQuantities` when linked items are present. Item responses add
`shopId` only when populated.

New choices require an active, non-deleted master. Previously selected inactive
shops may finish their existing pending workflow; deleted/unavailable destinations
stop before a new provider upload. Inactive/deleted masters remain available for
historical stock/account attribution. Old sessions gain an ID only after an
unambiguous match to the master name or a retained, explicitly backfilled historical
label. Ambiguous sessions keep their pending quantity and confirmed upload URL and
ask for an explicit destination choice. Existing NJ/YY text buttons still work
when that unique mapping exists; there is no guessed or fixed fallback destination.

Monthly stock-in follows `shopId` through the master's Loyverse mapping. Linked
records never fall back to their display name if the mapping is missing; the
report warns that totals may be incomplete. Only unlinked legacy rows retain the
former name lookup, without double counting linked rows.

The schema and explicit historical/session backfill are complete. Do not rerun
them. A later reconciliation/change needs its own approval and supervised packet;
see [maintenance](database-migration.md#maintenance-procedure).
