import "server-only";
import { NativeRecords } from "@/infrastructure/persistence/postgres/native-records";

export function expensesTables() {
  return {
    expenses: new NativeRecords("expenses", {
      id: { column: "id", kind: "text" },
      month: { column: "month", kind: "text" },
      expenseDate: { column: "expenseDate", kind: "text" },
      shopId: { column: "shopId", kind: "text" },
      scope: { column: "scope", kind: "text" },
      categoryId: { column: "categoryId", kind: "text" },
      name: { column: "name", kind: "text" },
      amount: { column: "amount", kind: "numeric" },
      note: { column: "note", kind: "text" },
      createdAt: { column: "createdAt", kind: "timestamp" },
      updatedAt: { column: "updatedAt", kind: "timestamp" },
      createdBy: { column: "createdBy", kind: "text" },
      deletedAt: { column: "deletedAt", kind: "timestamp" },
    } as const),
    expenseCategories: new NativeRecords("expense_categories", {
      id: { column: "id", kind: "text" },
      name: { column: "name", kind: "text" },
      active: { column: "active", kind: "boolean", trimBoolean: true },
      createdAt: { column: "createdAt", kind: "timestamp" },
      updatedAt: { column: "updatedAt", kind: "timestamp" },
    } as const),
    shops: new NativeRecords("shops", {
      id: { column: "id", kind: "text" },
      name: { column: "name", kind: "text" },
      active: { column: "active", kind: "boolean", trimBoolean: true },
      loyverseAccountId: { column: "loyverseAccountId", kind: "text" },
      createdAt: { column: "createdAt", kind: "timestamp" },
      updatedAt: { column: "updatedAt", kind: "timestamp" },
    } as const),
  };
}
