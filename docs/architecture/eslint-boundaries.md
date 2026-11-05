# Boundary enforcement rollout

Phase 1 retains the current ESLint configuration. Global import bans would immediately fail existing service barrels, UI imports, route helpers, and config's legacy helper dependency. This document recommends staged enforcement without new dependencies now.

PR 2 now enables scoped rules via `eslint/orders-boundaries.mjs`, imported by the root flat config. The contract leaf, current Orders UI/client files and three Shipments consumers of OrderStatus are covered. Rules include relative and alias imports, type imports/re-exports, Node builtins and dynamic bypasses. Actual ESLint positive/negative fixture tests run in `npm test`; a separate resolved project-runtime graph test checks transitive Orders imports. The exact pure `services/shipments/types.ts` bridge and remaining type-only shipment-client debt have ownership/removal criteria in [Orders contracts](orders-contracts.md). No other legacy areas were placed under new global errors. The recommendations below remain the later rollout plan.

PR 3 retargets the browser override to all `src/modules/orders/ui/**/*.{ts,tsx}` files without removing any existing prohibition. It adds bans on retired frontend imports and app imports, except the exact existing browser shipment client until PR 5. Positive/negative ESLint fixtures cover all relocated TS/TSX paths; runtime graph tests enforce the same server/app exceptions transitively. A separate resolved graph test includes type-only edges when detecting cycles. Structural tests reject old source files/references and preserve component/style baselines. These checks supplement, rather than replace, future repository-wide tooling.

PR 4 adds `eslint/orders-server-boundaries.mjs` with narrow allowed imports for the actual application/port files, feature Sheets adapters and named server composition. Application permits only Orders contracts/ports and prohibits globals for credentials, fetch, Node buffers and direct clocks. Adapters/server prohibit config/credential access, framework/UI imports and dynamic bypasses; the aggregate Sheets module can be imported only as types. Required `server-only` guards are asserted by tests. Positive/negative fixtures exercise the real flat config. Existing UI restrictions retain their exact protections, sharing only the unchanged static-import selectors. No repository-wide legacy exemption is added.

1. Start with ESLint's existing `no-restricted-imports` in flat-config overrides covering only actual new/migrated files. Use **error** for domain imports of React/Next/Node IO/config/infrastructure; shared imports of modules/app/legacy business code; UI imports of config/infrastructure/server entrypoints; application imports of concrete infrastructure. Include named package paths, subpaths, re-exports and type imports. Do not exempt type imports from ownership rules.
2. Resolve relative-path bypasses before calling enforcement complete. Core patterns are useful for canonical aliases and named packages, but do not understand resolved project architecture, arbitrary relatives, transitive imports, or cycles. Review relative imports manually initially; once enough modules exist, evaluate `eslint-plugin-boundaries` for resolved layer/module ownership and explicit public entrypoints. Add a dependency only in a scoped tooling PR with demonstrated invalid/valid fixture cases.
3. Ratchet migrated slices to errors. Maintain a small explicit legacy allowlist with owner, reason, and removal PR; never ignore the whole repository or permit new violations indefinitely. Avoid setting a global zero-warning budget against an unmeasured legacy baseline.
4. Use a resolved dependency graph checker for cycles (for example dependency-cruiser) when real modules exist. Include type-only imports and aliases. Core `no-restricted-imports` and Next's lint rules do not detect cycles or prove browser safety. Do not add both tools preemptively.

Example override for a future domain slice (illustrative, deliberately not enabled yet):

```js
{
  files: ["src/modules/orders/domain/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": ["error", {
      patterns: [{
        group: ["react", "react/**", "react-dom", "react-dom/**", "next", "next/**",
          "server-only", "node:*", "@/app/**", "@/config", "@/config/**",
          "@/infrastructure/**", "@/externals/**", "@/services/**", "@/features/**"],
        message: "Domain imports must stay pure; use domain models or consumer-owned ports."
      }]
    }]
  }
}
```

This fragment is only a first layer: it does not enforce same-module application/UI imports or unprefixed Node modules such as `fs`; a complete rule set must also prohibit those and resolve relative paths. Test the actual flat config with valid/invalid fixtures before enabling each slice. Use separate `contracts.ts` and `server.ts` public files, `import type` where appropriate, and server-only guards as complementary checks. Do not make an architecture claim based solely on a passing lint run.

## PR 5 Shipment contracts slice

`eslint/shipments-boundaries.mjs` adds browser restrictions to the five existing Shipment UI/client/formatter files, including the literal `[id]` path. It rejects mixed services (including type imports and the legacy leaf), relative server paths, config, providers, application/infrastructure/server implementations, API handlers, Node builtins, known provider packages and process/Buffer access. Dynamic import, require, import-equals and type-import-expression bypasses remain prohibited. The public contract permits only explicit named forwarding of the exact pure legacy types leaf and no IO/broad exports; that leaf permits only Orders contracts. The physical exception has the removal criteria in [Shipment contracts](shipments-contracts.md).

Positive/negative tests run the actual flat configuration for every protected file and both contract paths; a resolved transitive graph checks browser safety and cycles both with and without type-only edges. Existing Orders lint rule files remain byte-identical and the Orders legacy enum/client exceptions persist until dedicated decoupling. Core ESLint is scoped direct-import enforcement, not a general resolved cycle detector; graph tests supply that check for this slice. No new plugin/dependency or global legacy exemption is added.

## Shipment UI relocation follow-up

The module UI override now covers `src/modules/shipments/ui/**/*.{ts,tsx}`; obsolete app presentation scopes are retired. All server/provider/Node/type-only/dynamic prohibitions remain. App imports are forbidden except the canonical `@/app/shipments/api` in the two list/detail screens. The retained app client has its own strict rule: only erased imports from Shipment contracts, no forwarding re-exports or implementation imports. It is not a new compatibility shim. Orders rules change only the three relocated Shipment consumer scope strings; existing browser restrictions/legacy allowlists remain intact.

Positive/negative tests cover every relocated TS/TSX file, a future glob path, relative bypasses and the exact retained client. Transitive runtime/type-only file graphs permit only the exact app client and pure enum leaf and reject server implementations/cycles. Ownership tests collapse intermediate app/legacy paths, enforce the runtime Shipments → Orders direction, record the one inherited type-only reverse trace, and demonstrate that the proposed forwarded module client would add a forbidden runtime cycle. That client move remains blocked, without weakening rules or allowing the proposed runtime cycle. See [the scoped decision](shipments-ui-relocation.md).

## Orders-owned picker dependency seam

Orders module UI no longer has the legacy enum-leaf or app-client exceptions. Scoped bans now reject all app, legacy service and Shipment module imports, including relative/type/re-export and dynamic bypasses, plus Node/provider packages. The picker port allows only Orders contracts and no IO globals. The app client composition scope allows exactly Orders detail/port, the retained Shipment browser client and public Shipment enum; no server/config/provider/Node or direct fetch is permitted. Shipment UI and retained-client rules are unchanged.

Positive/negative tests protect the exact composition/port surfaces and old import pattern as a regression. Runtime and type-only Orders graphs reach no app/Shipment/server code; composition's graph is independently checked through both modules and the actual client. Ownership follows intermediaries and now permits only Shipments → Orders in both modes, with no inherited reverse exception. A test reintroduces the old Orders import and forwarded client virtually to expose the prohibited cycle. Another virtual-only test demonstrates the browser client-relocation prerequisite is satisfied after injection; it does not implement or globally allow the future move. Original no-dynamic-bypass selectors remain unchanged; old whole-file lint snapshots are replaced by these surgical/behavioral checks for intentionally strengthened rules.

## PR 8 browser-client relocation completed

Both Shipment screen app-import exceptions are removed entirely. The normal `modules/shipments/ui/**/*.{ts,tsx}` rule covers list/detail and the moved client, prohibiting all app imports. Its exact `modules/shipments/ui/api.ts` rule permits only the original erased public-contract import and browser fetch, with no unapproved type imports, server/provider/Node/config/environment access, dynamic/require bypasses or forwarding exports. Orders app composition's exact whitelist replaces the retired app-client path with `@/modules/shipments/ui/api`; Orders feature UI still rejects every Shipment/app dependency.

Actual positive/negative fixtures cover all relocated TS/TSX files, fetch responsibility, old app imports and relative/type/re-export bypasses. Resolved Shipment and app-composition graphs remove the old app client allowance; module UI graphs permit no app implementation at runtime or in erased edges. The only legacy browser exception is the pure enum leaf behind Shipment contracts. The former virtual relocation case now checks the real one-way runtime/type ownership graph; the negative direct Orders-import/forwarding scenario remains a regression check, without shipping a shim. Scope is strict direct-import ESLint plus transitive project graph tests, not a claim to audit third-party internals or migrate all legacy server code.

## PR 9 Shipment creation seam

`eslint/shipments-server-boundaries.mjs` is registered alongside unchanged browser and Orders rules. The application/port scope permits only its own public contract and writer port, with no direct Date/random/env/fetch/Node/provider/framework/infrastructure IO. The adapter scope permits only server-only, its business types/port, the existing pure Sheets interface type and explicit original range/header constants. Server composition permits only its exact application/adapter/contracts/interface and original ID utility. Interface imports must be erased; broad/forwarding exports, arbitrary dependencies and dynamic/type-import/require bypasses are rejected. The actual adapter/server retain required server-only guards.

Positive/negative fixtures run the real flat config against alias/relative/type/re-export/dynamic paths. New runtime/type-only creation graphs remain file-acyclic and closed to the exact seam and pure leaf/constants/interface, with Node crypto reachable only from the original server ID utility. The existing one-way browser ownership/server-isolation checks remain unchanged. Direct Sheets interface types avoid traversing a mixed provider aggregate. No new blanket legacy allowlist, plugin/dependency or browser exception is added. [Full scope and historical evidence](shipments-create-seam.md).
