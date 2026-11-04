import { resolve, relative } from "node:path";
import ts from "typescript";
import { loadSource } from "./load-source.mjs";

// Closed, offline module graph for legacy wrappers and the new Orders seam.
// Real config/auth/provider implementations are never loaded.
export function ordersServer({ globals = {}, createId = () => "synthetic-order-id", overrides = {} } = {}) {
  const cache = new Map();
  const options = ts.parseJsonConfigFileContent(ts.readConfigFile("tsconfig.json", ts.sys.readFile).config, ts.sys, process.cwd()).options;
  const constants = {
    ...loadSource("src/externals/google/sheet/const.ts"),
    ...loadSource("src/externals/google/sheet/sheets/orders/const.ts"),
    ...loadSource("src/externals/google/sheet/sheets/order-bills/const.ts"),
    ...loadSource("src/externals/google/sheet/sheets/order-items/const.ts"),
  };
  function load(file) {
    file = relative(process.cwd(), resolve(file)).replaceAll("\\", "/");
    if (Object.hasOwn(overrides, file)) return overrides[file];
    if (cache.has(file)) return cache.get(file);
    if (file === "src/services/utils/createSortableId.ts") return { createSortableId: createId };
    if (!/^(src\/(modules\/orders|services\/orders)\/|src\/services\/shipments\/types\.ts$|src\/externals\/google\/sheet\/(?:.*\/)?const\.ts$)/.test(file)) {
      throw new Error(`Unapproved offline Orders dependency: ${file}`);
    }
    const imports = new Proxy({}, {
      getOwnPropertyDescriptor: () => ({ configurable: true, enumerable: true }),
      get(_, specifier) {
        if (specifier === "server-only") return {};
        if (specifier === "@/externals/google/sheet") return constants;
        if (specifier === "@/services/shipments") return load("src/services/shipments/types.ts");
        const target = ts.resolveModuleName(specifier, resolve(file), options, ts.sys).resolvedModule?.resolvedFileName;
        if (!target) throw new Error(`Unresolved offline dependency ${specifier} in ${file}`);
        return load(target);
      },
    });
    const exports = loadSource(file, { imports, globals: { Error, ...globals } });
    cache.set(file, exports);
    return exports;
  }
  return load;
}
