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
