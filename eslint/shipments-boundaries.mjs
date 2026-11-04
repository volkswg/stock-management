import { builtinModules } from "node:module";
import { noDynamicServerBypass } from "./orders-boundaries.mjs";

const paths = [...new Set(builtinModules.flatMap(name => [name, `node:${name.replace(/^node:/, "")}`])),
  "server-only", "next/server", "next/headers", "next/cache", "next/after"];
const serverPatterns = [{
  regex: "(^|/)(services|externals|config|infrastructure|application|features/backend)(/|$)|(^|/)server(?:\\.[^/]+)?$|^node:|^(googleapis|google-auth-library|@google-cloud/|@line/)",
  message: "Shipment browser code must use public contracts and browser clients, never server implementations.",
}];
const browserRules = {
  "no-restricted-imports": ["error", { paths, patterns: [...serverPatterns, {
    regex: "(^|/)app(/|$)", message: "Shipment module UI cannot import app implementations.",
  }] }],
  "no-restricted-syntax": noDynamicServerBypass,
  "no-restricted-globals": ["error", "process", "Buffer"],
};

export const shipmentsBoundaries = [
  { files: ["src/modules/shipments/ui/**/*.{ts,tsx}"], rules: browserRules },
  {
    // Only these two existing screens retain the original browser client until
    // Orders picker decoupling. Moving that client now creates a module cycle.
    files: ["src/modules/shipments/ui/ShipmentListPage.tsx", "src/modules/shipments/ui/[[]id[]]/ShipmentDetailPage.tsx"],
    rules: {
      "no-restricted-imports": ["error", { paths, patterns: [...serverPatterns, {
        regex: "^(?!@/app/shipments/api$)(?:.*/)?app(/|$)",
        message: "Only the exact retained @/app/shipments/api browser client is allowed until picker decoupling.",
      }] }],
    },
  },
  {
    files: ["src/app/shipments/api.ts"],
    rules: {
      ...browserRules,
      "no-restricted-imports": ["error", { patterns: [{
        regex: "^(?!@/modules/shipments/contracts$).*",
        message: "The retained browser client may import only Shipment contracts; do not forward a relocated client and create a module cycle.",
      }] }],
      "no-restricted-syntax": [...noDynamicServerBypass,
        { selector: "ImportDeclaration[importKind!='type']", message: "Retain only erased contract imports in the legacy browser client." },
        { selector: "ExportAllDeclaration", message: "Do not forward Shipment implementations through the retained client." },
        { selector: "ExportNamedDeclaration[source]", message: "Do not forward Shipment implementations through the retained client." }],
    },
  },
  {
    files: ["src/modules/shipments/contracts.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{
        regex: "^(?!@/services/shipments/types$).*",
        message: "Shipment contracts may only forward the documented pure legacy types leaf until Orders decoupling.",
      }] }],
      "no-restricted-syntax": [...noDynamicServerBypass,
        { selector: "ExportAllDeclaration", message: "Use explicit named Shipment contracts; never a broad barrel." }],
      "no-restricted-globals": ["error", "process", "Buffer", "fetch"],
    },
  },
  {
    files: ["src/services/shipments/types.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{
        regex: "^(?!@/modules/orders/contracts$).*",
        message: "The temporary Shipment contract leaf may depend only on pure Orders contracts.",
      }] }],
      "no-restricted-syntax": noDynamicServerBypass,
      "no-restricted-globals": ["error", "process", "Buffer", "fetch"],
    },
  },
];
