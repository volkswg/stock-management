import type { SalesProfitCostOverride } from "../contracts";
import type { CostOverrideStore, CostOverrideRuntime } from "./ports/cost-overrides";

export async function listSalesProfitCostOverrides({
  store,
  year,
}: {
  store: CostOverrideStore;
  year: string;
}): Promise<SalesProfitCostOverride[]> {
  await store.prepare();
  const rows = await store.read();
  return rows.records()
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
  store,
  month,
  note,
  runtime,
}: {
  accountId: string;
  averageItemCost: number;
  createdBy: string;
  store: CostOverrideStore;
  month: string;
  note: string;
  runtime: CostOverrideRuntime;
}): Promise<SalesProfitCostOverride> {
  await store.prepare();
  const rows = await store.read();
  const existing = rows.find(month, accountId);
  const now = runtime.now();
  if (existing) {
    const current = existing.current();
    if (current) {
      const override: SalesProfitCostOverride = {
        ...current,
        averageItemCost,
        note,
        updatedAt: now,
      };
      await existing.replace(override);
      return override;
    }
  }

  const override: SalesProfitCostOverride = {
    id: `SPC-${runtime.uuid()}`,
    month,
    accountId,
    averageItemCost,
    note,
    createdAt: now,
    updatedAt: now,
    createdBy,
  };
  await store.append(override);
  return override;
}

export async function removeSalesProfitCostOverride({
  accountId,
  store,
  month,
}: {
  accountId: string;
  store: CostOverrideStore;
  month: string;
}): Promise<boolean> {
  await store.prepare();
  const rows = await store.read();
  const existing = rows.find(month, accountId);
  if (!existing) return false;

  await existing.clear();
  return true;
}

