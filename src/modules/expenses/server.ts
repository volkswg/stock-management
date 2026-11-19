import "server-only";
import { randomUUID } from "node:crypto";
import type { ExpenseInput } from "./contracts";
import { listExpenses as executeListExpenses, listExpenseShops as executeListShops, listExpenseCategories as executeListCategories, saveExpense as executeSaveExpense, removeExpense as executeRemoveExpense, saveExpenseMaster as executeSaveMaster } from "./application/manage-expenses";
import { PostgresExpenseStore, type ExpenseStorage } from "./infrastructure/postgres/expense-store";
export { ExpenseError, validMonth } from "./domain/rules";

const runtime = { now: () => new Date().toISOString(), createId: () => randomUUID() };
export async function listExpenses({ storage, year }: { storage: ExpenseStorage; year: string }) {
  return executeListExpenses({ store: new PostgresExpenseStore(storage), year });
}
export async function listExpenseShops(service: ExpenseStorage) {
  return executeListShops(new PostgresExpenseStore(service));
}
export async function listExpenseCategories(service: ExpenseStorage) {
  return executeListCategories(new PostgresExpenseStore(service));
}
export async function saveExpense(service: ExpenseStorage, input: ExpenseInput, createdBy = "web") {
  return executeSaveExpense(new PostgresExpenseStore(service), input, runtime, createdBy);
}
export async function removeExpense(service: ExpenseStorage, id: string): Promise<void> {
  await executeRemoveExpense(new PostgresExpenseStore(service), id, runtime);
}
export async function saveExpenseMaster(service: ExpenseStorage, kind: "categories" | "shops", input: { id?: string; name: string; active: boolean; loyverseAccountId?: string }) {
  return executeSaveMaster(new PostgresExpenseStore(service), kind, input, runtime);
}
