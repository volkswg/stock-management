import "server-only";
import { randomUUID } from "node:crypto";
import type { ExpenseInput } from "./contracts";
import { listExpenses as executeListExpenses, listExpenseShops as executeListShops, listExpenseCategories as executeListCategories, saveExpense as executeSaveExpense, removeExpense as executeRemoveExpense, saveExpenseMaster as executeSaveMaster } from "./application/manage-expenses";
import { GoogleSheetsExpenseStore, type ExpenseSheets } from "./infrastructure/google-sheets/expense-store";
export { ExpenseError, validMonth } from "./domain/rules";
export { readTable } from "./infrastructure/google-sheets/expense-store";

const runtime = { now: () => new Date().toISOString(), createId: () => randomUUID() };
export async function listExpenses({ googleSheetsService, year }: { googleSheetsService: ExpenseSheets; year: string }) {
  return executeListExpenses({ store: new GoogleSheetsExpenseStore(googleSheetsService), year });
}
export async function listExpenseShops(service: ExpenseSheets) {
  return executeListShops(new GoogleSheetsExpenseStore(service));
}
export async function listExpenseCategories(service: ExpenseSheets) {
  return executeListCategories(new GoogleSheetsExpenseStore(service));
}
export async function saveExpense(service: ExpenseSheets, input: ExpenseInput, createdBy = "web") {
  return executeSaveExpense(new GoogleSheetsExpenseStore(service), input, runtime, createdBy);
}
export async function removeExpense(service: ExpenseSheets, id: string): Promise<void> {
  await executeRemoveExpense(new GoogleSheetsExpenseStore(service), id, runtime);
}
export async function saveExpenseMaster(service: ExpenseSheets, kind: "categories" | "shops", input: { id?: string; name: string; active: boolean; loyverseAccountId?: string }) {
  return executeSaveMaster(new GoogleSheetsExpenseStore(service), kind, input, runtime);
}
