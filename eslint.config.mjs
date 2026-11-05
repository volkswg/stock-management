import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { ordersBoundaries } from "./eslint/orders-boundaries.mjs";
import { ordersServerBoundaries } from "./eslint/orders-server-boundaries.mjs";
import { shipmentsBoundaries } from "./eslint/shipments-boundaries.mjs";
import { shipmentsServerBoundaries } from "./eslint/shipments-server-boundaries.mjs";

import { googleInfrastructureBoundaries } from "./eslint/google-infrastructure-boundaries.mjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...ordersBoundaries,
  ...ordersServerBoundaries,
  ...shipmentsBoundaries,
  ...shipmentsServerBoundaries,
  ...googleInfrastructureBoundaries,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
