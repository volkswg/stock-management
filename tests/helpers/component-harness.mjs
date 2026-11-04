import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import ts from "typescript";
import { loadSource } from "./load-source.mjs";

// Executes component callbacks/effects against element descriptors. This does
// not simulate React DOM, Ant Design validation, layout, focus or Strict Mode.
export function componentHarness(path, { api = {}, globals = {} } = {}) {
  const slots = [], pending = [], notifications = [], navigation = [], formEvents = [], listeners = new Map();
  let cursor = 0, component, props;
  const same = (a, b) => a && b && a.length === b.length && a.every((item, i) => Object.is(item, b[i]));
  const react = {
    useState(initial) {
      const index = cursor++;
      slots[index] ??= { value: typeof initial === "function" ? initial() : initial };
      return [slots[index].value, (update) => { slots[index].value = typeof update === "function" ? update(slots[index].value) : update; }];
    },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!same(slots[index]?.deps, deps)) {
        slots[index]?.cleanup?.();
        slots[index] = { deps };
        pending.push(() => { slots[index].cleanup = effect(); });
      }
    },
    useMemo(factory, deps) {
      const index = cursor++;
      if (!same(slots[index]?.deps, deps)) slots[index] = { deps, value: factory() };
      return slots[index].value;
    },
  };
  function Form() { return null; }
  Object.assign(Form, { Item: "Form.Item", useForm: () => [{ resetFields() { formEvents.push(["reset"]); }, setFieldsValue(values) { formEvents.push(["set", values]); }, setFieldValue() {}, submit() { formEvents.push(["submit"]); } }] });
  function Input() { return null; }
  Object.assign(Input, { TextArea: "TextArea" });
  function Upload() { return null; }
  Object.assign(Upload, { Dragger: "Upload.Dragger", LIST_IGNORE: "LIST_IGNORE" });
  const ui = new Proxy({ Form, Input, Upload, Typography: { Text: "Text", Title: "Title" },
    Descriptions: { Item: "Descriptions.Item" },
    message: { useMessage: () => [{ success: (message) => notifications.push(message), error: (message) => notifications.push(message), destroy() {} }, null] },
  }, { get: (object, name) => object[name] ?? String(name) });
  const jsx = (type, properties) => ({ type, props: properties ?? {} });
  const imports = {
    react, "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" }, antd: ui,
    "@ant-design/icons": new Proxy({}, { get: (_, name) => String(name) }),
    "next/navigation": { useRouter: () => ({ push: (url) => navigation.push(url) }) },
    "@/modules/orders/contracts": loadSource("src/modules/orders/contracts.ts"),
    "@/modules/shipments/contracts": loadSource("src/services/shipments/types.ts"),
  };
  const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
  for (const node of source.statements) {
    if (!ts.isImportDeclaration(node)) continue;
    const name = node.moduleSpecifier.text;
    if (imports[name]) continue;
    if (name.endsWith(".css")) imports[name] = { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
    else if (name.endsWith("/api")) imports[name] = api;
    else if (name.endsWith("orderListFormat")) imports[name] = loadSource(resolve(dirname(path), `${name}.ts`));
    else if (name.endsWith("shipmentListFormat")) imports[name] = loadSource(resolve(dirname(path), `${name}.ts`), { imports });
    else if (node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
      imports[name] = Object.fromEntries(node.importClause.namedBindings.elements.map((entry) => [entry.propertyName?.text ?? entry.name.text, entry.propertyName?.text ?? entry.name.text]));
    } else throw new Error(`Unexpected component dependency: ${name}`);
  }
  const componentModule = loadSource(path, { imports, globals: {
    Error, AbortController, HTMLElement: class HTMLElement {},
    window: { addEventListener: (name, listener) => listeners.set(name, listener), removeEventListener: (name, listener) => { if (listeners.get(name) === listener) listeners.delete(name); } },
    ...globals,
  } });
  return {
    module: componentModule, notifications, navigation, formEvents, listeners,
    mount(next, values) {
      this.unmount(); slots.length = 0; pending.length = 0;
      return this.render(next, values);
    },
    render(next = component, values = props) {
      component = next; props = values; cursor = 0;
      const tree = component(props);
      pending.splice(0).forEach((effect) => effect());
      return tree;
    },
    unmount() { for (const slot of slots) slot?.cleanup?.(); },
  };
}

export function elements(tree, name) {
  const found = [];
  function walk(value) {
    if (!value || typeof value !== "object") return;
    if (value.type && (typeof value.type === "string" ? value.type : value.type.name) === name) found.push(value);
    for (const child of Object.values(value)) {
      if (Array.isArray(child)) child.forEach(walk);
      else if (child && typeof child === "object") walk(child);
    }
  }
  walk(tree);
  return found;
}
export const flush = () => new Promise((resolve) => setImmediate(resolve));
export function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
