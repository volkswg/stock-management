// Stored values stay uncoerced until the use case reaches the original decision.
// Locations, headers, worksheet rows and column ranges remain adapter-private.
export type ExpenseEntry = {
  readonly id: unknown; readonly month: unknown; readonly expenseDate: unknown;
  readonly shopId: unknown; readonly scope: unknown; readonly categoryId: unknown;
  readonly name: unknown; readonly amount: unknown; readonly note: unknown;
  readonly createdAt: unknown; readonly updatedAt: unknown; readonly createdBy: unknown;
  readonly deletedAt: unknown;
  readonly submissionKey: string;
};
export type MasterEntry = {
  readonly id: unknown; readonly name: unknown; readonly active: unknown;
  readonly loyverseAccountId: unknown; readonly createdAt: unknown; readonly updatedAt: unknown;
};
export type ExpenseWrite = { id: string; month: string; expenseDate: string; shopId: string; scope: string; categoryId: string; name: string; amount: number; note: string; createdAt: string; updatedAt: string; createdBy: string; deletedAt: string };
export type MasterWrite = { id: string; name: string; active: boolean; loyverseAccountId: string; createdAt: string; updatedAt: string };
export interface ExpenseReader { readExpenses(): Promise<ExpenseEntry[]>; }
export interface ExpenseMastersReader { readShops(): Promise<MasterEntry[]>; readCategories(): Promise<MasterEntry[]>; }
export interface ExpenseWriter extends ExpenseReader {
  writeExpense(previous: ExpenseEntry | undefined, value: ExpenseWrite): Promise<void>;
  softDeleteExpense(previous: ExpenseEntry, now: () => string): Promise<void>;
}
export interface ExpenseMastersWriter extends ExpenseMastersReader {
  writeMaster(kind: 'shops' | 'categories', previous: MasterEntry | undefined, value: MasterWrite): Promise<void>;
}
export type ExpenseRuntime = { now(): string; createId(): string };
