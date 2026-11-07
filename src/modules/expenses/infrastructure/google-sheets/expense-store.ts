import "server-only";
import type { GoogleSheetRow, IGoogleRowsSheet } from "@/infrastructure/persistence/google-sheets/types";
import type { ExpenseEntry, ExpenseWrite, MasterEntry, MasterWrite, ExpenseWriter, ExpenseMastersWriter } from "../../application/ports/expense-store";
import { ExpenseError } from "../../domain/rules";
import { CATEGORY_HEADERS, EXPENSE_HEADERS, SHOP_HEADERS } from "./expenses/const";

export type ExpenseSheets = { readonly expenses: IGoogleRowsSheet; readonly shops: IGoogleRowsSheet; readonly expenseCategories: IGoogleRowsSheet };
export async function readTable(sheet: IGoogleRowsSheet, headers: string[]): Promise<GoogleSheetRow[]> {
  const rows = await sheet.readRows();
  if (rows[0]?.slice(0, headers.length).join("|") !== headers.join("|")) {
    throw new ExpenseError("Expense storage is unavailable or has an unexpected schema. Check the configured worksheet names and headers.", 503);
  }
  return rows;
}

const expenseFields = ["id", "month", "expenseDate", "shopId", "scope", "categoryId", "name", "amount", "note", "createdAt", "updatedAt", "createdBy", "deletedAt"] as const;
// Views retain uncoerced values and defer access until the original use-case phase.
// The location and original row never cross the persistence port.
export class GoogleSheetsExpenseStore implements ExpenseWriter, ExpenseMastersWriter {
  private readonly locations = new WeakMap<object, { row: GoogleSheetRow; number: number }>();
  private readonly masterSheets = new Map<string, IGoogleRowsSheet>();
  constructor(private readonly sheets: ExpenseSheets) {}

  readExpenses(): Promise<ExpenseEntry[]> {
    return readTable(this.sheets.expenses, EXPENSE_HEADERS).then(rows => rows.slice(1).map((row, index) => {
      const entry = Object.fromEntries(expenseFields.map((name, column) => [name, { enumerable: true, get: () => row[column] }]));
      const view = Object.defineProperties({}, { ...entry, submissionKey: { enumerable: true, get: () => row.slice(1, 9).map(String).join("|") } }) as ExpenseEntry;
      this.locations.set(view, { row, number: index + 2 });
      return view;
    }));
  }
  readShops(): Promise<MasterEntry[]> { return this.readMasters(this.sheets.shops, SHOP_HEADERS, true); }
  readCategories(): Promise<MasterEntry[]> { return this.readMasters(this.sheets.expenseCategories, CATEGORY_HEADERS, false); }
  private readMasters(sheet: IGoogleRowsSheet, headers: string[], shop: boolean): Promise<MasterEntry[]> {
    this.masterSheets.set(shop ? "shops" : "categories", sheet);
    return readTable(sheet, headers).then(rows => rows.slice(1).map((row, index) => {
      const view: MasterEntry = {
        get id() { return row[0]; }, get name() { return row[1]; }, get active() { return row[2]; },
        get loyverseAccountId() { return shop ? row[3] : undefined; },
        get createdAt() { return row[shop ? 4 : 3]; }, get updatedAt() { return row[shop ? 5 : 4]; },
      };
      this.locations.set(view, { row, number: index + 2 }); return view;
    }));
  }
  async writeExpense(previous: ExpenseEntry | undefined, value: ExpenseWrite): Promise<void> {
    const row = [value.id, value.month, value.expenseDate, value.shopId, value.scope, value.categoryId, value.name, value.amount, value.note, value.createdAt, value.updatedAt, value.createdBy, value.deletedAt];
    if (previous) { const at = this.locations.get(previous)!.number; await this.sheets.expenses.updateRows(`A${at}:M${at}`, [row]); }
    else await this.sheets.expenses.appendRows("A:M", [row]);
  }
  async softDeleteExpense(previous: ExpenseEntry, now: () => string): Promise<void> {
    const location = this.locations.get(previous)!, row = [...location.row];
    row[10] = row[12] = now();
    await this.sheets.expenses.updateRows(`A${location.number}:M${location.number}`, [row]);
  }
  async writeMaster(kind: "shops" | "categories", previous: MasterEntry | undefined, value: MasterWrite): Promise<void> {
    const shop = kind === "shops", sheet = this.masterSheets.get(kind)!;
    const row = shop ? [value.id, value.name, value.active, value.loyverseAccountId, value.createdAt, value.updatedAt] : [value.id, value.name, value.active, value.createdAt, value.updatedAt];
    if (previous) { const at = this.locations.get(previous)!.number; await sheet.updateRows(`A${at}:${shop ? "F" : "E"}${at}`, [row]); }
    else await sheet.appendRows(shop ? "A:F" : "A:E", [row]);
  }
}
