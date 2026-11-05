# Shipment shipping-bill workflow seam (PR 13)

Base: `c1f5678b88b162856f7754b889bf4667c22fccf1`, verified latest main and merged PR 12 squash commit, with a clean starting tree and no intervening commits. Branch: `refactor/shipments-drive-seam`. Only shipping-bill upload/status coordination/cleanup ownership changes; the full Shipments milestone remains incomplete.

## Caller and exact production inventory

The only caller is PATCH `app/api/shipments/[id]/route.ts`. Existing GET, request parsing/validation, constants, HTTP mappings and top-level error logging remain owned by that route. The completed status use case is reused through the same legacy status import and an injected callback, not rewritten.

| File | Responsibility |
| --- | --- |
| `modules/shipments/application/advance-shipment-status-with-bill.ts` (new) | Conditional upload, one injected status invocation, ID tracking, cleanup decisions and internal completion result |
| `modules/shipments/application/ports/shipment-bill-storage.ts` (new) | ShipmentBillStorage, ShipmentBillUploadResult, UploadedShipmentBill; business metadata only |
| `modules/shipments/infrastructure/google-drive/shipment-bill-storage.ts` (new) | Server-only GoogleDriveShipmentBillStorage, lazy existing provider factory, original filename/Buffer upload and best-effort cleanup helpers |
| `modules/shipments/server.ts` | One named `advanceShipmentStatusWithBill` composition; all five prior function declarations/bodies unchanged |
| `app/api/shipments/[id]/route.ts` | Minimal orchestration delegation; original configuration/Sheets construction, validation, GET, parsing and response translation retained |

No other production files change. GoogleDriveService/factory/auth/transport, all Sheets classes/adapters, legacy services/barrel, public contracts/enum, browser/UI/CSS/Orders picker/projection, other feature modules, packages/lockfiles/env/schema/data remain byte-identical. No generic upload framework, repository, domain layer, DI container, queue or new provider is introduced.

## Business port and server composition

`ShipmentBillStorage.upload(): Promise<ShipmentBillUploadResult>` returns either `{ outcome: "unavailable" }` or `{ outcome: "uploaded", file: UploadedShipmentBill }`. Metadata exposes only `id` and `webViewLink`. The adapter returns the original provider object inside this wrapper without reading/copying/normalizing its properties. The wrapper distinguishes unavailable Drive from a malformed undefined upload result, which still fails at original metadata access rather than becoming 503.

`cleanup(fileId: string | undefined): Promise<void>` delegates the original best-effort helper. Application never sees File, Buffer, Google interfaces/config/auth/tokens, Sheets rows/ranges, HTTP responses/codes, framework/Node IO or tenant fields. It receives the existing UpdateShipmentStatusResult through a type-only import and an injected `(shippingBillUrl) => Promise<UpdateShipmentStatusResult>` callback.

Server composition privately receives the validated File, route-trimmed ID, lazy Drive factory and updater callback. It conditionally constructs one adapter without evaluating provider/file/clock operations. No bill means no adapter upload and no Drive factory call. The existing factory itself remains in app composition, after getConfig and Sheets construction. The module never constructs configuration or Google auth.

The internal result discriminates drive_unavailable versus completed, keeping the original five-case public status union unchanged. Completed results retain the exact original status result object. A narrow `cleanupAfterFailure()` callback retains application-owned tracked-ID state for errors after orchestration returns. This is needed because the original HTTP catch cleaned up even if result getters or JSON serialization threw after a successful status write. Route catch calls this callback before its unchanged main error log. Nonupdated cleanup clears the ID first, so a later translation failure does not delete twice. The callback and internal result are never serialized or exposed to browser contracts. It adds no retry/transaction/rollback guarantees.

## Original versus new event order

Both implementations preserve:

1. Original params/body/transport validation before configuration.
2. `getConfig()` then `createGoogleSheetsServiceFromConfig(config)`.
3. With a nonempty validated Shipping bill only: invoke the existing Drive factory.
4. Unavailable Drive returns the original 503 with no filename/bytes/upload/status/cleanup operation.
5. Available Drive: original filename, content type, arrayBuffer/Buffer construction, then await uploadImage.
6. Read and assign returned ID, then read webViewLink, without normalizing either.
7. Invoke the original status operation once with original input key order and raw URL.
8. For nonupdated outcomes, await cleanup then clear the ID; for exceptions, await cleanup then rethrow the original error to HTTP catch.
9. Translate the same HTTP result; successful updates retain uploaded files unless subsequent response construction throws, preserving that existing catch path too.

The updater callback deliberately reads `body.status` after upload, at the original phase. A TypeScript-only `as ShipmentStatus` assertion retains the already-validated type across the callback; caching it earlier would change getter/error timing. No runtime coercion or validation is added.

The two moved helpers, createShippingBillFileName and cleanUpUploadedFile, retain exact original full declaration AST hashes. Filename uses the same sanitization, extension selection and single Date.now call after Drive availability. Upload arguments keep fileName → contentType → `Buffer.from(await shippingBill.arrayBuffer())` evaluation, original Buffer payload and original provider method binding. Byte/Buffer failures prevent upload and status calls. ID getter failure leaves no assigned ID; URL getter failure cleans an already assigned truthy ID. Empty/falsy IDs skip deletion; missing/unusual URLs flow unchanged into the status use case.

Cleanup is still best-effort: one awaited delete when service/ID are truthy, no retry, catch/log failures with `Failed to clean up shipment bill upload`, fileId and original Error/string conversion. Nonupdated outcomes retain original 4xx response even on deletion failure; unexpected errors retain original 500 and `Failed to update shipment status` logging. No cleanup after an upload rejection before an ID is returned. Provider-internal cleanup on permission failure remains inside the unchanged provider; orchestration adds no duplicate deletion.

## HTTP, status and provider compatibility

Route GET, readShipmentUpdateBody, isValidShippingBill, accepted MIME Set, inclusive 10 MiB limit and runtime=nodejs remain unchanged declarations. JSON/multipart detection/parsing, malformed/empty files, Shipping-only validation, ignored non-Shipping file data and early validation without factories remain intact. HTTP remains 200 updated, 404 not_found, 409 invalid_transition, 400 invalid_delivery_fee/invalid_po_number, 503 unavailable Drive and 500 unexpected error, with exact original messages/wrappers.

PR 12 status implementation/port/adapter/facade are byte-identical: Delivered fee precheck, M1-before-A2:M, first-active lookup, transition/PO/clock/nullability/URL-clearing/raw-field/B:M rules and failure identity remain unchanged. No extra Sheets operation, retry or cross-provider transaction. Uploaded files may require deletion after partial Sheets writes; a failed cleanup or a failure before metadata ID assignment can still leave an orphan. A response error can still delete a bill after its URL was persisted. These original limitations are preserved, not fixed.

GoogleDriveService, config/auth selection and transports are untouched. Real provider tests use fake auth/fetch to verify exact multipart/related CRLF body, metadata parent, boundary clock, headers/content length/URL/query, token order, permission request, encoded delete/health calls, returned object identity, network errors and provider-internal cleanup/logging. No real Google request or credential is used.

## Historical evidence and verification

`tests/fixtures/shipments-drive-before.json` captures verified base, complete original route/raw hash, PATCH/GET/parser/validator/filename/cleanup declarations/hashes, constants/imports/exports/runtime, synthetic JSON/multipart/factory/upload/Sheets/error/cleanup traces, responses/logs and all five original server declarations. Ten new characterization tests passed against the untouched original source before extraction.

Exactly one preserved raw-route key receives reviewed history handling: `src/app/api/shipments/[id]/route.ts`. Its original expected hash remains authoritative in the byte-identical shipments-structure.json and is verified against saved source; all other preservation-loop entries remain strict. GET/parser/validator hashes, constants and complete pre-try validation ASTs remain exact. Both moved helpers retain original full declaration hashes. PATCH orchestration uses executable old/new matrices, including getter/error order and response-serialization cleanup. Previous PR 9–12 history helpers/fixtures remain active and unchanged. The original route-contract fixture is not regenerated.

Added tests include ten characterization, eight application/composition/old-new parity, four real provider and four boundary tests: 26 added, 317 total with all 291 inherited retained. Compile-time assertions preserve metadata/port signatures, injected status result and internal completion shape. The closed loader adds only three new exact seam files; it shares synthetic logger globals so moved cleanup logs remain captured, and never enables real provider/config/auth evaluation.

Scoped lint permits only the bill port and erased existing status result in application, no imports in its port, and server-only/erased Drive interfaces/own port in adapter. Adapter alone permits original File/Buffer/Date responsibilities; no provider construction/config/HTTP client imports. Type-reference restrictions also reject global File/Buffer/Request/Response in application/port, beyond ordinary value-reference bans. Earlier creation/read/link/status and browser scopes remain unchanged. Server graph adds only three seam files and pure Drive/auth type leaves, remains runtime/type-acyclic and provider-implementation-free. Browser ownership remains only Shipments → Orders, with no server/application/provider reachability.

[Verification](verification.md) records baseline/final npm test/lint/typecheck, clean credential-free builds and identical app-paths manifests. All 23 page/35 API source route contracts remain unchanged. Baseline lint has one inherited unused-import warning in shipments-read-seam.test.mjs; it is retained outside this scope, with no new warnings/errors. A new boundary test exposed an initially missing global type-only File restriction; the exact new scopes were strengthened and the final suite passes.

Remaining work: Orders server detail Shipment projection, physical enum ownership, legacy barrel/facade/utility retirement, independent Orders image workflows and separately reviewed persistence/SaaS/concurrency changes. Full Shipments milestone remains incomplete. No Supabase/auth/tenancy/billing, production data, operational scripts, approval, merge or deployment. Offline tests do not prove live Google permissions/availability, concurrency safety or real-browser visuals.
