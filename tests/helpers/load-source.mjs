import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import ts from "typescript";

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
