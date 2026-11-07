import type { Expense, ExpenseCategory, ExpenseShop, ExpenseInput } from "../contracts";
import { ExpenseError, validMonth, validDate } from "../domain/rules";
import type { ExpenseReader, ExpenseMastersReader, ExpenseWriter, ExpenseMastersWriter, ExpenseRuntime } from "./ports/expense-store";

const text = (value: unknown) => String(value ?? "").trim();
const active = (value: unknown) => text(value).toLowerCase() === "true";
export async function listExpenseCategories(store: Pick<ExpenseMastersReader, "readCategories">): Promise<ExpenseCategory[]> {
  return (await store.readCategories()).filter(row => row.id).map(row => ({ id: text(row.id), name: text(row.name), active: active(row.active), createdAt: text(row.createdAt), updatedAt: text(row.updatedAt) }));
}
export async function listExpenseShops(store: Pick<ExpenseMastersReader, "readShops">): Promise<ExpenseShop[]> {
  return (await store.readShops()).filter(row => row.id).map(row => ({ id: text(row.id), name: text(row.name), active: active(row.active), loyverseAccountId: text(row.loyverseAccountId), createdAt: text(row.createdAt), updatedAt: text(row.updatedAt) }));
}
export async function listExpenses({ store, year }: { store: ExpenseReader & ExpenseMastersReader; year: string }): Promise<Expense[]> {
  const [rows, shops, categories] = await Promise.all([store.readExpenses(), listExpenseShops(store), listExpenseCategories(store)]);
  return rows.filter(row => row.id && !text(row.deletedAt) && text(row.month).startsWith(`${year}-`)).map(row => ({
    id: text(row.id), month: text(row.month), expenseDate: text(row.expenseDate), shopId: text(row.shopId), scope: text(row.scope) === "SHARED" ? "SHARED" as const : "SHOP" as const,
    categoryId: text(row.categoryId), name: text(row.name), amount: Number(row.amount), note: text(row.note), createdAt: text(row.createdAt), updatedAt: text(row.updatedAt), createdBy: text(row.createdBy), deletedAt: text(row.deletedAt),
    accountId: shops.find(shop => shop.id === text(row.shopId))?.loyverseAccountId || text(row.shopId),
    category: categories.find(category => category.id === text(row.categoryId))?.name || text(row.categoryId),
  })).sort((a, b) => `${b.month}:${b.expenseDate}:${b.createdAt}`.localeCompare(`${a.month}:${a.expenseDate}:${a.createdAt}`));
}
export async function saveExpense(store: ExpenseWriter & ExpenseMastersReader, input: ExpenseInput, runtime: ExpenseRuntime, createdBy = "web"): Promise<string> {
  const { month, expenseDate, scope, shopId, categoryId } = input;
  if (input.requestId && !/^[a-f0-9-]{36}$/i.test(input.requestId)) throw new ExpenseError("Invalid request identifier.");
  if (!validMonth(month) || !["SHOP", "SHARED"].includes(scope) || !input.name.trim() || input.name.trim().length > 100 || input.note.length > 200 || !Number.isFinite(input.amount) || input.amount < 0 || input.amount > 1e12 || Math.abs(input.amount * 100 - Math.round(input.amount * 100)) > 0.001) throw new ExpenseError("Enter valid expense details (amount must have at most two decimal places).");
  if (expenseDate && !validDate(expenseDate)) throw new ExpenseError("Enter a real expense date.");
  if (scope === "SHARED" && shopId) throw new ExpenseError("Shared expenses cannot belong to a shop.");
  const [rows, shops, categories] = await Promise.all([store.readExpenses(), listExpenseShops(store), listExpenseCategories(store)]);
  const creationId = !input.id && input.requestId ? `EXP-${input.requestId}` : undefined;
  const alreadySaved = creationId ? rows.find(row => row.id === creationId) : undefined;
  if (alreadySaved) {
    const expected = [month, expenseDate, shopId, scope, categoryId, input.name.trim(), input.amount, input.note.trim()];
    if (!alreadySaved.deletedAt && alreadySaved.submissionKey === expected.map(String).join("|")) return creationId!;
    throw new ExpenseError("This form already saved an entry. Refresh before making another change.", 409);
  }
  const index = input.id ? rows.findIndex(row => text(row.id) === input.id && !text(row.deletedAt)) : -1;
  if (input.id && index < 0) throw new ExpenseError("Expense not found.", 404);
  const old = index >= 0 ? rows[index] : undefined;
  const shop = shops.find(row => row.id === shopId);
  if (scope === "SHOP" && (!shop || (!shop.active && text(old?.shopId) !== shopId))) throw new ExpenseError("Select an active shop.");
  const category = categories.find(row => row.id === categoryId);
  if (!category || (!category.active && text(old?.categoryId) !== categoryId)) throw new ExpenseError("Select an active category.");
  const now = runtime.now(), id = input.id || creationId || `EXP-${runtime.createId()}`;
  await store.writeExpense(old, { id, month, expenseDate, shopId, scope, categoryId, name: input.name.trim(), amount: input.amount, note: input.note.trim(), createdAt: text(old?.createdAt) || now, updatedAt: now, createdBy: text(old?.createdBy) || createdBy, deletedAt: "" });
  return id;
}
export async function removeExpense(store: ExpenseWriter, id: string, runtime: ExpenseRuntime): Promise<void> {
  const rows = await store.readExpenses();
  const index = rows.findIndex(row => text(row.id) === id && !text(row.deletedAt));
  if (index < 0) throw new ExpenseError("Expense not found.", 404);
  await store.softDeleteExpense(rows[index], () => runtime.now());
}
export async function saveExpenseMaster(store: ExpenseMastersWriter, kind: "categories" | "shops", input: { id?: string; name: string; active: boolean; loyverseAccountId?: string }, runtime: ExpenseRuntime): Promise<string> {
  const name = input.name.trim();
  if (!name || name.length > 100 || typeof input.active !== "boolean") throw new ExpenseError("Enter a name and active status.");
  const isShop = kind === "shops";
  const rows = await (isShop ? store.readShops() : store.readCategories());
  const index = input.id ? rows.findIndex(row => text(row.id) === input.id) : -1;
  if (input.id && index < 0) throw new ExpenseError("Master record not found.", 404);
  if (rows.some((row, i) => i !== index && text(row.name).toLowerCase() === name.toLowerCase())) throw new ExpenseError("A record with this name already exists.", 409);
  const mapping = text(input.loyverseAccountId);
  if (isShop && mapping && rows.some((row, i) => i !== index && text(row.loyverseAccountId) === mapping)) throw new ExpenseError("This Loyverse account is already mapped to another shop.", 409);
  const now = runtime.now(), id = input.id || `${isShop ? "SHOP" : "CAT"}-${runtime.createId()}`;
  await store.writeMaster(kind, index >= 0 ? rows[index] : undefined, { id, name, active: input.active, loyverseAccountId: mapping, createdAt: text(rows[index]?.createdAt) || now, updatedAt: now });
  return id;
}
