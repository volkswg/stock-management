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
  }, {
    regex: "(^|/)(app(?:$|/(?!shipments/api(?:\\.ts)?$))|features/frontend/orders(?:/|$))",
    message: "Orders UI is consolidated in its module. Only the documented browser shipment HTTP bridge may import from app until PR 5.",
  }],
};

export const noDynamicServerBypass = [
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
    files: ["src/modules/orders/ui/**/*.{ts,tsx}"],
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
      "src/modules/shipments/ui/ShipmentListPage.tsx",
      "src/modules/shipments/ui/[[]id[]]/ShipmentDetailPage.tsx",
      "src/modules/shipments/ui/shipmentListFormat.ts",
    ],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{ regex: "(^|/)services/orders(?:/|$)", message: "Use @/modules/orders/contracts for Orders values and DTOs." }] }],
    },
  },
];
