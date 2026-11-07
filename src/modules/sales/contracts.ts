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

export type GoogleSheetsDailySalesItemRow = {
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

export type GoogleSheetsDailySalesPaymentRow = {
  paymentTypeId: string;
  name: string;
  type: string;
  paymentsReceived: number;
  refunds: number;
  netPayments: number;
};

export type GoogleSheetsDailySalesReport = {
  receiptCount: number;
  rows: GoogleSheetsDailySalesItemRow[];
  paymentsByType: GoogleSheetsDailySalesPaymentRow[];
  totals: Omit<
    GoogleSheetsDailySalesItemRow,
    "itemId" | "variantId" | "itemName" | "variantName" | "sku" | "marginPercent"
  >;
  hourlyGrossSales: Array<{ hour: string; grossSales: number }>;
};

export type GoogleSheetsSalesDashboardDay = {
  salesDate: string;
  syncedShopCount: number;
  receiptCount: number;
  itemsSold: number;
  itemsRefunded: number;
  grossSales: number;
  netSales: number;
};

export type GoogleSheetsSalesDashboardReport = {
  syncedDays: number;
  dailySales: GoogleSheetsSalesDashboardDay[];
  shopSeries: Array<{
    accountId: string;
    shopName: string;
    dailySales: GoogleSheetsSalesDashboardDay[];
  }>;
  report: GoogleSheetsDailySalesReport;
};

export type GoogleSheetsProfitSummaryMetrics = {
  netItems: number;
  netSales: number;
  averageSellingPrice: number;
  averageItemCost: number;
  unitGrossProfit: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
};

export type GoogleSheetsProfitSummaryShop = GoogleSheetsProfitSummaryMetrics & {
  accountId: string;
  shopName: string;
  syncedAverageItemCost: number;
  hasItemCostOverride: boolean;
  itemCostOverrideNote: string;
  expenseNote: string;
};

export type GoogleSheetsProfitSummarySharedExpense = Pick<
  Expense,
  "id" | "amount" | "category" | "name" | "note"
>;

export type GoogleSheetsProfitSummaryMonth = GoogleSheetsProfitSummaryMetrics & {
  month: string;
  shops: GoogleSheetsProfitSummaryShop[];
  shopExpenses: number;
  sharedExpenseTotal: number;
  sharedExpenses: GoogleSheetsProfitSummarySharedExpense[];
};

export type GoogleSheetsProfitSummary = {
  year: string;
  months: GoogleSheetsProfitSummaryMonth[];
  totals: GoogleSheetsProfitSummaryMetrics;
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
