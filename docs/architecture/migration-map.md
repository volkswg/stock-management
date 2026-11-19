# Current ownership and retained compatibility

This map describes current source ownership; the external namespace retirement was merged in [PR40](https://github.com/volkswg/stock-management/pull/40). The prior Sales/Inventory, Orders/LINE, external transport and composition work is complete; all 65 files from `src/externals/` are retired. For the dated merge ledger and original evidence, see [progress](../refactoring/progress.md); for outstanding work, see the [roadmap](../refactoring/roadmap.md).

| Slice | Actual owner | Retained boundaries |
| --- | --- | --- |
| Orders | Public contracts/rules/UI; list/create/detail, mutations, attachments/images and filename rules in own application/domain; PostgreSQL/Drive adapters; named server | Detail receives its own Shipment projection port. LINE owns draft/session coordination. No Orders→Shipments/LINE module import |
| Shipments | Public status/contracts/UI, creation/read/link/status/bill applications/ports and own PostgreSQL/Drive adapters; server and HTTP validation helpers | Shipment→Orders uses public contracts and specifically registered gallery/projection port |
| Inventory | Contracts/quantity rules; counts/balances/reconciliation, adjustments/reversals/replacements and movements/journey primitives; own semantic adapters/server | Public HR directory and Sales dashboard readers are composed only at its server; LINE never imports Inventory persistence |
| Sales | Public report contracts, daily/dashboard/profit, sync/status/cost applications/ports, receipt IDs and named PostgreSQL projections/adapters/server | HR payroll and Inventory use the public dashboard reader; provider-native Loyverse projections stay with transport |
| Expenses | Pure Expense/Shop/Category/Input contracts, ledger/master application/ports/rules, PostgreSQL adapter/server | HR shop reader and Sales expense projection use public contracts/entrypoints |
| HR | Pure employee/compensation/attendance/payroll/advance/settlement contracts; financial/date rules, all workforce/financial applications/ports and own persistence/runtime/hash adapters | Named workforce/payroll servers receive explicit reader ports; no legacy implementation in core, no Payroll↔Advance cycle |
| LINE workflows | Public workflow contracts/commands, sessions/context validation, order/movement journeys/replies, sequential webhook orchestration; own session adapter/runtime/server | HTTP keeps raw parsing/auth/factories/status translation; application uses semantic Orders/Inventory operations and pure shared protocol/message helpers |
| Shared Google | Root OAuth/service-account auth, fixed integration-configuration reader and Drive upload factory | No business worksheet adapter or business storage fallback |
| Shared external | Root LINE/Loyverse client/protocol/factory files; original standalone LineRichMenuClient under root LINE transport | Old constructor names/signatures/error/retry behavior remain; scripts are opt-in and never run during verification |
| Composition | `composition/postgres/service.ts` wires the 23 explicit native tables; `hr-payroll`, `salary-advance-shops`, `employee-directory`, `orders` own compatibility wiring | May wire concrete feature adapters; feature cores never depend on composition. No DI container or alternative registry |
| Shared/runtime | Pure LINE DTO/enum/message builders and isRecord in shared; original stateful sortable ID generator in root infrastructure/runtime | No feature dependency; old helper names alias one implementation |
| Workspace/Next shell | Existing app-owned home/navigation/layout and routes | No Workspace redesign, auth/product work or unrelated UI migration |

## Native business storage owners

Each module owns `infrastructure/postgres/tables.ts`, an explicit named column/type
map, and the adapters implementing its existing semantic application ports.

| Feature | Physical tables |
| --- | --- |
| Orders | orders, order_items, order_bills |
| Shipments | shipments, shipment_orders |
| Inventory | movements, movement_details, stock_counts, stock_adjustments |
| Sales | sales_receipts, sales_receipt_items, sales_receipt_payments, sales_receipt_syncs, sales_profit_cost_overrides |
| Expenses | expenses, expense_categories, shops |
| HR | employees, employee_compensations, employee_timesheets, employee_advances, payroll_settlements |
| LINE | user_state |

Root `native-records.ts` provides shared SQL transport for these real 23 mappings.
It selects named fields and uses parameterized named writes, opaque ID/revision
handles, native timestamp helpers and media IDs. It has no feature registry,
worksheet headers, range parser, positional identity or older-schema fallback.
Compensation's private synthetic identity and seven append-only histories remain.
Application/domain ports retain their business DTOs and no SQL handles.
Composition alone aggregates tables; modules accept their own structural subsets.
Inventory/Orders public servers supply LINE's semantic workflow collaborators.

## Retired business compatibility and retained interfaces

The business Sheets aggregate, worksheet classes/headers, row/range helpers,
PostgresRecords bridge, positional order lookup and raw-row LINE facades are
retired from current source. Their old imports are audited with the pinned
pre-native [source witness](../../tests/fixtures/native-postgres-before.json),
not recreated as runtime forwards. Current HTTP routes and public DTO fields stay
the same. Existing service aliases to semantic module servers, rich-menu entrypoint
and sortable-ID identity remain where still meaningful. Undisclosed external
imports of the removed private deep paths need to migrate; this private package
has no public export map. The old [PR86 tree](https://github.com/volkswg/stock-management/tree/a1a27af691ebf67d9575476c43a4d9cc30b36470)
is the historical worksheet/header ownership index.

The three generic Google value/range types are retained only for the fixed private
configuration client. The integration reader can read its approved configuration
range; business APIs and LINE cannot select business Sheets storage.

## Retired external paths

Google auth/client/base/Drive imports now target root infrastructure; worksheet classes/headers target their feature owners; LINE DTOs/enums/messages target pure shared leaves; LINE/Loyverse clients target root external infrastructure; aggregate construction targets composition. No new mixed production barrel replaces the two removed Sheets indexes. `tests/fixtures/externals-retirement-before.json` records all removed sources, symbol destinations, import audit and exact source inverses. Earlier fixtures remain byte-identical; archived source is used only for original/history evidence, while current loaders and graphs use physical canonical files.

## Final graph and limitations

Runtime module edges: LINE workflows→Orders/Inventory, Inventory→HR/Sales, Shipments→Orders. Public erased contracts additionally permit HR→Expenses and Sales→Expenses. Cross-feature edges use only registered public leaves; allowed directions never authorize private infrastructure. Root transport/shared have no feature/composition dependency. Runtime/type file cycles and browser→server/provider reachability are forbidden.

Financial/stock formulas, quantities/coercion quirks, Bangkok dates, IDs, sorting, API routes, schemas, raw write modes, provider/auth configuration, retry/error phases and partial-write/concurrency limits are preserved. The exact route fixture remains 23 pages/35 APIs. Live permissions/delivery, production records, browser visuals and independent CI remain outside local evidence. See [verification](../refactoring/verification.md) and [deferred decisions](decisions.md#deferred-behavior-and-security-work).

## Private Loyverse account configuration

`infrastructure/configuration/google-sheets/loyverse-accounts.ts` owns the read-only `loyverse_accounts` schema/validation, outside the aggregate registry and `shops` schema. The tab resides in the existing GOOGLE_SHEETS_SPREADSHEET_ID workbook; there is no account-specific ID or alternate-workbook fallback. `composition/loyverse-accounts.ts` selects env/sheet sources and the effective workbook, reuses root Google service-account auth/client and supplies either pure `{id, shopName}` metadata or credential-free bound provider capabilities. `shared/types/loyverse-account.ts` is the erased public metadata DTO; credentials remain in server configuration/storage only. Sales sync accepts its existing structural ReceiptSource port, including existing concrete clients. Financial applications, worksheets and all historical account IDs remain unchanged.

All fourteen affected HTTP sources (Loyverse, Sales, Expenses masters, Inventory counts/adjustments and HR attendance) use the seam. The old synchronous transport factory remains compatible in env mode and explicitly rejects sheet mode, preventing silent misconfiguration. No root infrastructure→feature, feature→composition or private cross-feature edge is added. There is no credential endpoint/editor or second persistence path. [Owner migration and rollback instructions](../../README.md#loyverse-configuration) are canonical.

## Retired feature compatibility directory

The seven `src/features/backend/` forwards are removed. No business body moves: all other 414 production source/assets are byte-identical to main `2d2dc18a5c1112e9f6368599ad0d6d67defa79af` (merged PR43). The unused `@/feature/*` alias is removed; `@/*` continues targeting canonical source.

| Retired leaf under backend/ | Canonical owner / exports |
| --- | --- |
| line/enum/index.ts | line-workflows/contracts: MovementStartCommandEnum, EventKindEnum |
| line/services/reply.ts | line-workflows/server: replyText |
| line/services/movements/index.ts | line-workflows/server: handleMovementEvent; contracts: MovementImageUploadProgress |
| line/services/movements/utils.ts | inventory/quantity: parseQuantity, isValidMovementQuantity |
| line/utils/index.ts | line-workflows/server: isLineEvent, parseLineWebhookPayload, isMovementStartCommand, classifyLineEvent; LegacyMovementEventClassification and LegacyLineEventClassification retain the old local type names through import aliases |
| shared/utils.ts | shared/lib/is-record: isRecord |
| shipments/utils.ts | shipments/http: readJsonBody, isUpdatableStatus, isValidDeliveryFee, isValidPoNumber |

The audit covers runtime/erased/dynamic imports, mocks/loaders, scripts, aliases, docs and historical guards. There is no production importer or known external supported consumer of the removed leaves. The package is private with no export map/publish workflow; undisclosed external deep imports must migrate. Services and standalone script forwards remain supported and untouched.

`features-retirement-before.json` preserves all seven sources, 18 symbol destinations, pre-removal runtime identity keys, audited references and exact non-production inverses. Existing fixtures stay immutable. Current loaders use physical owners and reject removed paths; explicit historical readers alone resolve archived sources. No production compatibility directory or replacement barrel is introduced.


## PostgreSQL ownership

Business storage is PostgreSQL-only in current source. Feature adapters retain
existing calculations/coercions, microsecond timestamp text, numeric scale,
creation ordering, media URL DTOs, session IDs and lazy business projections.
Root transport retains target/TLS/role checks, transactional revision handling,
command/effect journals, upload reconciliation and per-event LINE idempotency.
No database function or schema is dropped by this application change. The retained
`typed_input_*`/`typed_project_*` functions remain historical/recovery dependencies;
current acceptance revokes runtime EXECUTE on them to prove they are unused.
`tools/migration` remains the historical import/operator/recovery owner. Do not
remove its protected evidence or rerun old imports on production.
