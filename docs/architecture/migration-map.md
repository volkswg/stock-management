# Current ownership and retained compatibility

This map describes current source ownership. Dated releases are indexed in
[progress](../refactoring/progress.md); proposed work is in the [roadmap](../refactoring/roadmap.md).
Detailed dependency rules and exact lint allowlists live in [rules](rules.md).

## Native business storage owners

| Module | Business tables / responsibility |
| --- | --- |
| Orders | `orders`, `order_items`, `order_bills`; reads/mutations, attachments and item-to-product links |
| Products | `products`; catalogue search/create/edit/archive and reference media |
| Shipments | `shipments`, `shipment_orders`; linking, status, cost and bill projection |
| Inventory | `movements`, `movement_details`, `stock_counts`, `stock_adjustments`; movement/count/reversal calculations |
| Sales | `sales_receipts` with payments JSONB, `sales_receipt_items`, `sales_receipt_syncs`, `sales_profit_cost_overrides`; sync/reports/profit |
| Expenses | `expenses`, `expense_categories`, `shops`; ledger and shared shop directory |
| HR | `employees`, `employee_compensations`, `employee_timesheets`, `employee_advances`, `payroll_settlements`; workforce and financial workflows |
| LINE | `user_state`; order/movement sessions, event orchestration and replies |

The shared aggregate binds 22 feature-owned `NativeRecords` maps. Products uses
its separate explicit SQL adapter, bringing the business-table total to 23.
Root `infrastructure/persistence/postgres` owns pooled SQL, transactions, opaque
ID/revision handles and journals; it has no feature registry. Composition aggregates
feature bindings. Ports expose business DTOs/operations, not SQL or row positions.
Compensation's private synthetic identity and append-only histories are intentional.

### Scoped reads

Sales report ports supply date/year/account scopes to their PostgreSQL reader;
receipt items are selected through matching receipt parents. Financial calculations,
refund signs and payment-array projection remain in the existing report use cases.
Movement lists retain the existing Bangkok date filter and fetch details only for
matching masters. Movement edits and LINE reads select their parent/user/flow before projection;
opaque row identities, revisions and session ordering remain unchanged.

Orders supports opt-in `page`/`pageSize` reads with the existing search/status/link
filters. The feature adapter counts and clamps page IDs in one SQL statement,
then loads only that page's records and children. Search uses narrow candidate
fields on the server to preserve JavaScript Unicode matching rather than relying
on database-locale lowercasing. Unpaged API consumers retain their original shape.
The browser keeps top/bottom controls, URL page-size persistence, and debounces
search while rejecting stale responses. SQL stays in infrastructure; public
Orders contracts contain only semantic query/result DTOs.

`NativeRecords.select` reuses the existing explicit projection, ordering and
tracked revisions with feature-owned, closed predicates and bound values. The
root text helper preserves the ECMAScript trim set. Exact lint scopes permit only
the named Orders/Sales transport imports; no schema, permission or pool change is
required. Source presence does not mean this optimization is deployed.

## Composition and public boundaries

| Consumer / owner | Contract |
| --- | --- |
| Orders detail → Shipment projection | Orders owns its projection port/DTO; Shipment implements it; composition injects it. Orders does not import Shipment persistence. |
| Shipments → Orders | Only the registered public projection/gallery/contracts are permitted. |
| Orders → Products | Public catalogue contracts/server/browser operations; item-link logic stays in Orders. Products never imports Orders. |
| Inventory → HR/Sales | Public directory/dashboard readers are composed at the server; calculations receive semantic ports. |
| HR → Expenses; Sales → Expenses | Public shop/expense contracts and named readers only. |
| LINE → Orders/Inventory | Semantic workflow collaborators and pure protocol helpers; no feature SQL or tokens in LINE core. |
| LINE/Inventory → Expenses shop reader | Exact `readMovementShopDirectory` server edges; inactive/deleted masters remain readable for historical attribution. |
| Workspace/Next | App-owned navigation, layout and route composition; `/products` renders Products-owned UI. |

Runtime feature edges remain LINE→Orders/Inventory, Inventory→HR/Sales,
Shipments→Orders and the named Products/Expenses integrations above. Erased imports
are still dependencies. No module imports app/composition, no generic transport
imports feature code, and no browser graph reaches server/provider/credential code.

## Private integration configuration

`infrastructure/configuration/postgres/loyverse-accounts.ts` owns private account
SQL. `composition/loyverse-accounts.ts` selects explicit PostgreSQL/env sources and
exposes metadata or bound provider capabilities. Metadata queries do not select
tokens. There is no automatic storage fallback or public credential editor.
Runtime configuration is outside `shops` and the business aggregate.

Google OAuth/service-account helpers remain for Drive, not Sheets business reads.
Root LINE/Loyverse transport retains provider protocols/factories and the opt-in
rich-menu script. Source cleanup does not authorize a real provider invocation.

## Products and movement shop IDs

Product Master is released, not a pending UAT-only feature. Products owns
`contracts.ts`, `browser.ts`, `server.ts`, catalogue ports/adapters and UI. Orders
owns the item-specific link endpoint/modal, original item snapshots and quantities.
`composition/order-products.ts` joins those public surfaces. UAT tools remain
isolated verification tools; their staging migration is not production installation.

Movement details use `shops.id` as destination identity, with saved names retained
as labels. LINE choices carry movement-bound IDs; saved sessions and old text
buttons retain guarded historical resolution. Inventory resolves the master's
Loyverse mapping for account-based reports. Other account-ID consumers have not
all migrated. See the [movement guide](../movement-migration.md#shop-master-destination-ids).

## Retained compatibility

- Pending browser commands, revision negotiation and old cached response fields
  protect reloads/retries. An uncertain outcome is reconciled, not recreated.
- Current order submission uses JSON image references, but the server multipart
  path and byte fingerprints remain for older requests. Upload journals/recovery
  are active production behavior despite staging-labelled helper names.
- Bigint identity APIs still return strings. Text-layout support remains for
  reviewed rollback; strict layout and stale-handle checks must not be relaxed.
- LINE session resumption, old visible choices and unlinked historical destination
  resolution have live callers. Linked rows do not guess missing account mappings.
- `receiptPaymentRows` adapts receipt JSONB for existing reporting ports and split
  payments. The legacy operational payment table has no current repository.
- Timestamp comparison keys and historical unpaid salary transitions retain their
  existing behavior. Retirement needs its own evidence and approval.

## Retired paths and protected history

`src/externals`, `src/features`, `src/services`, business Sheets clients/worksheets,
positional record bridges, unused LINE server wrappers and the synchronous
Loyverse factory are retired. Use canonical modules; do not recreate forwards.
New expense/movement responses use canonical fields, while stored command replies
remain exact snapshots. No runtime Sheets fallback is supported.

`business_cells`, `row_order`, sidecar kinds/lexemes, duplicate URL columns,
`archived_at`, the unused purchase-detail reference and the operational payment
ledger were retired through separate approved releases. Retained import tables,
SQL mappings/operator inverses and test fixtures remain recovery/history assets.
Native acceptance runs current source separately from hash-bound predecessor copies.

For exact former symbol destinations, paths and worksheet/column inventories use
the [immutable prior ownership map](https://github.com/volkswg/stock-management/blob/950d31e9ce3e89dd6b76d98762112e4a0787829c/docs/architecture/migration-map.md)
and [historical document index](../refactoring/progress.md#historical-document-index).
Those old descriptions do not establish a current runtime dependency or authorize
archive, function or schema removal.
