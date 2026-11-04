# Orders UI migration (PR 3)

## Pre-move audit

Verified `main` at the requested `d10d530a2052cfc10bdb71708af267ccd8db91bb`; GitHub reports PR 2 merged into that commit. Its tree matches the locally tested PR 2 tree. The dedicated branch is `refactor/orders-ui`.

References were searched across `src`, tests, and ESLint before relocating code. Consumers outside the moved feature files are:

| Consumer kept in place | Existing dependency | Required correction |
| --- | --- | --- |
| `src/app/orders/page.tsx` | Legacy frontend `OrderListPage` | Import module UI list |
| `src/app/orders/loading.tsx` | Legacy frontend `orders.module.css` | Import module UI styles |
| `src/app/orders/create/page.tsx` | Co-located `OrderCreatePage` | Import module UI create page |
| `src/app/orders/[id]/page.tsx` | Co-located `OrderDetailPage` | Import module UI detail page |
| `src/app/shipments/ShipmentListPage.tsx` | Legacy `OrderImageGallery` | Import module UI gallery only |
| `src/app/shipments/ShipmentMobileCard.tsx` | Legacy `OrderImageGallery` | Import module UI gallery only |
| `src/app/shipments/[id]/ShipmentDetailPage.tsx` | Legacy `OrderImageGallery` | Import module UI gallery only |
| `tests/orders-contracts.test.mjs`, new UI characterization | Legacy browser API / quantity UI / feature files | Update load paths without changing expected fixtures |
| `tests/orders-boundaries.test.mjs`, `eslint/orders-boundaries.mjs` | Legacy browser roots / scopes | Protect new module paths and retire old paths |

No server, LINE, Loyverse, Google Drive or Sheets implementation imports the browser client or these UI components. The Orders list and product-image upload component import the old browser client internally; create/detail use its relative path. Detail also imports four legacy frontend components. All of those imports must follow the moved implementation; no compatibility copy of a browser file is needed.

The remaining outward dependency is the documented pure shipment enum bridge plus the existing browser shipment HTTP client at `src/app/shipments/api.ts`. These remain until PR 5. Shipments continues to consume the Orders gallery through its explicit UI file; no broad barrel is introduced. Contracts remain unchanged.

## Characterization before relocation

The 32 existing tests pass on the base. Additional synthetic component-descriptor tests execute the original component functions, hook callbacks/effect cleanup, and browser request functions before moves. They cover list filtering/pagination/mobile rows/expanded state, loading/error/retry, creation field settings and required-image messages, file acceptance/size edges, navigation, detail cancellation/retry, product drafts/save payloads, shipment selection/create/linking, and gallery preview/keyboard/modal behavior. PR 2 tests continue covering multipart requests, HTTP error/invalid response handling, enums and API DTOs.

These tests do not run React DOM or Ant Design's actual validator/layout. No browser automation tool was available in this session; visual equivalence, focus/layout and real file dialogs are not asserted. CSS byte comparisons and source/runtime fingerprints supplement the callback tests without claiming browser verification. See [verification](verification.md) for final results.

## Implemented structure and guarantees

All 15 destinations in [the migration map](migration-map.md#pr-3-implemented-ui-relocation) are implemented. The four Orders route wrappers remain in their original locations. The three Shipments consumers now import `@/modules/orders/ui/OrderImageGallery`; nothing else in Shipments is refactored. All obsolete UI implementations are removed, with no forwarding wrappers or duplicate files. `contracts.ts` is byte-identical to the merged PR 2 version.

The browser flow remains `Orders UI → modules/orders/ui/api.ts → existing /api/orders/** handlers → existing services → existing Sheets/Drive integrations`. No route, HTTP method/response wrapper, metadata, hook/state/JSX, format calculation, style content, external integration, schema or environment name changes. File paths and import specifiers are the only production source changes.

Before moves, 41 tests pass (32 inherited plus 9 new characterization tests). After moves, all 44 pass, including added move-body/CSS/consumer fingerprints and a type/value cycle check. Lint, typecheck and credential-free build pass, and the Next app-paths manifest is unchanged. Test paths follow the relocated code; existing expected route and contract fixtures are preserved. See [the full command/results report](verification.md#pr-3--orders-ui-restructuring).

Remaining legacy dependencies are limited to the explicitly retained shipment picker bridges (PR 5) and unmigrated server/LINE compatibility exports (PR 4/10). No unused domain/application/infrastructure directory or new dependency was added. Observable behavior is preserved by unchanged component/client bodies and the characterization checks; real-browser visual and live-integration verification remain the limitations above.
