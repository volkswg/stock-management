import { randomUUID } from "node:crypto";
import {
  SALES_PROFIT_COST_OVERRIDE_HEADERS,
  type GoogleSheetRow,
  type IGoogleSheetsService,
} from "@/externals/google/sheet";

export type SalesProfitCostOverride = {
  id: string;
  month: string;
  accountId: string;
  averageItemCost: number;
  note: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
};

export async function listSalesProfitCostOverrides({
  googleSheetsService,
  year,
}: {
  googleSheetsService: IGoogleSheetsService;
  year: string;
}): Promise<SalesProfitCostOverride[]> {
  await ensureCostOverrideHeaders(googleSheetsService);
  const rows = await googleSheetsService.salesProfitCostOverrides.readRows();
  return rows
    .map(mapCostOverrideRow)
    .filter(
      (override): override is SalesProfitCostOverride => Boolean(override),
    )
    .filter((override) => override.month.startsWith(`${year}-`))
    .sort((left, right) =>
      `${left.month}:${left.accountId}`.localeCompare(
        `${right.month}:${right.accountId}`,
      ),
    );
}

export async function setSalesProfitCostOverride({
  accountId,
  averageItemCost,
  createdBy,
  googleSheetsService,
  month,
  note,
}: {
  accountId: string;
  averageItemCost: number;
  createdBy: string;
  googleSheetsService: IGoogleSheetsService;
  month: string;
  note: string;
}): Promise<SalesProfitCostOverride> {
  await ensureCostOverrideHeaders(googleSheetsService);
  const rows = await googleSheetsService.salesProfitCostOverrides.readRows();
  const rowIndex = rows.findIndex(
    (row, index) =>
      index > 0 &&
      toStringValue(row[1]) === month &&
      toStringValue(row[2]) === accountId,
  );
  const now = new Date().toISOString();
  if (rowIndex >= 0) {
    const current = mapCostOverrideRow(rows[rowIndex]);
    if (current) {
      const override: SalesProfitCostOverride = {
        ...current,
        averageItemCost,
        note,
        updatedAt: now,
      };
      await googleSheetsService.salesProfitCostOverrides.updateRows(
        `A${rowIndex + 1}:H${rowIndex + 1}`,
        [costOverrideToRow(override)],
      );
      return override;
    }
  }

  const override: SalesProfitCostOverride = {
    id: `SPC-${randomUUID()}`,
    month,
    accountId,
    averageItemCost,
    note,
    createdAt: now,
    updatedAt: now,
    createdBy,
  };
  await googleSheetsService.salesProfitCostOverrides.appendRows("A:H", [
    costOverrideToRow(override),
  ]);
  return override;
}

export async function removeSalesProfitCostOverride({
  accountId,
  googleSheetsService,
  month,
}: {
  accountId: string;
  googleSheetsService: IGoogleSheetsService;
  month: string;
}): Promise<boolean> {
  await ensureCostOverrideHeaders(googleSheetsService);
  const rows = await googleSheetsService.salesProfitCostOverrides.readRows();
  const rowIndex = rows.findIndex(
    (row, index) =>
      index > 0 &&
      toStringValue(row[1]) === month &&
      toStringValue(row[2]) === accountId,
  );
  if (rowIndex < 0) return false;

  await googleSheetsService.salesProfitCostOverrides.updateRows(
    `A${rowIndex + 1}:H${rowIndex + 1}`,
    [Array.from({ length: SALES_PROFIT_COST_OVERRIDE_HEADERS.length }, () => "")],
  );
  return true;
}

async function ensureCostOverrideHeaders(
  googleSheetsService: IGoogleSheetsService,
): Promise<void> {
  await googleSheetsService.salesProfitCostOverrides.ensureExists?.();
  const rows =
    await googleSheetsService.salesProfitCostOverrides.readRows("A1:H1");
  if (rows[0]?.join("|") !== SALES_PROFIT_COST_OVERRIDE_HEADERS.join("|")) {
    await googleSheetsService.salesProfitCostOverrides.updateRows("A1:H1", [
      SALES_PROFIT_COST_OVERRIDE_HEADERS,
    ]);
  }
}

function mapCostOverrideRow(
  row: GoogleSheetRow,
): SalesProfitCostOverride | null {
  if (!row.length || row[0] === "id") return null;
  const id = toStringValue(row[0]);
  const month = toStringValue(row[1]);
  const accountId = toStringValue(row[2]);
  if (!id || !month || !accountId) return null;
  return {
    id,
    month,
    accountId,
    averageItemCost: toNumberValue(row[3]),
    note: toStringValue(row[4]),
    createdAt: toStringValue(row[5]),
    updatedAt: toStringValue(row[6]),
    createdBy: toStringValue(row[7]),
  };
}

function costOverrideToRow(override: SalesProfitCostOverride): GoogleSheetRow {
  return [
    override.id,
    override.month,
    override.accountId,
    override.averageItemCost,
    override.note,
    override.createdAt,
    override.updatedAt,
    override.createdBy,
  ];
}

function toStringValue(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function toNumberValue(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}
