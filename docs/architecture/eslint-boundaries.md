# Boundary enforcement rollout

Phase 1 retains the current ESLint configuration. Global import bans would immediately fail existing service barrels, UI imports, route helpers, and config's legacy helper dependency. This document recommends staged enforcement without new dependencies now.

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
