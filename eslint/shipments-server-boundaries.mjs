import { noDynamicServerBypass } from "./orders-boundaries.mjs";

function onlyImports(paths) {
  const choices = paths.map(path => path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  return ["error", { patterns: [{ regex: `^(?!(?:${choices})$).+`, message: "Import outside the exact Shipment creation/read seams; keep the business port independent and server wiring explicit." }] }];
}
const staticExports = [
  ...noDynamicServerBypass,
  { selector: "ExportAllDeclaration", message: "Expose named Shipment operations, never a broad barrel." },
  { selector: "ExportNamedDeclaration[source]", message: "Do not forward server/provider implementations from the Shipment server seams." },
];
const serverRules = {
  "no-restricted-syntax": [...staticExports,
    { selector: "ImportDeclaration[source.value='@/externals/google/drive/types']:not([importKind='type'])", message: "Drive interfaces must be erased type imports." },
    { selector: "ImportDeclaration[source.value='@/externals/google/sheet/types']:not([importKind='type'])", message: "Sheet interfaces must be erased type imports; runtime mapping imports explicit constants only." }],
  "no-restricted-globals": ["error", "process", "Buffer", "fetch"],
};

export const shipmentsServerBoundaries = [
  {
    files: ["src/modules/shipments/application/**/*.ts"],
    rules: {
      "no-restricted-imports": onlyImports(["../contracts", "../../contracts", "@/modules/shipments/contracts", "./ports/created-shipment-writer"]),
      "no-restricted-syntax": staticExports,
      "no-restricted-globals": ["error", "Date", "process", "Buffer", "fetch", "crypto", "performance"],
      "no-restricted-properties": ["error", { object: "Math", property: "random", message: "Shipment application receives its ID generator explicitly." }],
    },
  },
  {
    files: ["src/modules/shipments/infrastructure/google-sheets/**/*.ts"],
    rules: {
      ...serverRules,
      "no-restricted-imports": onlyImports([
        "server-only", "@/externals/google/sheet/types", "@/externals/google/sheet/const",
        "@/externals/google/sheet/sheets/shipments/const", "../../contracts",
        "../../application/ports/created-shipment-writer",
      ]),
      "no-restricted-globals": ["error", "Date", "process", "Buffer", "fetch"],
    },
  },
  {
    files: ["src/modules/shipments/application/list-shipments.ts"],
    rules: {
      "no-restricted-imports": onlyImports(["../contracts", "./ports/shipment-list-reader"]),
    },
  },
  {
    files: ["src/modules/shipments/application/ports/shipment-list-reader.ts"],
    rules: {
      "no-restricted-imports": onlyImports(["../../contracts"]),
    },
  },
  {
    files: ["src/modules/shipments/infrastructure/google-sheets/shipment-list-reader.ts"],
    rules: {
      "no-restricted-imports": onlyImports([
        "server-only", "@/externals/google/sheet/types", "@/modules/orders/contracts",
        "../../contracts", "../../application/ports/shipment-list-reader",
      ]),
    },
  },
  {
    files: ["src/modules/shipments/application/link-order-to-shipment.ts"],
    rules: {
      "no-restricted-imports": onlyImports(["../contracts", "./ports/shipment-order-link-store"]),
    },
  },
  {
    files: ["src/modules/shipments/application/ports/shipment-order-link-store.ts"],
    rules: {
      "no-restricted-imports": onlyImports(["../../contracts"]),
    },
  },
  {
    files: ["src/modules/shipments/infrastructure/google-sheets/shipment-order-link-store.ts"],
    rules: {
      "no-restricted-imports": onlyImports([
        "server-only", "@/externals/google/sheet/types", "@/externals/google/sheet/const",
        "@/externals/google/sheet/sheets/shipment-orders/const", "../../contracts",
        "../../application/ports/shipment-order-link-store",
      ]),
    },
  },
  {
    files: ["src/modules/shipments/application/update-shipment-status.ts"],
    rules: {
      "no-restricted-imports": onlyImports(["../contracts", "./ports/shipment-status-store"]),
    },
  },
  {
    files: ["src/modules/shipments/application/ports/shipment-status-store.ts"],
    rules: {
      "no-restricted-imports": onlyImports(["../../contracts"]),
    },
  },
  {
    files: ["src/modules/shipments/infrastructure/google-sheets/shipment-status-store.ts"],
    rules: {
      "no-restricted-imports": onlyImports([
        "server-only", "@/externals/google/sheet/types", "../../contracts",
        "../../application/ports/shipment-status-store",
      ]),
    },
  },
  {
    files: ["src/modules/shipments/application/advance-shipment-status-with-bill.ts"],
    rules: {
      "no-restricted-imports": onlyImports(["./update-shipment-status", "./ports/shipment-bill-storage"]),
      "no-restricted-globals": ["error", "Date", "process", "Buffer", "File", "FormData", "Request", "Response", "fetch", "crypto", "performance"],
      "no-restricted-syntax": [...staticExports,
        { selector: "TSTypeReference[typeName.name=/^(File|Buffer|FormData|Request|Response)$/]", message: "Browser/transport file types do not belong in the bill application." },
        { selector: "ImportDeclaration[source.value='./update-shipment-status']:not([importKind='type'])", message: "Inject the status operation; import only its existing result type." }],
    },
  },
  {
    files: ["src/modules/shipments/application/ports/shipment-bill-storage.ts"],
    rules: {
      "no-restricted-imports": onlyImports([]),
      "no-restricted-syntax": [...staticExports, { selector: "TSTypeReference[typeName.name=/^(File|Buffer|FormData|Request|Response)$/]", message: "The storage port exposes business metadata only." }],
      "no-restricted-globals": ["error", "Date", "process", "Buffer", "File", "FormData", "Request", "Response", "fetch", "crypto", "performance"],
    },
  },
  {
    files: ["src/modules/shipments/infrastructure/google-drive/shipment-bill-storage.ts"],
    rules: {
      ...serverRules,
      "no-restricted-imports": onlyImports(["server-only", "@/externals/google/drive/types", "../../application/ports/shipment-bill-storage"]),
      "no-restricted-syntax": [...staticExports,
        { selector: "ImportDeclaration[source.value='@/externals/google/drive/types']:not([importKind='type'])", message: "Drive interfaces must be erased imports." }],
      "no-restricted-globals": ["error", "process", "fetch"],
    },
  },
  {
    files: ["src/modules/shipments/infrastructure/google-sheets/order-detail-shipment-projection.ts"],
    rules: {
      "no-restricted-imports": onlyImports([
        "server-only", "@/externals/google/sheet/types", "../../contracts",
        "@/modules/orders/contracts", "@/modules/orders/application/ports/order-detail-shipment-projection",
      ]),
    },
  },
  {
    files: ["src/modules/shipments/server.ts"],
    rules: {
      ...serverRules,
      "no-restricted-imports": onlyImports([
        "server-only", "@/externals/google/sheet/types", "@/services/utils/createSortableId", "./contracts",
        "./application/create-shipment", "./infrastructure/google-sheets/shipment-writer",
        "./application/list-shipments", "./infrastructure/google-sheets/shipment-list-reader",
        "./application/link-order-to-shipment", "./infrastructure/google-sheets/shipment-order-link-store",
        "./application/update-shipment-status", "./infrastructure/google-sheets/shipment-status-store",
        "@/externals/google/drive/types", "./application/advance-shipment-status-with-bill",
        "./infrastructure/google-drive/shipment-bill-storage",
      ]),
    },
  },
];
