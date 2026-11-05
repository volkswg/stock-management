# Shipment creation seam (PR 9)

Base main: `7900bc93c8de47cf435fa14b07a76eb8710b9348`, confirmed as merged PR 8 with no intervening commits or unrelated pending changes. Branch: `refactor/shipments-create-seam`. Only `createShipment` is extracted. The full Shipments milestone remains incomplete.

## Caller and ownership audit

The only production caller of this server operation is `app/api/shipments/route.ts` POST, importing the unchanged `services/shipments` barrel. The separate browser `createShipmentMaster` functions are HTTP callers, not server use cases. Source/test references, direct and barrel exports, list/link/status implementations, API handlers, worksheet class/constants, Sheets interfaces and the original sortable ID utility were inspected before extraction. The Orders creation seam supplies the composition/port/adapter pattern.

| File | Responsibility / public exports |
| --- | --- |
| `modules/shipments/application/create-shipment.ts` | `createShipment(input, dependencies): Promise<Shipment>`, `CreateShipmentInput`, `CreateShipmentDependencies`; PO normalization/validation, clock/ID calls, original business record and await-before-return |
| `modules/shipments/application/ports/created-shipment-writer.ts` | Consumer-owned `CreatedShipmentWriter.appendCreatedShipment(shipment: Shipment): Promise<void>`; no worksheet/provider representation |
| `modules/shipments/infrastructure/google-sheets/shipment-writer.ts` | Server-only `GoogleSheetsShipmentWriter`; stores `Pick<IGoogleSheetsService, "shipments">` without property access, maps and appends one original row |
| `modules/shipments/server.ts` | Server-only named `createShipment` only; preserves original public parameters and return, composes the adapter with the supplied service and original clock/ID utility |
| `services/shipments/createShipment.ts` | Exactly `export { createShipment } from "@/modules/shipments/server";` |
| `services/shipments/index.ts` | Byte-identical legacy barrel; its original creation export reaches the same composed function |

No domain directory, generic repository, DI container, additional provider or broad server barrel is created. The application imports only Shipment public contracts and its port. The port accepts the existing business DTO, never ranges, rows, auth/SDK/config or write-mode options. The adapter/server import the existing interface directly from `externals/google/sheet/types.ts`, avoiding a provider aggregate in their type graph. Range/header values come from their explicit existing modules. The original `services/utils/createSortableId.ts` remains a temporary server composition dependency with unchanged module state, clock and randomness semantics.

## Exact behavior and ordering

Inputs remain `poNumber: string`, `carrier?: string`, `createdBy: string`; server composition additionally accepts the existing `IGoogleSheetsService`. Application dependencies are `writer`, `now(): string`, `createId(): string`.

Sequence remains:

1. Call `poNumber.trim()` and reject empty input with `Error("Shipment PO number is required.")`.
2. Read the injected clock once.
3. Invoke the original ID generator once, after the clock.
4. Construct the original Shipment object in original field order, including `carrier?.trim() || ""`, normalized PO, Draft status, null fee, empty remark/timestamps/deletion/bill fields, the same clock value for createdAt/updatedAt, and untouched createdBy.
5. Await one append before returning that same business object.

No carrier/PO maximum length or extra business validation is added; HTTP validation remains unchanged at the route. Nullish/empty/whitespace carrier behavior, whitespace actor preservation and empty actors remain as before. Invalid PO causes no clock, ID, worksheet getter, read or write. Composition allocates a lazy writer before validation without accessing the supplied object's properties; a throwing `shipments` getter confirms that boundary. Clock/ID/carrier errors and append failures propagate unchanged with no retry, compensation, rollback, transaction or false success.

Production composition supplies `now: () => new Date().toISOString()` and the exact existing `createSortableId` function. Its own clock/random/sequence behavior is not replaced. Deterministic test controls are confined to application inputs and the closed offline source loader.

## Existing Sheets mapping

Exactly one `shipments.appendRows` call uses the original expression `A:${lastColumnLetter(SHIPMENTS_SHEET_HEADERS.length - 1)}`, evaluating to A:M with the unchanged thirteen headers:

| Column | Business record value |
| --- | --- |
| A | id |
| B | status |
| C | carrier |
| D | poNumber |
| E | shippingFee (null on creation) |
| F | remark |
| G | shippedAt |
| H | deliveredAt |
| I | createdAt |
| J | updatedAt |
| K | deletedAt |
| L | createdBy |
| M | shippingBillUrl |

No extra reads, schema writes, normalization or provider construction occur. Existing ShipmentsSheet → BaseGoogleSheet → GoogleSheetsClient transport remains unchanged. An offline test executes that actual path with fake auth/fetch and verifies one HTTP append with USER_ENTERED, INSERT_ROWS, original values and A:M. No live provider is reached.

## Historical evidence, tests and boundaries

All 188 inherited tests and baseline checks pass. Eleven added characterization tests pass against the original legacy function before implementation (199 total). `tests/fixtures/shipments-create-before.json` preserves its full original source, raw/function hashes, original parameter/return type text and synthetic input/result/key-order/range/row examples. Those expected values are not regenerated after extraction. The same legacy entrypoint tests run afterward through the actual use case, adapter and composition.

The older `shipments-structure.json` remains byte-identical, including both intentionally migrated declarations: `createShipment` and `getShipmentsAppendRange`. Only those two exact keys receive explicit migration handling. The test verifies each historical hash against the saved original source and requires the exact compatibility re-export. Separate AST checks compare original/new PO normalization and validation, every business-object field (only injected ID call renamed), the thirteen append values/order and the original header-derived range expression. Every other existing function/body/contract/client/route/CSS fingerprint assertion stays active. This is not a blanket Shipment-service skip.

New tests execute fake business ports, fake worksheet operations and real composition/compatibility exports, covering pending success/failure with deferred writes, exact clock/ID/getter order, constructor laziness, one write/no retries, enum/direct/barrel identity and USER_ENTERED transport. Type assertions preserve the old public signature/return, narrow application inputs and business-record writer port. Existing POST 201/400/500 and all other HTTP/service tests remain unchanged.

The offline loader extends its existing closed graph only with the four exact creation files and explicit pure header/range constants, plus a harmless `server-only` marker. Date and the original ID import are deterministic in tests. Config, auth, Drive, transport implementations and arbitrary new application files are rejected. The one transport-path test loads only named existing classes with explicit fake auth/fetch; it never uses the closed service loader to evaluate providers.

`eslint/shipments-server-boundaries.mjs` adds scoped application/port, adapter and server restrictions without changing existing Orders or Shipment browser rules. Application permits only its own contract/port and rejects Date/env/fetch/Node/provider/framework/infrastructure IO and random generation. Adapter/server allow exact documented imports, require erased interface imports, reject broad/forwarding exports and dynamic/type-import bypasses. Server-only markers are checked explicitly and by the Next production build. Actual positive/negative fixtures exercise aliases, relative imports, re-exports, type-only and dynamic paths.

Runtime/type-only creation file graphs are acyclic and closed to the exact seam, pure contracts/constants/interface and original server ID utility. The only other business module reachable is Orders' self-contained contract through the existing pure Shipment type leaf; there is no reverse module edge. Existing browser graph/ownership checks remain one-way Shipments → Orders and reach no server entrypoint, application or adapter. This does not claim all unrelated legacy server code has migrated.

## Remaining work and limits

List/detail reads and mapping, cost calculations, linking/errors/A:G appends, status validation/M1-before-A2:M/B:M operations, Drive upload/cleanup and existing failure/partial-write semantics stay in their original implementations. All APIs/pages/wrappers, UI/CSS/browser client/Orders picker, contracts/enum definitions, provider classes, headers/modes, env/package/lockfile and data remain untouched. The legacy barrel and direct facade remain until their real server consumers migrate in a later scoped task. Remaining Shipment use cases/adapters, Orders server detail projection and enum physical ownership cleanup are future work.

[Verification](verification.md) records final commands/counts and route manifests. Fake ports/transport/source graphs do not establish real Google permissions, availability or concurrency guarantees; synthetic component tests do not prove real-browser visuals. No live Sheets, Drive, LINE, Loyverse, production credentials/data, operational scripts, deployment, approval or merge were used. No Supabase/auth/tenancy/billing or schema changes are included.
