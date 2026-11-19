import "server-only";
import type { NativeRecord } from "@/infrastructure/persistence/postgres/native-records";
import type { ExpenseEntry, ExpenseWrite, MasterEntry, MasterWrite, ExpenseWriter, ExpenseMastersWriter } from "../../application/ports/expense-store";
import type { Storage } from "./storage";
const expenseFields = ["id", "month", "expenseDate", "shopId", "scope", "categoryId", "name", "amount", "note", "createdAt", "updatedAt", "createdBy", "deletedAt"] as const;
export class PostgresExpenseStore implements ExpenseWriter, ExpenseMastersWriter {
  private readonly originals = new WeakMap<object, NativeRecord>();
  constructor(private readonly storage: Storage) {}
  async readExpenses(): Promise<ExpenseEntry[]> {
    return (await this.storage.expenses.all()).map(record => {
      const view = Object.defineProperties({}, {
        ...Object.fromEntries(expenseFields.map(name => [name, { enumerable: true, get: () => record[name] }])),
        submissionKey: { enumerable: true, get: () => [record.month, record.expenseDate, record.shopId, record.scope, record.categoryId, record.name, record.amount, record.note].map(String).join("|") },
      }) as ExpenseEntry;
      this.originals.set(view, record); return view;
    });
  }
  readShops() { return this.readMasters(true); }
  readCategories() { return this.readMasters(false); }
  private async readMasters(shop: boolean): Promise<MasterEntry[]> {
    const table = shop ? this.storage.shops : this.storage.expenseCategories;
    return (await table.all()).map(record => {
      const view: MasterEntry = { get id() { return record.id; }, get name() { return record.name; }, get active() { return record.active; }, get loyverseAccountId() { return shop ? (record as NativeRecord).loyverseAccountId : undefined; }, get createdAt() { return record.createdAt; }, get updatedAt() { return record.updatedAt; } };
      this.originals.set(view, record); return view;
    });
  }
  async writeExpense(previous: ExpenseEntry | undefined, value: ExpenseWrite) {
    const record = { id: value.id, month: value.month, expenseDate: value.expenseDate, shopId: value.shopId, scope: value.scope, categoryId: value.categoryId, name: value.name, amount: value.amount, note: value.note, createdAt: value.createdAt, updatedAt: value.updatedAt, createdBy: value.createdBy, deletedAt: value.deletedAt };
    if (previous) await this.storage.expenses.update(this.originals.get(previous)! as Parameters<Storage["expenses"]["update"]>[0], record);
    else await this.storage.expenses.insert(record);
  }
  async softDeleteExpense(previous: ExpenseEntry, now: () => string) {
    const timestamp = now(); await this.storage.expenses.update(this.originals.get(previous)! as Parameters<Storage["expenses"]["update"]>[0], { updatedAt: timestamp, deletedAt: timestamp });
  }
  async writeMaster(kind: "shops" | "categories", previous: MasterEntry | undefined, value: MasterWrite) {
    const record = { id: value.id, name: value.name, active: value.active, createdAt: value.createdAt, updatedAt: value.updatedAt };
    if (kind === "shops") {
      const next = { ...record, loyverseAccountId: value.loyverseAccountId };
      if (previous) await this.storage.shops.update(this.originals.get(previous)! as Parameters<Storage["shops"]["update"]>[0], next); else await this.storage.shops.insert(next);
    } else if (previous) await this.storage.expenseCategories.update(this.originals.get(previous)! as Parameters<Storage["expenseCategories"]["update"]>[0], record); else await this.storage.expenseCategories.insert(record);
  }
}

export type ExpenseStorage = Storage;
