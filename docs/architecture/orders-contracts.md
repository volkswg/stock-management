# Orders browser contracts (PR 2)

`src/modules/orders/contracts.ts` is the implemented public browser-safe leaf. It has no imports, re-exports, IO, configuration, worksheet schemas, Node types, or server entrypoints. It exports only:

- Runtime enums: `OrderStatus`, `OrderItemQuantityType`, retaining all original names/string values and member ordering.
- Read DTOs: `OrderListItem`, `OrderDetail`, `OrderProductImage`, `OrderBillImage`.
- Create/update DTOs used by the existing browser API client: `CreatedOrder`, `OrderProductUpdate`, `UpdatedOrderProduct`, `ReplacedOrderProductImage`.
- `OrderShipment`, an Orders-owned projection of the existing nested shipment response. All fields, nullability and status wire strings match the existing shipment model. It does not import Shipments or add a new JSON wrapper. Compile-time checks compare its fields and status strings with the legacy shipment model to detect drift.

Consumers are the existing Orders pages/components/API client, the three Shipments UI files that display/filter order statuses, and the legacy order service implementations. Legacy direct exports and `services/orders/index.ts` remain compatibility surfaces for untouched server/LINE callers; the enum wrappers reference the same enum objects rather than defining duplicates. Remove a compatibility export only when its remaining server/LINE consumers migrate in later Orders seams or PR 10. The initial PR 4 seam deliberately retains both wrappers. Do not use those wrappers for new browser code.

Order list/detail services still perform the same reads/mapping; writes, status transitions, IDs, error handling and image behavior remain in place. Draft storage models, workflow enums, server outcomes and image buffers were not extracted. PR 3 moves the unchanged browser fetch functions/HTTP wrappers to `modules/orders/ui/api.ts` along with the feature UI. Contracts remain byte-identical to PR 2. No API handler, URL, style contents, JSX, calculation, or integration implementation was changed.

## Temporary bridge and legacy debt

The order detail shipment picker needs `ShipmentStatus` at runtime. Its mixed service-barrel import now points directly to `services/shipments/types.ts`, a pure DTO/enum file. That file's type-only OrderStatus import now points to Orders contracts, removing the dependency on the draft writer. This is an explicit temporary public bridge for Orders detail only; a Shipments-owned browser-safe contract will replace it in PR 5. Do not add other legacy service exceptions.

The existing browser shipment HTTP client remains outside this migration. It still has type-only dependencies on the mixed shipment service barrel. They are erased from the runtime graph and are tracked for PR 5; this PR does not claim that the entire application's type graph conforms. The Orders runtime graph is checked transitively through this client and reaches only the pure shipment types bridge, not server implementations. No Orders contract depends on Shipments, so the bridge introduces no reverse module edge or cycle.

## Enforcement and verification

`eslint/orders-boundaries.mjs` configures the actual flat ESLint rules. Orders contracts cannot import/re-export dependencies or use process/Buffer/fetch. All relocated `modules/orders/ui/**/*.{ts,tsx}` files cannot import services (except the exact bridge), config, external clients, infrastructure, application implementations, Node builtins, or known server-only Next entrypoints. App imports are prohibited except the existing `app/shipments/api.ts` browser bridge until PR 5; retired frontend imports are prohibited. Relative paths and aliases are covered; dynamic imports, require, import-equals, and type-import expressions cannot bypass the rule. Next `page.tsx`/layout/loading server entrypoints remain outside these browser restrictions and can perform server composition. The graph starts from module browser files, not server route wrappers. Shipments' existing scoped Orders restrictions remain; its own legacy dependencies are not placed under new global errors.

Tests exercise valid and invalid imports through the real ESLint configuration, resolve the Orders project's runtime import graph transitively, assert no cycles/server paths there, preserve DTO declaration shapes captured from main, check enum export identity and compile-time legacy compatibility, compare list/detail output with synthetic baseline fixtures, exercise price-dependent create statuses/IDs, quantity UI states, browser API errors/encoding/multipart behavior, and detail HTTP 200/400/404/500 shapes. The graph test excludes type-only edges and third-party package internals; it does not replace a future repository-wide ownership/cycle tool.

Base: `e77ddc1ce2b73a19e218a5d20353c5b04e23ff16`. Baseline: 10 tests, lint, typecheck, and credential-free build pass. Final verification is recorded in [verification.md](verification.md). Real providers and production data are never used by these tests.

PR 3 relocation details, all pre-move consumers, callback-test limitations and final paths are recorded in [Orders UI migration](orders-ui-migration.md). The original contract fixtures and enum identity expectations are unchanged; only test source paths follow the moved API/quantity UI.

PR 4 adds a separate server-only entrypoint for list/simple creation and consumer-owned application ports; it does not modify this contract leaf or UI. Legacy read/create exports remain compatible and detail stays legacy. See [Orders use-case seam](orders-use-case-seam.md) for the narrow implemented scope, shared mapping reuse and remaining compatibility criteria. The new server entrypoint must never be imported into browser code.
