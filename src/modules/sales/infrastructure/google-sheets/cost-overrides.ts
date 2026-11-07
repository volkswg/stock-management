import "server-only";
import type { GoogleSheetRow, IGoogleRowsSheet } from "@/infrastructure/persistence/google-sheets/types";
import { SALES_PROFIT_COST_OVERRIDE_HEADERS } from "./profit-cost-overrides/const";
import type { SalesProfitCostOverride } from "../../contracts";
import type { CostOverrideStore } from "../../application/ports/cost-overrides";
type IGoogleSheetsService = {
    salesProfitCostOverrides: IGoogleRowsSheet;
};
export function createCostOverrideStore(googleSheetsService: IGoogleSheetsService): CostOverrideStore {
    return {
        prepare: () => ensureCostOverrideHeaders(googleSheetsService),
        async read() {
            const rows = await googleSheetsService.salesProfitCostOverrides.readRows();
            return {
                records: () => rows.map(mapCostOverrideRow).filter((override): override is SalesProfitCostOverride => Boolean(override)),
                find(month, accountId) {
                    const rowIndex = rows.findIndex((row, index) => index > 0 && toStringValue(row[1]) === month && toStringValue(row[2]) === accountId);
                    if (rowIndex < 0)
                        return undefined;
                    return { current: () => mapCostOverrideRow(rows[rowIndex]), replace: override => googleSheetsService.salesProfitCostOverrides.updateRows(`A${rowIndex + 1}:H${rowIndex + 1}`, [costOverrideToRow(override)]), clear: () => googleSheetsService.salesProfitCostOverrides.updateRows(`A${rowIndex + 1}:H${rowIndex + 1}`, [Array.from({ length: SALES_PROFIT_COST_OVERRIDE_HEADERS.length }, () => "")]) };
                }
            };
        },
        append: override => googleSheetsService.salesProfitCostOverrides.appendRows("A:H", [costOverrideToRow(override)])
    };
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
