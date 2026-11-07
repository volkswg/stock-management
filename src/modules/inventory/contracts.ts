export type StockCountAccount = {
  id: string;
  shopName: string;
};

export type AdjustmentEmployee = { id: string; name: string; status: string; hiredDate: string; terminatedDate: string };

export const ADJUSTMENT_REASONS = {
  employee_gift: "Employee gift", damage: "Damaged items", sample: "Samples",
  personal_use: "Personal use", employee_return: "Employee return", correction: "Stock correction",
} as const;
export type AdjustmentReason = keyof typeof ADJUSTMENT_REASONS;
export type StockAdjustment = {
  id: string; accountId: string; shopName: string; date: string; direction: "in" | "out";
  reason: AdjustmentReason | "reversal"; employeeId: string; employeeName: string; quantity: number;
  itemDescription: string; photoUrl: string; note: string; reversesId: string; replacesId: string;
  createdAt: string; createdBy: string; notInLoyverse: boolean;
};

export type StockCountRecord = {
  id: string;
  month: string;
  accountId: string;
  shopName: string;
  physicalCount: number;
  note: string;
  countedAt: string;
  updatedAt: string;
  updatedBy: string;
};

export type MonthlyShopStockCount = {
  accountId: string;
  shopName: string;
  month: string;
  openingStock: number;
  hasOpeningCount: boolean;
  stockIn: number;
  stockOut: number;
  adjustmentsOut: number;
  adjustmentsIn: number;
  adjustmentCount: number;
  expectedSalesDays: number;
  missingSalesDays: number;
  warnings: string[];
  salesSyncedDays: number;
  calculatedStock: number;
  physicalCount: number | null;
  variance: number | null;
  matches: boolean | null;
  note: string;
  countedAt: string;
  updatedAt: string;
};

export type MovementStatus = "in_progress" | "created" | "delivered";

export type ProductMovementRecord = {
  movementId: string;
  movementMasterId: string;
  shopName: string;
  quantity: string;
  remark: string;
  fromLocation: string;
  toLocation: string;
  productImageUrl: string;
  purchaseDetailId: string;
  status: "created" | "delivered";
  createdAt: string;
  updatedAt: string;
  stockCounted: boolean;
  isNewArrival: boolean;
};

export type ProductMovementMasterRecord = {
  id: string;
  userId: string;
  packingDate: string;
  deliverDateTime?: string;
  status: MovementStatus;
  totalQuantity: string;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  shopQuantities: Record<string, number>;
};

export type MovementDateFilter = {
  date?: string;
  fromDate?: string;
  toDate?: string;
};
