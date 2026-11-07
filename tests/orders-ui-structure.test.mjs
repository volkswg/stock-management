import {restoreOrdersLineSource} from "./helpers/orders-line-history.mjs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, relative } from "node:path";
import test from "node:test";
import ts from "typescript";
import { detailBodyHash, pickerPageBodyHash, assertPickerDetailParity } from "./helpers/orders-picker-structure.mjs";

const baseline = JSON.parse(readFileSync(new URL("./fixtures/orders-ui-structure.json", import.meta.url), "utf8"));
const hash = (text) => createHash("sha256").update(text).digest("hex");
function bodyHash(file) {
  if (file === "src/modules/orders/ui/[id]/OrderDetailPage.tsx") { assertPickerDetailParity(); return detailBodyHash(); }
  if (file === "src/app/orders/[id]/page.tsx") return pickerPageBodyHash();
  const source = ts.createSourceFile(file, restoreOrdersLineSource(file), ts.ScriptTarget.Latest, true);
  const printer = ts.createPrinter();
  return hash(source.statements.filter((node) => !ts.isImportDeclaration(node) && !ts.isExportDeclaration(node))
    .map((node) => printer.printNode(ts.EmitHint.Unspecified, node, source)).join("\n"));
}
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]);
}

test("all 15 UI moves preserve component/type/JSX bodies, directives, formatting and CSS bytes", () => {
  assert.equal(baseline.moves.length, 15);
  assert.deepEqual(walk("src/modules/orders/ui").sort(), [...baseline.moves.map(({ to }) => to), "src/modules/orders/ui/[id]/shipment-picker-port.ts"].sort());
  for (const { from, to, hash: expected } of baseline.moves) {
    assert.equal(existsSync(from), false, `Obsolete implementation remains at ${from}`);
    assert.equal(to.endsWith(".css") ? hash(readFileSync(to)) : bodyHash(to), expected, to);
  }
  assert.equal(hash(restoreOrdersLineSource("src/modules/orders/contracts.ts")), baseline.contractsHash);
  assert.equal(existsSync("src/features/frontend/orders"), false);
});

test("route wrappers and external gallery consumers change imports only", () => {
  for (const { file, hash: expected } of baseline.consumers) assert.equal(bodyHash(file), expected, file);
  // Source code, not historical docs/fixtures, must have no retired references.
  for (const file of walk("src").filter((file) => /\.(tsx?|css)$/.test(file))) {
    const source = restoreOrdersLineSource(file);
    assert.ok(!source.includes("features/frontend/orders"), file);
    assert.ok(!source.includes("@/app/orders/api"), file);
  }
});

test("Orders project dependency graph is acyclic including type-only edges through compatibility clients", () => {
  const options = ts.parseJsonConfigFileContent(ts.readConfigFile("tsconfig.json", ts.sys.readFile).config, ts.sys, process.cwd()).options;
  const roots = walk("src/modules/orders").filter((file) => /\.tsx?$/.test(file));
  const active = [], visited = new Set();
  function visit(file) {
    assert.ok(!active.includes(file), `Dependency cycle: ${[...active, file].join(" -> ")}`);
    if (visited.has(file)) return;
    active.push(file);
    const source = ts.createSourceFile(file, restoreOrdersLineSource(file), ts.ScriptTarget.Latest, true);
    function check(node) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        const target = ts.resolveModuleName(node.moduleSpecifier.text, resolve(file), options, ts.sys).resolvedModule?.resolvedFileName;
        if (target) {
          const projectPath = relative(process.cwd(), target).replaceAll("\\", "/");
          if (projectPath.startsWith("src/")) visit(projectPath);
        }
      }
      ts.forEachChild(node, check);
    }
    check(source); active.pop(); visited.add(file);
  }
  roots.forEach(visit);
});
