import { randomUUID } from "node:crypto";
import type { GoogleSheetRow, IGoogleRowsSheet, IGoogleSheetsService } from "@/externals/google/sheet";
import { CATEGORY_HEADERS, EXPENSE_HEADERS, SHOP_HEADERS, type Expense, type ExpenseCategory, type ExpenseInput, type ExpenseShop } from "./types";

export class ExpenseError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
const text = (value: unknown) => String(value ?? "").trim();
const active = (value: unknown) => text(value).toLowerCase() === "true";
export const validMonth = (value: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export async function readTable(sheet: IGoogleRowsSheet, headers: string[]): Promise<GoogleSheetRow[]> {
  const rows = await sheet.readRows();
  if (rows[0]?.slice(0, headers.length).join("|") !== headers.join("|")) {
    throw new ExpenseError("Expense storage is unavailable or has an unexpected schema. Check the configured worksheet names and headers.", 503);
  }
  return rows;
}
export async function listExpenseCategories(service: IGoogleSheetsService): Promise<ExpenseCategory[]> {
  return (await readTable(service.expenseCategories, CATEGORY_HEADERS)).slice(1).filter(row => row[0]).map(row => ({ id: text(row[0]), name: text(row[1]), active: active(row[2]), createdAt: text(row[3]), updatedAt: text(row[4]) }));
}
export async function listExpenseShops(service: IGoogleSheetsService): Promise<ExpenseShop[]> {
  return (await readTable(service.shops, SHOP_HEADERS)).slice(1).filter(row => row[0]).map(row => ({ id: text(row[0]), name: text(row[1]), active: active(row[2]), loyverseAccountId: text(row[3]), createdAt: text(row[4]), updatedAt: text(row[5]) }));
}
export async function listExpenses({ googleSheetsService: service, year }: { googleSheetsService: IGoogleSheetsService; year: string }): Promise<Expense[]> {
  const [rows, shops, categories] = await Promise.all([readTable(service.expenses, EXPENSE_HEADERS), listExpenseShops(service), listExpenseCategories(service)]);
  return rows.slice(1).filter(row => row[0] && !text(row[12]) && text(row[1]).startsWith(`${year}-`)).map(row => ({
    id: text(row[0]), month: text(row[1]), expenseDate: text(row[2]), shopId: text(row[3]), scope: text(row[4]) === "SHARED" ? "SHARED" as const : "SHOP" as const,
    categoryId: text(row[5]), name: text(row[6]), amount: Number(row[7]), note: text(row[8]), createdAt: text(row[9]), updatedAt: text(row[10]), createdBy: text(row[11]), deletedAt: text(row[12]),
    accountId: shops.find(shop => shop.id === text(row[3]))?.loyverseAccountId || text(row[3]),
    category: categories.find(category => category.id === text(row[5]))?.name || text(row[5]),
  })).sort((a, b) => `${b.month}:${b.expenseDate}:${b.createdAt}`.localeCompare(`${a.month}:${a.expenseDate}:${a.createdAt}`));
}
export async function saveExpense(service: IGoogleSheetsService, input: ExpenseInput, createdBy = "web"): Promise<string> {
  const { month, expenseDate, scope, shopId, categoryId } = input;
  if (input.requestId && !/^[a-f0-9-]{36}$/i.test(input.requestId)) throw new ExpenseError("Invalid request identifier.");
  if (!validMonth(month) || !["SHOP", "SHARED"].includes(scope) || !input.name.trim() || input.name.trim().length > 100 || input.note.length > 200 || !Number.isFinite(input.amount) || input.amount < 0 || input.amount > 1e12 || Math.abs(input.amount * 100 - Math.round(input.amount * 100)) > 0.001) throw new ExpenseError("Enter valid expense details (amount must have at most two decimal places).");
  if (expenseDate && !validDate(expenseDate)) throw new ExpenseError("Enter a real expense date.");
  if (scope === "SHARED" && shopId) throw new ExpenseError("Shared expenses cannot belong to a shop.");
  const [rows, shops, categories] = await Promise.all([readTable(service.expenses, EXPENSE_HEADERS), listExpenseShops(service), listExpenseCategories(service)]);
  const creationId = !input.id && input.requestId ? `EXP-${input.requestId}` : undefined;
  const alreadySaved = creationId ? rows.find(row => row[0] === creationId) : undefined;
  if (alreadySaved) {
    const expected = [month, expenseDate, shopId, scope, categoryId, input.name.trim(), input.amount, input.note.trim()];
    if (!alreadySaved[12] && alreadySaved.slice(1, 9).map(String).join("|") === expected.map(String).join("|")) return creationId!;
    throw new ExpenseError("This form already saved an entry. Refresh before making another change.", 409);
  }
  const index = input.id ? rows.findIndex((row, i) => i > 0 && text(row[0]) === input.id && !text(row[12])) : -1;
  if (input.id && index < 0) throw new ExpenseError("Expense not found.", 404);
  const old = index >= 0 ? rows[index] : undefined;
  const shop = shops.find(row => row.id === shopId);
  if (scope === "SHOP" && (!shop || (!shop.active && text(old?.[3]) !== shopId))) throw new ExpenseError("Select an active shop.");
  const category = categories.find(row => row.id === categoryId);
  if (!category || (!category.active && text(old?.[5]) !== categoryId)) throw new ExpenseError("Select an active category.");
  const now = new Date().toISOString(), id = input.id || creationId || `EXP-${randomUUID()}`;
  const row = [id, month, expenseDate, shopId, scope, categoryId, input.name.trim(), input.amount, input.note.trim(), text(old?.[9]) || now, now, text(old?.[11]) || createdBy, ""];
  if (index >= 0) await service.expenses.updateRows(`A${index + 1}:M${index + 1}`, [row]);
  else await service.expenses.appendRows("A:M", [row]);
  return id;
}
export async function removeExpense(service: IGoogleSheetsService, id: string): Promise<void> {
  const rows = await readTable(service.expenses, EXPENSE_HEADERS);
  const index = rows.findIndex((row, i) => i > 0 && text(row[0]) === id && !text(row[12]));
  if (index < 0) throw new ExpenseError("Expense not found.", 404);
  const row = [...rows[index]]; row[10] = row[12] = new Date().toISOString();
  await service.expenses.updateRows(`A${index + 1}:M${index + 1}`, [row]);
}
export async function saveExpenseMaster(service: IGoogleSheetsService, kind: "categories" | "shops", input: { id?: string; name: string; active: boolean; loyverseAccountId?: string }): Promise<string> {
  const name = input.name.trim();
  if (!name || name.length > 100 || typeof input.active !== "boolean") throw new ExpenseError("Enter a name and active status.");
  const isShop = kind === "shops", sheet = isShop ? service.shops : service.expenseCategories, headers = isShop ? SHOP_HEADERS : CATEGORY_HEADERS;
  const rows = await readTable(sheet, headers);
  const index = input.id ? rows.findIndex((row, i) => i > 0 && text(row[0]) === input.id) : -1;
  if (input.id && index < 0) throw new ExpenseError("Master record not found.", 404);
  if (rows.some((row, i) => i > 0 && i !== index && text(row[1]).toLowerCase() === name.toLowerCase())) throw new ExpenseError("A record with this name already exists.", 409);
  const mapping = text(input.loyverseAccountId);
  if (isShop && mapping && rows.some((row, i) => i > 0 && i !== index && text(row[3]) === mapping)) throw new ExpenseError("This Loyverse account is already mapped to another shop.", 409);
  const now = new Date().toISOString(), id = input.id || `${isShop ? "SHOP" : "CAT"}-${randomUUID()}`;
  const row = isShop ? [id, name, input.active, mapping, text(rows[index]?.[4]) || now, now] : [id, name, input.active, text(rows[index]?.[3]) || now, now];
  if (index >= 0) await sheet.updateRows(`A${index + 1}:${isShop ? "F" : "E"}${index + 1}`, [row]);
  else await sheet.appendRows(isShop ? "A:F" : "A:E", [row]);
  return id;
}
