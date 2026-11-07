import {ordersLineWorkflowBoundaries} from "./eslint/orders-line-workflows-boundaries.mjs";
import { inventoryApplicationBoundaries } from "./eslint/inventory-application-boundaries.mjs";
import { salesApplicationBoundaries } from "./eslint/sales-application-boundaries.mjs";
import { hrWorkforceBoundaries } from "./eslint/hr-workforce-boundaries.mjs";
import { hrPayrollBoundaries } from "./eslint/hr-payroll-boundaries.mjs";
import { expensesBoundaries } from "./eslint/expenses-boundaries.mjs";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { ordersBoundaries } from "./eslint/orders-boundaries.mjs";
import { ordersServerBoundaries } from "./eslint/orders-server-boundaries.mjs";
import { shipmentsBoundaries } from "./eslint/shipments-boundaries.mjs";
import { shipmentsServerBoundaries } from "./eslint/shipments-server-boundaries.mjs";

import { googleInfrastructureBoundaries } from "./eslint/google-infrastructure-boundaries.mjs";

import { ordersSheetTypeBoundaries } from "./eslint/orders-sheet-type-boundaries.mjs";

import { worksheetBoundaries } from "./eslint/worksheet-boundaries.mjs";

import { employeeDirectoryBoundaries } from "./eslint/employee-directory-boundaries.mjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...ordersBoundaries,
  ...ordersServerBoundaries,
  ...shipmentsBoundaries,
  ...shipmentsServerBoundaries,
  ...googleInfrastructureBoundaries,
  ...ordersSheetTypeBoundaries,
  ...worksheetBoundaries,
  ...employeeDirectoryBoundaries,
  ...expensesBoundaries,
  ...hrPayrollBoundaries,
  ...hrWorkforceBoundaries,
  ...salesApplicationBoundaries,
  ...inventoryApplicationBoundaries,
  ...ordersLineWorkflowBoundaries,
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
