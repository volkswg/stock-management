# Shipment HTTP boundary migration (PR 18)

Base: `37005935dcbfd0e32f50d7a84543ddfcdcee13dc`, verified exact latest main and merged PR17 commit; initial tree clean, no intervening commits. Branch: `refactor/shipments-http-boundary`. Node 24.22.1 and existing dependencies. Main is reverified before editing and publication; advancement is a stop condition.

## Exact production inventory

| File | Import/export change only |
| --- | --- |
| `app/api/shipments/route.ts` | createShipment/listShipments from module server; ShipmentStatus from module contracts |
| `app/api/shipments/[id]/route.ts` | getShipmentDetail/updateShipmentStatus from module server; ShipmentStatus from module contracts; existing bill-workflow import retained exactly |
| `app/api/shipments/[id]/orders/route.ts` | linkOrderToShipment/LinkOrderToShipmentError from module server |
| `modules/shipments/server.ts` | Existing application import gains its existing error-class binding; one local named export exposes the same class |

The error remains physically defined once in application/link-order-to-shipment.ts. Reusing its already-present application import plus local named export keeps the existing no-source-forwarding server lint restriction unchanged. No new class/wrapper, broad barrel, boundary exception or additional dependency. All handler/helper bodies, constants, runtime=nodejs, six server function declarations, HTTP methods/routes/validation/trim/logging/status/response/error behavior and every other production file remain byte-identical. Bill configuration/upload/status/cleanup, Sheets ranges/order/modes, nullability/clock/IDs, providers and browser code are untouched.

## Public identity and dependency direction

The five legacy server operations retain strict direct/barrel/module-server identity. New server LinkOrderToShipmentError === original application class === legacy direct class === legacy barrel class, so all four domain codes still satisfy the route instanceof check and original 404/409 translation. Only one new server runtime key is added; six existing operations remain. The single ShipmentStatus is identical through physical/public/legacy leaf/barrel paths; browser contracts still expose only that enum and eight erased DTOs.

Routes now compose through the explicit guarded server surface plus browser-safe public contracts, never the mixed legacy barrel or private applications. Resolved route imports, full feature runtime/type DAGs and browser ownership remain valid: Shipments → Orders only, no reverse feature edge, no browser legacy/server/provider reachability. No ESLint config changes or loader permission expansion.

## Historical source authority

New immutable tests/fixtures/shipments-http-before.json captures all four complete base sources/raw hashes, function declaration hashes, original class/application witness, exact planned import/named-export transformations and 13 original synthetic HTTP/event scenarios. Three characterization tests pass on untouched handlers before editing. Reversing only the exact recorded transformations reconstructs every original source byte-for-byte; all handlers/helpers/constants and six server functions retain their original AST hashes.

| Original source | Retained SHA-256 |
| --- | --- |
| `src/app/api/shipments/route.ts` | `b84c0b222cc8cd9f146d6f718538bd993a9940e5b3e0cf4e583d94e002751526` |
| `src/app/api/shipments/[id]/route.ts` | `24ffbc46d8e57546480310aaeff5829223279db6c97dbc932c0f8112beab5d90` |
| `src/app/api/shipments/[id]/orders/route.ts` | `f870e3cc529c911a35eb7bfb1a0ef146ad49072096e0b647a83122fd9b04d610` |
| `src/modules/shipments/server.ts` | `6722466f6ef1cde53fbe61388dbd62d8bf71b50376c3d2ec3d735cd017e9663b` |

The exact collection/link route raw keys in contract/browser preservation loops gain this check. Detail's older pre-PR13 witness and moved Drive helper checks remain active; its post-PR17 raw source is additionally restored by the new check. PR15/16 source inventories recognize exactly these four files, retaining their original expected hashes and the earlier named PR17 helper exception. PR17 validation-history preserved route hashes likewise use exact restoration. No old fixture/hash is regenerated or broadly excluded. The create-seam server-key assertion adds only LinkOrderToShipmentError.

## Offline wiring and regression evidence

The shared closed shipment helper adds only the exact public-contract binding and mirrors existing synthetic operation overrides at the new module-server binding. The existing Drive route harness receives the same minimal binding change so historical and current PATCH paths run identical injected outcomes/getter failures. No new file/path permission, provider/config evaluation, duplicate enum or replacement implementation. A new three-route historical/current harness executes real use cases with fake Sheets/Drive/factories and captured logs/events.

Three pre-edit HTTP tests cover collection filters/create/errors, detail/JSON status/multipart success/cleanup/503/partial failure, and new/idempotent linking plus all four domain error mappings. The same tests compare actual current and saved-original handlers against original outputs/event traces afterward. Two added post-edit tests enforce complete source/function restoration, exact imports/export identities, resolved route/server/feature/browser graphs and unchanged real lint scopes. New compile-time checks retain class/function compatibility. Total: 370 inherited + 5 new = 375 passing tests. [Command/build verification](verification.md).

All inherited HTTP/Sheets/Drive/browser/Orders projection coverage remains enabled. It preserves 200/201/400/404/409/500/503, all validation/error texts, list parameters, A:M creation/A:G links/M1-before-A2:M/B:M status writes, USER_ENTERED/INSERT_ROWS, timestamps/ID ordering, Drive permission/upload/retention/cleanup/logging/partial failures and no added retry. Only directly affected source/hash/export/helper wiring assertions change.

## Remaining legacy scope and limits

TS-resolved production audit finds no consumers of the Shipment mixed barrel, including relative aliases. The only incoming Shipment legacy-file edges are the unchanged barrel's five internal named forwards to its leaf facades/types. Legacy direct paths/barrel and their exports remain available for regression/type/external compatibility; retirement requires separate authorization and caller/export audit. Broader Orders facades/utilities, persistence/providers, SaaS/auth/tenancy/billing and concurrency/retry work remain separate. This does not complete the full Shipments milestone.

Checks are Codex-local, not independent GitHub/Vercel CI. No live Google/LINE/Loyverse, credentials/records, operational scripts, approval/merge/deploy or real-browser/concurrency verification. Synthetic tests preserve observable behavior without establishing live provider permissions/availability or stronger transactional guarantees.
