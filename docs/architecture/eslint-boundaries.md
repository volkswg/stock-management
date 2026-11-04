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
