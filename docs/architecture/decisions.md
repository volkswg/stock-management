# Architecture decisions and compatibility invariants

These are current behavior constraints, not a new implementation/release approval.
Use [rules](rules.md) for dependencies, [ownership](migration-map.md) for modules,
[operations](../database-migration.md) for live gates and [progress](../refactoring/progress.md)
for evidence. Exact prior declaration/error/payload witnesses remain in immutable
tests and the [archived decisions](https://github.com/volkswg/stock-management/blob/950d31e9ce3e89dd6b76d98762112e4a0787829c/docs/architecture/decisions.md).
Historical Sheets ranges, header writes and intermediate forwards are not current
PostgreSQL instructions.

## Consumer ownership and composition

Define the smallest port beside its application/UI consumer. Expose business
records/operations, not cells, ranges, positions, tokens, configuration, File/Buffer,
SDK/HTTP objects or tenancy assumptions. Infrastructure implements ports; guarded
composition injects them. Preserve lazy inspection, provider evaluation, error
precedence, clock/ID calls, awaits and pending-work behavior when moving code.
Do not silently add validation, retries, caching or cross-provider guarantees.

## Public contracts and single enum identity

Keep routes/methods, metadata, query parameters, HTTP status/error wrappers, DTO
field types/order/nullability and named consumer contracts stable unless explicitly
changed. Shipment status has one canonical enum in `modules/shipments/status.ts`:
Draft=`draft`, ReadyToShip=`ready_to_ship`, Shipping=`shipping`, Delivered=`delivered`,
Canceled=`canceled`. Orders uses its own Shipment projection contract, not a
dependency on Shipment internals. No broad browser/server barrel or duplicate enum.

Current responses may intentionally omit fields retired in approved releases;
immutable command replies keep their original fields. Old price/remark replies
may omit seller; the browser preserves its current seller. An intentional seller
edit still requires a valid saved seller string. Do not rewrite replay snapshots.

## Orders detail and Shipment projection

Orders owns its reader and projection port. Shipment implements the projection;
composition injects it. Detail selection uses stable order/link/shipment IDs and
the newest active link. A blank newest link is not a reason to fall back to an
older link; a non-null shipmentId can coexist with shipment:null if that referenced
record is unavailable. Keep full mapping/filtering/error precedence, product/bill
image ordering, quantities, product codes and total/fee nullability. PR100 fixed
the native shipment lookup: record IDs must never be treated as row offsets.

Order item snapshots remain independent of Product Master. Linking or editing a
product must not rewrite historical item code, quantity, price, media or order data.
The catalogue supports explicit duplicate review and link/create decisions, not
automatic historical backfill or stock aggregation.

## Shipment validation, costs and uploads

Keep the existing Draft→ReadyToShip→Shipping→Delivered transition rules; reject
repeated/backward/unknown transitions. Delivered fees accept finite 0 through
1,000,000,000 inclusive. Shipping requires a nonblank trimmed PO with the existing
original-input length bound. Preserve existing validation order and errors.
Omitting a shipping bill on the relevant update retains the established clear/
keep semantics; do not change them as a refactor.

Shipment linking distinguishes missing shipment/order, same-link idempotence,
another-shipment conflict and link eligibility. Link creation returns 201 and a
confirmed existing link 200; absence 404, conflict 409. Existing error classes and
HTTP translations remain authoritative in source/fixtures.

Cost allocation retains finite/comma-number parsing, null propagation and existing
floating-point/rounding quirks. Unknown quantity/price is not zero by default;
do not introduce decimal rounding, clamping or changed percentage behavior.

Uploads keep MIME/size checks, lazy provider construction, filename rules and
upload-before-business-reference ordering. Best-effort cleanup preserves the
original failure; a cleanup error must not invent success or hide uncertainty.
Confirmed Drive effects and PostgreSQL commits are separate outcomes.

## PostgreSQL records, identity and lifecycle

Named typed columns are authoritative. Feature-owned explicit maps feed semantic
ports; Products uses its explicit SQL adapter. No cells, worksheet ranges or row
ordinals belong in business storage. Bigint identity values remain strings at API
boundaries, including beyond JavaScript safe integer precision. Sequence gaps are
valid; manual explicit IDs do not automatically advance sequences.

Preserve feature-specific sorting, `createdAt` ordering, NULL/unknown-time placement
and established ID tie-breaks. Native timestamp formatting/comparison retains
microseconds without inventing historical dates. Business calendar dates/months
retain Bangkok semantics. `deletedAt` is the soft-delete marker; shared guards
protect identity, archived rows and revisions. They do not stamp every updatedAt.

Media references join `media.sourceUrl` for existing API URL fields. Known Drive
file identity is unique; unknown metadata stays unknown. Preserve FK/identity and
referenced-media deletion protection, including archived references. Registering a
URL does not prove availability; no database cleanup deletes a remote image.

## Transactions, row revisions and idempotency

Every database operation needs an explicit unit of work. Reads remain READ ONLY;
nested reads cannot upgrade to mutations. Transaction-local role/timeouts and
advisory locks cannot become session state under transaction pooling. Commit the
business writes, command identity and serialized response together; handled
failures roll back. The runtime cannot rewrite completed command journals.

The global revision remains change/recovery metadata. Edit preconditions protect
the intended row: movement-item edits do not inherit movement-master/child scopes,
and unrelated order/movement edits must not conflict just because the global
revision changed. Same-row stale edits still conflict. Keep feature-specific
aggregate/financial revision contracts and direct-write invalidation intact.

One intentional mutation has one stable key and exact intent. Identical retries
replay the stored response; changed input conflicts. Preserve double-click
suppression, pending identity/body/revision across reloads and deliberate
reconciliation of unknown saves/uploads. Ambiguous COMMIT is never blindly retried.
Do not substitute business-field uniqueness for operation identity.

## LINE events and provider uncertainty

Verify signatures against the exact raw body before processing. Preserve the
migration cutoff, per-webhookEventId actor/intent binding, event-savepoint behavior,
session transitions, replies and independently retried events within a batch.
Redelivery/reply-token differences do not create a new business operation.

Reply attempts occur after commit and use durable attempt records. Sending/uncertain
replies are not automatically reposted: avoiding duplicates can lose a reply after
a crash. Drive effects are also outside SQL atomicity. Preserve known/uncertain
upload handling and stable IDs; operators reconcile uncertain effects. LINE retries
or a WAF block are not proof of loss-safe event retention during maintenance.

Movement destinations use shop-master IDs with historical labels for display.
Resolve saved legacy choices only when unambiguous; preserve pending quantity and
confirmed media on ambiguity. New selections require available active masters.
Existing inactive choices and historical stock attribution retain their rules.

## Financial and stock behavior

Receipt payments live in a JSONB array, preserving split tender, source order,
refunds and existing report coercion/precision. Items remain separate. Never
rebuild arrays from the stale retired operational payment table; the migration
archive is retained. Provider payload/pagination/overlap checks are not weakened
just because unused stored fields were removed.

HR/Expenses/Inventory retain existing payroll, advance, compensation, attendance,
expense allocation, reversal and monthly reconciliation rules. Preserve missing/
inactive master attribution, accounting month versus actual date, unknown dates,
saved physical counts and append-only financial history. Loyverse account identity
still exists in several consumers; `shops.id` is not a completed system-wide tenant
or inventory-location conversion.

## Deferred behavior and security work

No staff login, secure-session/RBAC/shop-permission implementation is authorized by
the storage migration or docs cleanup. The owner's `legacy-as-is` policy preserves
existing behavior, not a security certification. Keep API restrictions, staging
bearer boundaries, LINE signature/cutoff, verified TLS and least-privilege grants.
Private database connectivity is not end-user authorization. New authentication,
backup automation, queues/provider replacement and stronger reconciliation or
cross-provider atomicity require separately reviewed scope.
