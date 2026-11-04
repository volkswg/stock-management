import { builtinModules } from "node:module";
import { noDynamicServerBypass } from "./orders-boundaries.mjs";

const browserFiles = [
  "src/app/shipments/ShipmentListPage.tsx",
  "src/app/shipments/ShipmentMobileCard.tsx",
  "src/app/shipments/[[]id[]]/ShipmentDetailPage.tsx",
  "src/app/shipments/shipmentListFormat.ts",
  "src/app/shipments/api.ts",
];

export const shipmentsBoundaries = [
  {
    files: browserFiles,
    rules: {
      "no-restricted-imports": ["error", {
        paths: [...new Set(builtinModules.flatMap(name => [name, `node:${name.replace(/^node:/, "")}`])),
          "server-only", "next/server", "next/headers", "next/cache", "next/after"],
        patterns: [{
          regex: "(^|/)(services|externals|config|infrastructure|application|features/backend|app/api)(/|$)|(^|/)server(?:\\.[^/]+)?$|^node:|^(googleapis|google-auth-library|@google-cloud/|@line/)",
          message: "Shipment browser code must use public contracts and browser clients, never server implementations.",
        }],
      }],
      "no-restricted-syntax": noDynamicServerBypass,
      "no-restricted-globals": ["error", "process", "Buffer"],
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
