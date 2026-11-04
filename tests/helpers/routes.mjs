import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ts from "typescript";

export function routeContracts(root = "src/app") {
  const files = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/^(page|route)\.(tsx?|jsx?)$/.test(entry.name)) files.push(path);
    }
  }
  walk(root);
  return files.sort().map((path) => {
    const file = relative(root, path).split(sep).join("/");
    const parts = file.split("/").slice(0, -1)
      .filter((part) => !/^\(.*\)$/.test(part) && !part.startsWith("@"));
    const contract = { file, path: `/${parts.join("/")}`, kind: file.includes("route.") ? "api" : "page" };
    if (contract.kind === "api") {
      const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
      const names = new Set();
      const methods = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);
      for (const statement of source.statements) {
        if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
          for (const element of statement.exportClause.elements) names.add(element.name.text);
        }
        if (!statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;
        if (ts.isFunctionDeclaration(statement) && statement.name) names.add(statement.name.text);
        if (ts.isVariableStatement(statement)) {
          for (const declaration of statement.declarationList.declarations) {
            if (ts.isIdentifier(declaration.name)) names.add(declaration.name.text);
          }
        }
      }
      contract.methods = [...names].filter((name) => methods.has(name)).sort();
    }
    return contract;
  });
}
