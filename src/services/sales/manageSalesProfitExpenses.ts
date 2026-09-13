import { randomUUID } from "node:crypto";
import {
  SALES_PROFIT_EXPENSE_HEADERS,
  type GoogleSheetRow,
  type IGoogleSheetsService,
} from "@/externals/google/sheet";

export type SalesProfitExpense = {
  id: string;
  month: string;
  accountId: string;
  amount: number;
  note: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  scope: "SHOP" | "SHARED";
  category: string;
  name: string;
};

export async function listSalesProfitExpenses({
  googleSheetsService,
  year,
}: {
  googleSheetsService: IGoogleSheetsService;
  year: string;
}): Promise<SalesProfitExpense[]> {
  await ensureExpenseHeaders(googleSheetsService);
  const rows = await googleSheetsService.salesProfitExpenses.readRows();
  return rows
    .map(mapExpenseRow)
    .filter((expense): expense is SalesProfitExpense => Boolean(expense))
    .filter((expense) => expense.month.startsWith(`${year}-`))
    .sort((left, right) =>
      `${left.month}:${left.accountId}`.localeCompare(
        `${right.month}:${right.accountId}`,
      ),
    );
}

export async function setSalesProfitExpense({
  accountId,
  amount,
  createdBy,
  googleSheetsService,
  month,
  note,
}: {
  accountId: string;
  amount: number;
  createdBy: string;
  googleSheetsService: IGoogleSheetsService;
  month: string;
  note: string;
}): Promise<SalesProfitExpense> {
  await ensureExpenseHeaders(googleSheetsService);
  const rows = await googleSheetsService.salesProfitExpenses.readRows();
  const rowIndex = rows.findIndex(
    (row, index) =>
      index > 0 &&
      toStringValue(row[1]) === month &&
      toStringValue(row[2]) === accountId,
  );
  const now = new Date().toISOString();
  if (rowIndex >= 0) {
    const current = mapExpenseRow(rows[rowIndex]);
    if (current) {
      const expense: SalesProfitExpense = {
        ...current,
        amount,
        note,
        scope: "SHOP",
        updatedAt: now,
      };
      await googleSheetsService.salesProfitExpenses.updateRows(
        `A${rowIndex + 1}:K${rowIndex + 1}`,
        [expenseToRow(expense)],
      );
      return expense;
    }
  }

  const expense: SalesProfitExpense = {
    id: `SPE-${randomUUID()}`,
    month,
    accountId,
    amount,
    note,
    createdAt: now,
    updatedAt: now,
    createdBy,
    scope: "SHOP",
    category: "",
    name: "",
  };
  await googleSheetsService.salesProfitExpenses.appendRows("A:K", [
    expenseToRow(expense),
  ]);
  return expense;
}

export async function saveSalesProfitSharedExpense({
  amount,
  category,
  createdBy,
  googleSheetsService,
  id,
  month,
  name,
  note,
}: {
  amount: number;
  category: string;
  createdBy: string;
  googleSheetsService: IGoogleSheetsService;
  id?: string;
  month: string;
  name: string;
  note: string;
}): Promise<SalesProfitExpense> {
  await ensureExpenseHeaders(googleSheetsService);
  const rows = await googleSheetsService.salesProfitExpenses.readRows();
  const rowIndex = id
    ? rows.findIndex((row, index) => index > 0 && toStringValue(row[0]) === id)
    : -1;
  const now = new Date().toISOString();
  if (id && rowIndex < 0) throw new Error("Shared expense not found.");

  if (rowIndex >= 0) {
    const current = mapExpenseRow(rows[rowIndex]);
    if (!current || current.scope !== "SHARED") {
      throw new Error("Shared expense not found.");
    }
    const expense: SalesProfitExpense = {
      ...current,
      amount,
      category,
      month,
      name,
      note,
      updatedAt: now,
    };
    await googleSheetsService.salesProfitExpenses.updateRows(
      `A${rowIndex + 1}:K${rowIndex + 1}`,
      [expenseToRow(expense)],
    );
    return expense;
  }

  const expense: SalesProfitExpense = {
    id: `SPE-${randomUUID()}`,
    month,
    accountId: "",
    amount,
    note,
    createdAt: now,
    updatedAt: now,
    createdBy,
    scope: "SHARED",
    category,
    name,
  };
  await googleSheetsService.salesProfitExpenses.appendRows("A:K", [
    expenseToRow(expense),
  ]);
  return expense;
}

export async function removeSalesProfitSharedExpense({
  googleSheetsService,
  id,
}: {
  googleSheetsService: IGoogleSheetsService;
  id: string;
}): Promise<boolean> {
  await ensureExpenseHeaders(googleSheetsService);
  const rows = await googleSheetsService.salesProfitExpenses.readRows();
  const rowIndex = rows.findIndex(
    (row, index) => index > 0 && toStringValue(row[0]) === id,
  );
  if (rowIndex < 0) return false;
  const current = mapExpenseRow(rows[rowIndex]);
  if (!current || current.scope !== "SHARED") return false;

  await googleSheetsService.salesProfitExpenses.updateRows(
    `A${rowIndex + 1}:K${rowIndex + 1}`,
    [Array.from({ length: SALES_PROFIT_EXPENSE_HEADERS.length }, () => "")],
  );
  return true;
}

async function ensureExpenseHeaders(
  googleSheetsService: IGoogleSheetsService,
): Promise<void> {
  await googleSheetsService.salesProfitExpenses.ensureExists?.();
  const rows = await googleSheetsService.salesProfitExpenses.readRows("A1:K1");
  if (rows[0]?.join("|") !== SALES_PROFIT_EXPENSE_HEADERS.join("|")) {
    await googleSheetsService.salesProfitExpenses.updateRows("A1:K1", [
      SALES_PROFIT_EXPENSE_HEADERS,
    ]);
  }
}

function mapExpenseRow(row: GoogleSheetRow): SalesProfitExpense | null {
  if (!row.length || row[0] === "id") return null;
  const id = toStringValue(row[0]);
  const month = toStringValue(row[1]);
  const accountId = toStringValue(row[2]);
  if (!id || !month) return null;
  const scope = toStringValue(row[8]) === "SHARED" ? "SHARED" : "SHOP";
  if (scope === "SHOP" && !accountId) return null;
  return {
    id,
    month,
    accountId,
    amount: toNumberValue(row[3]),
    note: toStringValue(row[4]),
    createdAt: toStringValue(row[5]),
    updatedAt: toStringValue(row[6]),
    createdBy: toStringValue(row[7]),
    scope,
    category: toStringValue(row[9]),
    name: toStringValue(row[10]),
  };
}

function expenseToRow(expense: SalesProfitExpense): GoogleSheetRow {
  return [
    expense.id,
    expense.month,
    expense.accountId,
    expense.amount,
    expense.note,
    expense.createdAt,
    expense.updatedAt,
    expense.createdBy,
    expense.scope,
    expense.category,
    expense.name,
  ];
}

function toStringValue(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function toNumberValue(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}
