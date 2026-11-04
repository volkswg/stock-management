import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, relative } from "node:path";
import ts from "typescript";

const options = ts.parseJsonConfigFileContent(ts.readConfigFile("tsconfig.json", ts.sys.readFile).config, ts.sys, process.cwd()).options;
const walk = dir => existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]) : [];
const owner = file => /^src\/modules\/(orders|shipments)\//.exec(file)?.[1];

// Collapse app/legacy intermediary files as well as direct module imports. A
// forwarding app shim is not an ownership firewall. File DAGs alone miss this.
export function browserOwnership({ types = false, virtual = {} } = {}) {
  const host = { ...ts.sys, fileExists: file => Object.hasOwn(virtual, relative(process.cwd(), file)) || ts.sys.fileExists(file) };
  const sourceText = file => virtual[file] ?? readFileSync(file, "utf8");
  const roots = ["src/modules/orders/ui", "src/modules/shipments/ui"].flatMap(walk).filter(f => /\.tsx?$/.test(f));
  roots.push("src/modules/orders/contracts.ts", "src/modules/shipments/contracts.ts");
  const traces = new Map();
  for (const root of roots) {
    const from = owner(root), active = [];
    function visit(file, erased = false) {
      assert.ok(!active.includes(file), `File cycle: ${[...active, file].join(" -> ")}`);
      const to = owner(file);
      if (to && to !== from) {
        const path = [...active, file]; traces.set(`${from}:${to}:${erased}:${path.join(">")}`, { from, to, erased, path }); return;
      }
      active.push(file);
      const source = ts.createSourceFile(file, sourceText(file), ts.ScriptTarget.Latest, true);
      for (const node of source.statements) {
        if (!(ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) || !node.moduleSpecifier) continue;
        const clause = node.importClause, elements = clause?.namedBindings && ts.isNamedImports(clause.namedBindings) ? clause.namedBindings.elements : undefined;
        const onlyType = !!(node.isTypeOnly || clause?.isTypeOnly || (elements?.length && !clause.name && elements.every(e => e.isTypeOnly)));
        if (onlyType && !types) continue;
        const target = ts.resolveModuleName(node.moduleSpecifier.text, resolve(file), options, host).resolvedModule?.resolvedFileName;
        if (target) { const path = relative(process.cwd(), target).replaceAll("\\", "/"); if (path.startsWith("src/") && /\.tsx?$/.test(path)) visit(path, erased || onlyType); }
      }
      active.pop();
    }
    visit(root);
  }
  return [...traces.values()];
}
export const ownershipEdges = traces => [...new Set(traces.map(t => `${t.from}->${t.to}`))].sort();
