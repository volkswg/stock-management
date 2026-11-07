import { loadInventorySource } from "./inventory-source.mjs";
import { loadSalesSource } from "./sales-source.mjs";
import { createHRSourceLoader } from "./hr-payroll-source.mjs";
import { loadExpenseSource } from "./expenses-source.mjs";
import { remainingBefore, expenseRecords } from "./remaining-worksheet-history.mjs";
import { userStateBefore } from "./user-state-worksheet-history.mjs";
import { inventoryWorksheetsBefore } from "./inventory-worksheet-history.mjs";
import { hrWorksheetsBefore } from "./hr-worksheet-history.mjs";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { salesWorksheetsBefore } from "./sales-worksheet-history.mjs";
import { worksheetBefore } from "./worksheet-history.mjs";
import { googleBefore } from "./google-infrastructure.mjs";

// Characterize unchanged TS without adding a runner or loading real adapters.
// Every runtime dependency is explicit; network and environment access fail closed.
export function loadSource(path, { imports = {}, globals = {} } = {}) {
  if(["src/services/stock-adjustments/manageStockAdjustments.ts","src/services/stock-counts/manageStockCounts.ts","src/services/movements/manageMovements.ts","src/services/movements/worksheet-schema.ts","src/features/backend/line/services/movements/utils.ts"].includes(path)) return loadInventorySource(path,{imports,globals});
  if(path.startsWith("src/services/sales/")) return loadSalesSource(path,{imports,globals});
  if(["src/services/employees/manageSalaryAdvances.ts","src/services/employees/calculateEmployeePayroll.ts","src/services/employees/settleEmployeePayroll.ts"].includes(path)) return createHRSourceLoader({imports,globals})(path);
  if(path === "src/services/expenses/manageExpenses.ts") return loadExpenseSource(path,{imports,globals});
  const filename = resolve(path);
  const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
    fileName: filename,
  });
  const exports = {};
  const context = vm.createContext({
    exports,
    Buffer,
    URLSearchParams,
    URL,
    fetch: () => { throw new Error("Live network is forbidden in regression tests"); },
    ...globals,
    require: (specifier) => {
      // Only the reviewed old provider forwards may follow their single new owner.
      const move = remainingBefore.moves[path] ?? userStateBefore.moves[path] ?? inventoryWorksheetsBefore.moves[path] ?? hrWorksheetsBefore.moves[path] ?? salesWorksheetsBefore.moves[path] ?? worksheetBefore.moves[path] ?? googleBefore.moves[path];
      if (move && (specifier === "@/" + move.to.slice(4, -3) || (path.endsWith("/expenses/RecordsSheet.ts") && specifier === "@/" + expenseRecords.slice(4,-3)))) {
        const translated = new Proxy({}, {
          getOwnPropertyDescriptor: () => ({ configurable: true, enumerable: true }),
          get: (_, key) => {
            const old = Object.entries(move.imports).find(([, value]) => value === key)?.[0] ?? key;
            if (!Object.hasOwn(imports, old)) throw new Error(`Unstubbed dependency ${String(old)} in ${path}`);
            return imports[old];
          },
        });
        return loadSource(move.to, { imports: translated, globals });
      }
      if(path === "src/services/employees/manageSalaryAdvances.ts" && specifier === "./salary-advance-shops") {
        if (!Object.hasOwn(imports,"@/services/expenses")) throw new Error("Unstubbed advance shop reader");
        return {createSalaryAdvanceShops: service => ({listShops: () => imports["@/services/expenses"].listExpenseShops(service)})};
      }
      const split=remainingBefore.splits[path];
      if(split?.contracts && specifier === "@/modules/inventory/contracts" && !Object.hasOwn(imports,specifier)) return loadSource(split.contracts);
      if(split && specifier === "@/"+split.to.slice(4,-3) && !Object.hasOwn(imports,specifier)) return loadSource(split.to);
      if(path.startsWith("src/app/api/") && specifier === "@/modules/inventory/server") { const old=["@/services/movements","@/services/stock-counts","@/services/stock-adjustments/manageStockAdjustments"].filter(key=>Object.hasOwn(imports,key)); if(old.length) return Object.assign({},...old.map(key=>imports[key])); }
      if(path.startsWith("src/app/api/") && specifier === "@/modules/sales/server" && Object.hasOwn(imports,"@/services/sales")) return imports["@/services/sales"];
      if (!Object.hasOwn(imports, specifier)) {
        throw new Error(`Unstubbed dependency ${specifier} in ${path}`);
      }
      return imports[specifier];
    },
  });
  new vm.Script(outputText, { filename }).runInContext(context);
  return exports;
}

// Normalize values returned from the isolated VM for strict structural assertions.
export const plain = (value) => JSON.parse(JSON.stringify(value));
