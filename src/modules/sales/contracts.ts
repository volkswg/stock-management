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

import type { Expense } from "@/modules/expenses/contracts";

export type DailySalesItemRow = {
  itemId: string;
  variantId: string;
  itemName: string;
  variantName: string;
  sku: string;
  itemsSold: number;
  grossSales: number;
  itemsRefunded: number;
  refunds: number;
  discounts: number;
  netSales: number;
  costOfGoods: number;
  grossProfit: number;
  marginPercent: number;
  taxes: number;
};

export type DailySalesPaymentRow = {
  paymentTypeId: string;
  name: string;
  type: string;
  paymentsReceived: number;
  refunds: number;
  netPayments: number;
};

export type DailySalesReport = {
  receiptCount: number;
  rows: DailySalesItemRow[];
  paymentsByType: DailySalesPaymentRow[];
  totals: Omit<
    DailySalesItemRow,
    "itemId" | "variantId" | "itemName" | "variantName" | "sku" | "marginPercent"
  >;
  hourlyGrossSales: Array<{ hour: string; grossSales: number }>;
};

export type SalesDashboardDay = {
  salesDate: string;
  syncedShopCount: number;
  receiptCount: number;
  itemsSold: number;
  itemsRefunded: number;
  grossSales: number;
  netSales: number;
};

export type SalesDashboardReport = {
  syncedDays: number;
  dailySales: SalesDashboardDay[];
  shopSeries: Array<{
    accountId: string;
    shopName: string;
    dailySales: SalesDashboardDay[];
  }>;
  report: DailySalesReport;
};

export type ProfitSummaryMetrics = {
  netItems: number;
  netSales: number;
  averageSellingPrice: number;
  averageItemCost: number;
  unitGrossProfit: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
};

export type ProfitSummaryShop = ProfitSummaryMetrics & {
  accountId: string;
  shopName: string;
  syncedAverageItemCost: number;
  hasItemCostOverride: boolean;
  itemCostOverrideNote: string;
  expenseNote: string;
};

export type ProfitSummarySharedExpense = Pick<
  Expense,
  "id" | "amount" | "category" | "name" | "note"
>;

export type ProfitSummaryMonth = ProfitSummaryMetrics & {
  month: string;
  shops: ProfitSummaryShop[];
  shopExpenses: number;
  sharedExpenseTotal: number;
  sharedExpenses: ProfitSummarySharedExpense[];
};

export type ProfitSummary = {
  year: string;
  months: ProfitSummaryMonth[];
  totals: ProfitSummaryMetrics;
};

export type SalesSyncStatusRow = {
  id: string;
  salesDate: string;
  accountId: string;
  shopName: string;
  status: string;
  receiptCount: number;
  itemCount: number;
  paymentCount: number;
  syncedAt: string;
};

export type SalesSyncStatusSummary = {
  syncedDays: number;
  totalReceipts: number;
  totalItems: number;
  totalPayments: number;
  latestSyncedAt: string | null;
};
