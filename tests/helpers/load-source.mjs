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
      const move = inventoryWorksheetsBefore.moves[path] ?? hrWorksheetsBefore.moves[path] ?? salesWorksheetsBefore.moves[path] ?? worksheetBefore.moves[path] ?? googleBefore.moves[path];
      if (move && specifier === "@/" + move.to.slice(4, -3)) {
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
