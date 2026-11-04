import { builtinModules } from "node:module";

const browserImports = {
  paths: [
    ...new Set(builtinModules.flatMap((name) => [name, `node:${name.replace(/^node:/, "")}`])),
    "server-only", "next/server", "next/headers", "next/cache", "next/after",
  ],
  patterns: [{
    // Orders browser dependencies stay inside Orders/public generic code.
    regex: "(^|/)(services(?:/|$)|externals(?:/|$)|config(?:/|$)|infrastructure(?:/|$)|features/backend(?:/|$)|application(?:/|$))|(^|/)server(?:\\.[^/]+)?$",
    message: "Orders browser code must use browser-safe public contracts, not server services/config/adapters.",
  }, {
    regex: "(^|/)(app(?:/|$)|features/frontend/orders(?:/|$))",
    message: "Orders UI must not import app implementations; dependencies are injected at client composition.",
  }, {
    regex: "(^|/)shipments(?:/|$)",
    message: "Orders UI consumes its own picker port; Shipment implementations/contracts must stay at app composition.",
  }, {
    regex: "^node:|^(googleapis|google-auth-library|@google-cloud/|@line/)",
    message: "Orders browser code cannot import provider SDKs or Node APIs.",
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

ordersBoundaries.push(
  {
    files: ["src/modules/orders/ui/[[]id[]]/shipment-picker-port.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{ regex: "^(?!@/modules/orders/contracts$).*", message: "The Orders picker port may import only Orders contracts." }] }],
      "no-restricted-syntax": noDynamicServerBypass,
      "no-restricted-globals": ["error", "process", "Buffer", "fetch"],
    },
  },
  {
    files: ["src/app/orders/[[]id[]]/OrderDetailClient.tsx"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{
        regex: "^(?!@/modules/orders/ui/\\[id\\]/(?:OrderDetailPage|shipment-picker-port)$|@/app/shipments/api$|@/modules/shipments/contracts$).*",
        message: "Orders client composition may wire only its UI/port, the existing Shipment browser client and public enum.",
      }] }],
      "no-restricted-syntax": noDynamicServerBypass,
      "no-restricted-globals": ["error", "process", "Buffer", "fetch"],
    },
  },
);
