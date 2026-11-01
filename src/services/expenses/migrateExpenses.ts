import type { GoogleSheetRow, IGoogleRowsSheet, IGoogleSheetsService } from "@/externals/google/sheet";
import { CATEGORY_HEADERS, EXPENSE_HEADERS, SHOP_HEADERS } from "./types";
import { ExpenseError, readTable } from "./manageExpenses";

export function sourceExpenseRows(rows: GoogleSheetRow[]) {
  const headers = ["id", "month", "accountId", "amount", "note", "createdAt", "updatedAt", "createdBy", "scope", "category", "name"];
  if (rows[0]?.slice(0, headers.length).join("|") !== headers.join("|")) throw new ExpenseError("Unexpected source headers; rebuild stopped.");
  const records = rows.slice(1).filter(row => row.some(cell => String(cell ?? "").trim()));
  const ids = new Set<string>();
  for (const row of records) {
    const id = String(row[0] || ""), scope = String(row[8] || "SHOP");
    if (!id || ids.has(id) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(row[1])) || String(row[3] ?? "").trim() === "" || !Number.isFinite(Number(row[3])) || Number(row[3]) < 0 || !["SHOP", "SHARED"].includes(scope) || (scope === "SHOP" && !row[2])) throw new ExpenseError("Invalid or duplicate source expense record; rebuild stopped.");
    ids.add(id);
  }
  return records;
}
const cents = (amount: number) => Math.round(amount * 100);
// Only explicit named monetary breakdowns are accepted. Never guess missing amounts.
export function rebuildSourceExpenses(rows: GoogleSheetRow[]) {
  const result: { sourceId: string; row: GoogleSheetRow }[] = [];
  for (const row of sourceExpenseRows(rows)) {
    const scope = row[8] === "SHARED" ? "SHARED" : "SHOP";
    if (scope === "SHARED") {
      result.push({ sourceId: String(row[0]), row: [row[0], row[1], "", "", scope, row[9] || "OTHER", row[10] || "Shared expense", Number(row[3]), row[4] || "", row[5] || "", row[6] || "", row[7] || "web", ""] });
      continue;
    }
    const lines = String(row[4] || "").split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const parts = lines.map(line => {
      const match = line.match(/^-?\s*(.*?)\s*=>\s*([\d,]+(?:\.\d{1,2})?)\s*$/);
      if (!match) throw new ExpenseError(`Unrecognized expense breakdown for ${row[0]}; rebuild stopped.`);
      const label = match[1].trim();
      const category = /rent/i.test(label) ? "RENT" : /electri/i.test(label) ? "UTILITIES" : /salary/i.test(label) ? "SALARY" : "OTHER";
      return { label, category, amount: Number(match[2].replaceAll(",", "")) };
    });
    if (!parts.length || parts.reduce((sum, part) => sum + cents(part.amount), 0) !== cents(Number(row[3]))) throw new ExpenseError(`Breakdown does not match total for ${row[0]}; rebuild stopped.`);
    for (const [index, part] of parts.entries()) result.push({ sourceId: String(row[0]), row: [`${row[0]}-${index + 1}`, row[1], "", `SHOP-${row[2]}`, scope, part.category, part.label, part.amount, "", row[5] || "", row[6] || "", row[7] || "web", ""] });
  }
  return result;
}
async function initialize(sheet: IGoogleRowsSheet, headers: string[]) {
  await sheet.ensureExists?.();
  const rows = await sheet.readRows();
  if (!rows.length || rows.every(row => row.every(cell => cell === "" || cell === null))) await sheet.updateRows(`A1:${String.fromCharCode(64 + headers.length)}1`, [headers]);
  else await readTable(sheet, headers);
}
export async function rebuildExpenseData(service: IGoogleSheetsService, sourceRows: GoogleSheetRow[], accounts: { id: string; shopName: string }[]) {
  const source = sourceExpenseRows(sourceRows), rebuilt = rebuildSourceExpenses(sourceRows), now = new Date().toISOString();
  // Validate all breakdowns before creating or writing any destination table.
  await initialize(service.expenses, EXPENSE_HEADERS); await initialize(service.expenseCategories, CATEGORY_HEADERS); await initialize(service.shops, SHOP_HEADERS);
  const shopRows = await readTable(service.shops, SHOP_HEADERS);
  const accountNames = new Map(accounts.map(account => [account.id, account.shopName]));
  for (const row of source) if (row[2] && !accountNames.has(String(row[2]))) accountNames.set(String(row[2]), String(row[2]));
  for (const [accountId, name] of accountNames) {
    const existing = shopRows.slice(1).find(row => String(row[3]) === accountId);
    if (!existing) {
      const shop = [`SHOP-${accountId}`, name, true, accountId, now, now];
      if (shopRows.some(row => row[0] === shop[0])) throw new ExpenseError("Shop ID collision; rebuild stopped.");
      await service.shops.appendRows("A:F", [shop]); shopRows.push(shop);
    }
  }
  const categoryRows = await readTable(service.expenseCategories, CATEGORY_HEADERS);
  const names = new Map([["RENT", "Rent"], ["UTILITIES", "Utilities"], ["SALARY", "Salary"], ["OTHER", "Other"]]);
  for (const { row } of rebuilt) if (!names.has(String(row[5]))) names.set(String(row[5]), String(row[5]));
  for (const [id, name] of names) if (!categoryRows.slice(1).some(row => row[0] === id)) { const category = [id, name, true, now, now]; await service.expenseCategories.appendRows("A:E", [category]); categoryRows.push(category); }
  const target = await readTable(service.expenses, EXPENSE_HEADERS); let added = 0;
  for (const { row } of rebuilt) {
    if (row[4] === "SHOP") {
      const accountId = String(row[3]).slice("SHOP-".length);
      row[3] = shopRows.find(shop => String(shop[3]) === accountId)?.[0] || row[3];
    }
    if (target.some(entry => entry[0] === row[0])) continue;
    await service.expenses.appendRows("A:M", [row]); target.push(row); added++;
  }
  const stored = (await readTable(service.expenses, EXPENSE_HEADERS)).slice(1);
  for (const { row } of rebuilt) {
    const matches = stored.filter(entry => entry[0] === row[0]);
    if (matches.length !== 1 || matches[0].slice(0, 9).map(String).join("|") !== row.slice(0, 9).map(String).join("|") || matches[0][12]) throw new ExpenseError(`Reconciliation failed for ${row[0]}. Source records were not changed.`, 409);
  }
  return { sourceCount: source.length, rebuiltCount: rebuilt.length, added, matched: rebuilt.length, total: source.reduce((sum, row) => sum + cents(Number(row[3])), 0) / 100 };
}
