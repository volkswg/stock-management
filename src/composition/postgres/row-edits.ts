import "server-only";
import { createHash } from "node:crypto";
import { currentTransaction } from "@/infrastructure/persistence/postgres/database";

// HTTP concurrency metadata belongs to composition, not business DTOs/ports.
// Each scope witnesses ONE edited row (or one natural-key upsert slot), never
// its children. All table/column names below are closed, server-owned mappings.
type Table = "orders" | "order_items" | "movements" | "movement_details" | "shipments" | "employees" | "employee_timesheets" | "employee_advances" | "expenses" | "shops" | "expense_categories" | "stock_adjustments" | "stock_counts" | "sales_profit_cost_overrides";
type RowScope = { scope: string; table: Table; id: string; parent?: string };
type Json = Record<string, unknown>;
const record = (v: unknown): Json => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Json : {};
const text = (v: unknown) => typeof v === "string" ? v.trim() : "";
const array = (v: unknown) => Array.isArray(v) ? v.map(record) : [];
const part = (v: string) => encodeURIComponent(v);
const scope = (path: string, table: Table, id: unknown, parent?: string): RowScope | undefined => {
  const value = text(id); return value ? { scope: path, table, id: value, parent } : undefined;
};
function item(family: "orders" | "movements", parent: string, id: string): RowScope | undefined {
  if (family === "movements") { parent = parent.toUpperCase(); id = id.toUpperCase(); }
  return scope(`/api/${family}/${part(parent)}/items/${part(id)}`, family === "orders" ? "order_items" : "movement_details", id, parent);
}
function natural(path: string, table: Table, month: string, account: string): RowScope | undefined {
  return month && account ? { scope: `${path}?month=${part(month)}&accountId=${part(account)}`, table, id: month, parent: account } : undefined;
}
async function json(request: Request): Promise<Json> { try { return record(await request.clone().json()); } catch { return {}; } }
export async function mutationRow(request: Request): Promise<RowScope | undefined> {
  let p: string[];
  try { p = new URL(request.url).pathname.split("/").map(decodeURIComponent); } catch { return; }
  const [, api, family, rawId, child, childId, suffix] = p;
  if (api !== "api") return;
  if (family === "orders" || family === "movements") {
    if (!rawId || rawId === "with-images") return; // New creates have no stale existing row.
    const id = family === "movements" ? rawId.trim().toUpperCase() : rawId.trim();
    if (child === "items" && childId && (!suffix || suffix === "image")) return item(family, id, childId.trim());
    // Adding an item/image checks business rules inside the transaction; it
    // must not depend on the parent's version or a collection snapshot.
    if (child) return;
    return scope(`/api/${family}/${part(id)}`, family, id);
  }
  if (family === "shipments" && rawId && !child) return scope(`/api/shipments/${part(rawId.trim())}`, "shipments", rawId);
  if (family === "employees") {
    if (rawId === "timesheets" && child) return scope(`/api/employees/timesheets/${part(child.trim())}`, "employee_timesheets", child);
    if (rawId === "advances") { const b = await json(request); return scope(`/api/employees/advances/${part(text(b.id))}`, "employee_advances", b.id); }
    if (rawId && !["payroll", "timesheets"].includes(rawId) && !child) return scope(`/api/employees/${part(rawId.trim())}`, "employees", rawId);
  }
  const b = await json(request);
  if (family === "expenses" && !rawId) return scope(`/api/expenses/${part(text(b.id))}`, "expenses", b.id);
  if (family === "expenses" && rawId === "masters" && ["shops", "categories"].includes(child)) return scope(`/api/expenses/masters/${child}/${part(text(b.id))}`, child === "shops" ? "shops" : "expense_categories", b.id);
  if (family === "stock-adjustments") return scope(`/api/stock-adjustments/${part(text(b.id))}`, "stock_adjustments", b.id);
  if (family === "stock-counts") return natural("/api/stock-counts", "stock_counts", text(b.month), text(b.accountId));
  if (family === "sales" && rawId === "profit-summary" && child === "cost-overrides") return natural("/api/sales/profit-summary/cost-overrides", "sales_profit_cost_overrides", text(b.month), text(b.accountId));
}

export async function mutationRows(request: Request): Promise<RowScope[]> {
  const path = new URL(request.url).pathname;
  if (request.method === "PATCH" && /^\/api\/orders\/[^/]+\/items$/.test(path)) {
    const parent = decodeURIComponent(path.split("/")[3]).trim();
    return array((await json(request)).items).map(i => item("orders",parent,text(i.id))).filter((r): r is RowScope => !!r);
  }
  const row = await mutationRow(request); return row ? [row] : [];
}
export async function batchRevision(request: Request): Promise<string> {
  const tokens = await rowTokens(await mutationRows(request));
  const values = tokens.map(t => [t.scope,t.token]).sort((a,b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
  return `"stock-batch-v1-${createHash("sha256").update(JSON.stringify(values)).digest("hex")}"`;
}

function viewedRows(request: Request, body: Json): RowScope[] {
  const path = new URL(request.url).pathname;
  const rows: (RowScope | undefined)[] = [];
  const add = (path: string, table: Table, id: unknown) => rows.push(scope(path + part(text(id)), table, id));
  if (/^\/api\/orders(?:\/[^/]+)?$/.test(path) && !path.endsWith("with-images")) {
    for (const o of body.order ? [record(body.order)] : array(body.orders)) {
      add("/api/orders/", "orders", o.id);
      for (const i of array(o.productImages)) rows.push(item("orders", text(o.id), text(i.id)));
    }
  }
  if (path === "/api/movements") for (const m of array(body.records)) add("/api/movements/", "movements", text(m.id).toUpperCase());
  if (/^\/api\/movements\/[^/]+(?:\/items\/[^/]+(?:\/image)?)?$/.test(path)) {
    const id = decodeURIComponent(path.split("/")[3]).trim().toUpperCase();
    if (request.method === "GET") rows.push(scope(`/api/movements/${part(id)}`, "movements", id));
    for (const i of array(body.records)) rows.push(item("movements", text(i.movementMasterId), text(i.movementId)));
  }
  if (/^\/api\/shipments(?:\/[^/]+)?$/.test(path)) for (const s of body.shipment ? [record(body.shipment)] : array(body.shipments)) add("/api/shipments/", "shipments", s.id);
  if (path.startsWith("/api/employees")) {
    for (const e of array(body.employees)) add("/api/employees/", "employees", e.id);
    for (const t of array(body.timesheets)) add("/api/employees/timesheets/", "employee_timesheets", t.id);
    for (const a of array(body.advances)) add("/api/employees/advances/", "employee_advances", a.id);
  }
  if (path.startsWith("/api/expenses")) {
    for (const e of array(body.expenses)) add("/api/expenses/", "expenses", e.id);
    for (const s of array(body.shops)) add("/api/expenses/masters/shops/", "shops", s.id);
    for (const c of array(body.categories)) add("/api/expenses/masters/categories/", "expense_categories", c.id);
    if (path === "/api/expenses/masters/shops" || path === "/api/expenses/masters/categories") for (const r of array(body.records)) add(path + "/", path.endsWith("shops") ? "shops" : "expense_categories", r.id);
  }
  if (path === "/api/stock-adjustments") for (const a of array(body.records)) add(path + "/", "stock_adjustments", a.id);
  if (path === "/api/stock-counts") for (const c of array(body.stockCounts)) rows.push(natural(path, "stock_counts", text(c.month), text(c.accountId)));
  // Profit reports expose editable month/shop cells, including absent overrides.
  if (path === "/api/sales/profit-summary") {
    const year = new URL(request.url).searchParams.get("year") || "";
    if (/^\d{4}$/.test(year)) for (const a of array(body.accounts)) for (let month = 1; month <= 12; month++) rows.push(natural(path + "/cost-overrides", "sales_profit_cost_overrides", `${year}-${String(month).padStart(2,"0")}`, text(a.id)));
  }
  return rows.filter((r): r is RowScope => !!r);
}

export async function rowTokens(rows: RowScope[]): Promise<{ scope: string; token: string }[]> {
  const unique = [...new Map(rows.map(r => [r.scope, r])).values()];
  const output: { scope: string; token: string }[] = [];
  for (const table of new Set(unique.map(r => r.table))) {
    const group = unique.filter(r => r.table === table);
    const naturalKey = ["stock_counts", "sales_profit_cost_overrides"].includes(table);
    const parentColumn = table === "order_items" ? '"orderId"' : table === "movement_details" ? '"movementMasterId"' : undefined;
    const match = naturalKey ? 't."month"=w.id AND t."accountId"=w.parent' : `${table === "movements" || table === "movement_details" ? "upper(t.id::text)=w.id" : "t.id::text=w.id"}${parentColumn ? ` AND ${table === "movement_details" ? `upper(t.${parentColumn})` : `t.${parentColumn}`}=w.parent` : ""}`;
    const result = await currentTransaction().query<{scope: string; id: string | null; revision: string | null}>(`SELECT w.scope,t.id::text,t.revision::text FROM jsonb_to_recordset($1::jsonb) w(scope text,id text,parent text) LEFT JOIN stock_operational.${table} t ON ${match} AND t."deletedAt" IS NULL ORDER BY w.scope,t.id::text`, [JSON.stringify(group)]);
    const byScope = new Map<string, (string | null)[][]>();
    for (const row of result.rows) { const values = byScope.get(row.scope) ?? []; values.push([row.id,row.revision]); byScope.set(row.scope,values); }
    for (const r of group) {
      const versions = byScope.get(r.scope) ?? [];
      output.push({scope:r.scope,token:`"stock-row-v1-${createHash("sha256").update(JSON.stringify([r.scope, versions])).digest("hex")}"`});
    }
  }
  return output;
}

export async function withRowTokens(request: Request, response: Response): Promise<Response> {
  if (!response.ok || request.headers.get("x-stock-edit-protocol") !== "row-v1") return response;
  response.headers.set("x-stock-edit-protocol", "row-v1");
  if (request.method === "HEAD" || !response.headers.get("content-type")?.includes("application/json")) return response;
  const body = record(await response.clone().json());
  const targets = ["GET","HEAD"].includes(request.method) ? [] : await mutationRows(request);
  const rows = await rowTokens([...viewedRows(request, body), ...targets]);
  return Response.json({...body, stockEditRows: rows}, {status:response.status,statusText:response.statusText,headers:response.headers});
}
