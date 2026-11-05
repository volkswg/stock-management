import { noDynamicServerBypass } from "./orders-boundaries.mjs";

// This is the exact implemented seam, not a repository-wide legacy allowlist.
// Add a new permitted dependency only with a real use case and boundary tests.
function onlyImports(paths) {
  const choices = paths.map((path) => path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  return ["error", { patterns: [{ regex: `^(?!(?:${choices})$).+`, message: "Import outside the documented Orders use-case seam. Keep application ports independent and server composition explicit." }] }];
}

const serverRules = {
  "no-restricted-syntax": [
    ...noDynamicServerBypass,
    { selector: "ImportDeclaration[source.value='@/externals/google/sheet']:not([importKind='type'])", message: "Use only sheet interface types from the legacy aggregate; runtime adapters import explicit constants." },
    { selector: "ExportAllDeclaration", message: "Expose explicit named Orders operations, not a broad server/provider barrel." },
    { selector: "ExportNamedDeclaration[source.value='@/externals/google/sheet']:not([exportKind='type'])", message: "Do not re-export provider implementations through Orders adapters or server composition." },
  ],
  "no-restricted-globals": ["error", "process", "Buffer", "fetch"],
};

export const ordersServerBoundaries = [
  {
    files: ["src/modules/orders/application/**/*.ts"],
    rules: {
      "no-restricted-imports": onlyImports([
        "../contracts", "../../contracts", "@/modules/orders/contracts",
        "./ports/order-list-reader", "./ports/created-order-writer",
      ]),
      "no-restricted-syntax": noDynamicServerBypass,
      "no-restricted-globals": ["error", "process", "Buffer", "fetch", "Date"],
    },
  },
  {
    files: ["src/modules/orders/infrastructure/google-sheets/**/*.ts"],
    rules: {
      ...serverRules,
      "no-restricted-imports": onlyImports([
        "server-only", "@/externals/google/sheet", "@/externals/google/sheet/const",
        "@/externals/google/sheet/sheets/orders/const", "../../contracts",
        "../../application/ports/order-list-reader", "../../application/ports/created-order-writer",
        "./order-row-mapping",
      ]),
    },
  },
  {
    files: ["src/modules/orders/application/get-order-detail.ts"],
    rules: {
      "no-restricted-imports": onlyImports(["../contracts", "./ports/order-detail-reader", "./ports/order-detail-shipment-projection"]),
      "no-restricted-syntax": [...noDynamicServerBypass, { selector: "ExportAllDeclaration", message: "Keep detail imports explicit." }, { selector: "ExportNamedDeclaration[source]", message: "No forwarding implementations." }],
      "no-restricted-globals": ["error", "Date", "process", "Buffer", "fetch", "crypto", "performance"],
      "no-restricted-properties": ["error", { object: "Math", property: "random", message: "Detail is a pure read use case." }],
    },
  },
  {
    files: ["src/modules/orders/application/ports/order-detail-reader.ts", "src/modules/orders/application/ports/order-detail-shipment-projection.ts"],
    rules: {
      "no-restricted-imports": onlyImports(["../../contracts"]),
      "no-restricted-syntax": [...noDynamicServerBypass, { selector: "ExportAllDeclaration", message: "Expose only the consumer contract." }, { selector: "ExportNamedDeclaration[source]", message: "No forwarding implementations." }],
      "no-restricted-globals": ["error", "Date", "process", "Buffer", "fetch", "crypto", "performance"],
    },
  },
  {
    files: ["src/modules/orders/infrastructure/google-sheets/order-detail-reader.ts"],
    rules: {
      "no-restricted-imports": onlyImports(["server-only", "@/externals/google/sheet/types", "../../contracts", "../../application/ports/order-detail-reader", "./order-row-mapping"]),
      "no-restricted-syntax": [...serverRules["no-restricted-syntax"], { selector: "ImportDeclaration[source.value='@/externals/google/sheet/types']:not([importKind='type'])", message: "Erase Sheets interface imports." }],
    },
  },
  {
    files: ["src/modules/orders/server.ts"],
    rules: {
      ...serverRules,
      "no-restricted-imports": onlyImports([
        "server-only", "@/externals/google/sheet", "@/services/utils/createSortableId", "./contracts",
        "./application/create-order", "./application/list-orders",
        "./application/get-order-detail", "./application/ports/order-detail-shipment-projection",
        "./infrastructure/google-sheets/order-detail-reader",
        "./infrastructure/google-sheets/order-list-reader", "./infrastructure/google-sheets/order-writer",
      ]),
    },
  },
];
