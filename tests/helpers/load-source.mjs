import {cleanupHistory} from "./cleanup-history.mjs";
import {legacySpecifier} from "./cleanup-history.mjs";
import {externalHistory} from "./external-history.mjs";
import {ordersLineGraph} from "./orders-line-source.mjs";
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
  if(externalHistory.moves[path])return loadSource(externalHistory.moves[path].to,{imports,globals});
  if(path.startsWith("src/services/orders/")||path.startsWith("src/services/line/")||path.startsWith("src/services/user-states/")||path==="src/services/movements/state.ts"||path==="src/features/backend/line/services/movements/index.ts"||["src/externals/line/enum.ts","src/externals/line/utils/messageBuilder.ts","src/features/backend/shared/utils.ts"].includes(path))return ordersLineGraph({imports,globals}).load(path);
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
      const cleanup=cleanupHistory.moves[path];
      if(cleanup && (specifier==='@/'+cleanup.to.slice(4,-3)||specifier==='../'+cleanup.to.slice(4))){
        const translated=new Proxy({}, {
          getOwnPropertyDescriptor:()=>({configurable:true,enumerable:true}),
          get:(_,key)=>{
            const change=cleanup.changes.find(c=>c.to.startsWith('"')&&c.to.endsWith('"')&&c.to.slice(1,-1)===key);
            const old=change?change.from.slice(1,-1):key;
            if(!Object.hasOwn(imports,old))throw new Error(`Unstubbed cleanup dependency ${String(old)} in ${path}`);
            return imports[old];
          },
        });
        return loadSource(cleanup.to,{imports:translated,globals});
      }
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
      if(split?.contracts && legacySpecifier(specifier)==="@/modules/inventory/contracts" && !Object.hasOwn(imports,specifier)) return loadSource(split.contracts);
      if(split && specifier === "@/"+split.to.slice(4,-3) && !Object.hasOwn(imports,specifier)) return loadSource(split.to);
      if(path.startsWith("src/app/api/") && legacySpecifier(specifier)==="@/modules/inventory/server") { const old=["@/services/movements","@/services/stock-counts","@/services/stock-adjustments/manageStockAdjustments"].filter(key=>Object.hasOwn(imports,key)); if(old.length) return Object.assign({},...old.map(key=>imports[key])); }
      if(path.startsWith("src/app/api/") && legacySpecifier(specifier)==="@/modules/sales/server" && Object.hasOwn(imports,"@/services/sales")) return imports["@/services/sales"];
      if(path.startsWith("src/app/api/orders") && legacySpecifier(specifier)==="@/modules/orders/server" && Object.hasOwn(imports,"@/services/orders")) return {...imports[specifier],...imports["@/services/orders"]};
      const oldExternal=specifier.replace("@/infrastructure/external/","@/externals/");
      if(oldExternal!==specifier&&Object.hasOwn(imports,oldExternal))return imports[oldExternal];
      if(Object.hasOwn(imports,specifier))return imports[specifier];
      if(legacySpecifier(specifier)!==specifier&&Object.hasOwn(imports,legacySpecifier(specifier)))return imports[legacySpecifier(specifier)];
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
