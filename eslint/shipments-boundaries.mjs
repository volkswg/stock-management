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

const dtoNames = ["Shipment", "ShipmentListItem", "ShipmentRelatedOrder", "ShipmentRelatedProductImage",
  "ShipmentQuantityCost", "ShipmentCostSummary", "ShipmentStatusUpdate", "ShipmentOrder"];
const enumNames = ["Draft", "ReadyToShip", "Shipping", "Delivered", "Canceled"];
const enumValues = ["draft", "ready_to_ship", "shipping", "delivered", "canceled"];
const named = (node, names) => node.specifiers?.length === names.length && node.specifiers.every((s, i) =>
  s.exportKind !== "type" && (s.local?.name ?? s.imported?.name) === names[i] && (s.exported?.name ?? s.local?.name) === names[i]);

// Exact shapes close erased/relative/re-export bypasses without widening any UI
// or server scope. Historical AST tests separately preserve the DTO declarations.
const pureShipmentShape = {
  meta: { type: "problem", schema: [], messages: { shape: "Keep the exact pure Shipment enum/DTO forwarding shape; no executable helpers or extra dependencies." } },
  create(context) {
    return { Program(program) {
      const file = context.filename.replaceAll("\\", "/"), body = program.body;
      let valid;
      if (file.endsWith("/modules/shipments/status.ts")) {
        const declaration = body[0]?.declaration, members = declaration?.body?.members ?? declaration?.members;
        valid = body.length === 1 && body[0].type === "ExportNamedDeclaration" && declaration?.type === "TSEnumDeclaration" &&
          declaration.id.name === "ShipmentStatus" && !declaration.const && !declaration.declare && members?.length === 5 &&
          members.every((m, i) => m.id.name === enumNames[i] && m.initializer?.type === "Literal" && m.initializer.value === enumValues[i]);
      } else if (file.endsWith("/modules/shipments/contracts.ts")) {
        valid = body.length === 2 && body.every(n => n.type === "ExportNamedDeclaration") &&
          body[0].source?.value === "./status" && body[0].exportKind === "value" && named(body[0], ["ShipmentStatus"]) &&
          body[1].source?.value === "@/services/shipments/types" && body[1].exportKind === "type" && named(body[1], dtoNames);
      } else {
        const order = body[0], status = body[1], forward = body[2];
        valid = body.length === 11 && order.type === "ImportDeclaration" && order.importKind === "type" &&
          order.source.value === "@/modules/orders/contracts" && order.specifiers.length === 1 && order.specifiers[0].imported?.name === "OrderStatus" && order.specifiers[0].local.name === "OrderStatus" &&
          status.type === "ImportDeclaration" && status.importKind === "value" && status.source.value === "@/modules/shipments/status" &&
          status.specifiers.length === 1 && status.specifiers[0].importKind !== "type" && status.specifiers[0].imported?.name === "ShipmentStatus" && status.specifiers[0].local.name === "ShipmentStatus" &&
          forward.type === "ExportNamedDeclaration" && !forward.source && forward.exportKind === "value" && named(forward, ["ShipmentStatus"]) &&
          body.slice(3).every(n => n.type === "ExportNamedDeclaration" && n.declaration?.type === "TSTypeAliasDeclaration" && dtoNames.includes(n.declaration.id.name));
      }
      if (!valid) context.report({ node: program, messageId: "shape" });
    } };
  },
};

export const shipmentsBoundaries = [
  { files: ["src/modules/shipments/ui/**/*.{ts,tsx}"], rules: browserRules },
  {
    files: ["src/modules/shipments/ui/api.ts"],
    rules: {
      ...browserRules,
      "no-restricted-imports": ["error", { patterns: [{
        regex: "^(?!@/modules/shipments/contracts$).*",
        message: "The Shipment browser client may import only its public contracts; never forward other clients or server implementations.",
      }] }],
      "no-restricted-syntax": [...noDynamicServerBypass,
        { selector: "ImportDeclaration[importKind!='type']", message: "Use only erased public contract imports in the Shipment browser client." },
        { selector: "ExportAllDeclaration", message: "Do not forward Shipment implementations through the browser client." },
        { selector: "ExportNamedDeclaration[source]", message: "Do not forward Shipment implementations through the browser client." }],
    },
  },
  {
    files: ["src/modules/shipments/status.ts", "src/modules/shipments/contracts.ts", "src/services/shipments/types.ts"],
    plugins: { "shipment-contracts": { rules: { shape: pureShipmentShape } } },
    rules: {
      "shipment-contracts/shape": "error",
      "no-restricted-syntax": [...noDynamicServerBypass,
        { selector: "ExportAllDeclaration", message: "Use exact named Shipment contract exports." }],
      "no-restricted-globals": ["error", "Date", "process", "Buffer", "fetch", "crypto", "performance"],
      "no-restricted-properties": ["error", { object: "Math", property: "random", message: "Pure contracts perform no IO or random initialization." }],
    },
  },
  {
    files: ["src/modules/shipments/status.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{ regex: ".*", message: "The Shipment enum leaf has no imports or forwarding exports." }] }],
    },
  },
  {
    files: ["src/modules/shipments/contracts.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{
        regex: "^(?!\\./status$|@/services/shipments/types$).*",
        message: "Shipment contracts forward only their pure status leaf and the exact erased legacy DTO leaf.",
      }] }],
    },
  },
  {
    files: ["src/services/shipments/types.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{
        regex: "^(?!@/modules/orders/contracts$|@/modules/shipments/status$).*",
        message: "The legacy DTO leaf imports only erased Orders contracts and the single owned Shipment enum.",
      }] }],
    },
  },
];
