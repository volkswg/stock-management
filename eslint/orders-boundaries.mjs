import { builtinModules } from "node:module";

const browserImports = {
  paths: [
    ...new Set(builtinModules.flatMap((name) => [name, `node:${name.replace(/^node:/, "")}`])),
    "server-only", "next/server", "next/headers", "next/cache", "next/after",
  ],
  patterns: [{
    // Match aliases AND relative paths. The one pure shipment contract file is
    // a temporary bridge for the order detail picker, removed by the Shipments PR.
    regex: "(^|/)(services(?:$|/(?!shipments/types(?:\\.ts)?$))|externals(?:/|$)|config(?:/|$)|infrastructure(?:/|$)|features/backend(?:/|$)|application(?:/|$))|(^|/)server(?:\\.[^/]+)?$",
    message: "Orders browser code must use browser-safe public contracts, not server services/config/adapters.",
  }],
};

const noDynamicServerBypass = [
  "error",
  { selector: "ImportExpression", message: "Keep migrated Orders imports static so browser boundaries can be checked." },
  { selector: "CallExpression[callee.name='require']", message: "Use static browser-safe imports in migrated Orders files." },
  { selector: "TSImportEqualsDeclaration", message: "Use static browser-safe imports in migrated Orders files." },
  { selector: "TSImportType", message: "Use explicit type imports so Orders boundaries can be checked." },
];

export const ordersBoundaries = [
  {
    files: ["src/modules/orders/contracts.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{ regex: ".*", message: "Orders contracts are a self-contained browser-safe leaf; do not import or re-export dependencies." }] }],
      "no-restricted-syntax": noDynamicServerBypass,
      "no-restricted-globals": ["error", "process", "Buffer", "fetch"],
    },
  },
  {
    files: ["src/app/orders/api.ts", "src/app/orders/**/Order*Page.tsx", "src/features/frontend/orders/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", browserImports],
      "no-restricted-syntax": noDynamicServerBypass,
      "no-restricted-globals": ["error", "process", "Buffer"],
    },
  },
  {
    // These consumers migrate only their Orders import; their own legacy
    // shipment service dependencies are deliberately left for the Shipments PR.
    files: [
      "src/app/shipments/ShipmentListPage.tsx",
      "src/app/shipments/[[]id[]]/ShipmentDetailPage.tsx",
      "src/app/shipments/shipmentListFormat.ts",
    ],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{ regex: "(^|/)services/orders(?:/|$)", message: "Use @/modules/orders/contracts for Orders values and DTOs." }] }],
    },
  },
];
