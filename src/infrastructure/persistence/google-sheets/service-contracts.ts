import type { GoogleSheetRow, IGoogleRowsSheet, IGoogleBatchRowsSheet } from "@/infrastructure/persistence/google-sheets/types";
export type { GoogleSheetCellValue, GoogleSheetRow, GoogleSheetRangeUpdate, IGoogleSheet, IGoogleRowsSheet, IGoogleBatchRowsSheet } from "@/infrastructure/persistence/google-sheets/types";

export type GoogleSheetsConfig = {
  spreadsheetId: string;
  employeeCompensationsWorksheetName: string;
  employeesWorksheetName: string;
  employeeTimesheetsWorksheetName: string;
  employeeAdvancesWorksheetName: string;
  payrollSettlementsWorksheetName: string;
  ordersWorksheetName: string;
  orderBillsWorksheetName: string;
  orderItemsWorksheetName: string;
  salesReceiptItemsWorksheetName: string;
  salesProfitCostOverridesWorksheetName: string;
  salesReceiptPaymentsWorksheetName: string;
  expensesWorksheetName: string;
  expenseCategoriesWorksheetName: string;
  shopsWorksheetName: string;
  salesReceiptsWorksheetName: string;
  salesReceiptSyncsWorksheetName: string;
  shipmentOrdersWorksheetName: string;
  shipmentsWorksheetName: string;
  stockCountsWorksheetName: string;
  stockAdjustmentsWorksheetName: string;
  movementMasterWorksheetName: string;
  movementDetailWorksheetName: string;
  userStateWorksheetName: string;
  serviceAccountEmail: string;
  serviceAccountPrivateKey: string;
};

export type MovementWorksheet = "userState" | "movementDetails" | "movementMasters";

export type MovementRange = { sheet: MovementWorksheet; range: string };

export type SalesSyncWrite = {
  sheet: "salesReceipts" | "salesReceiptItems" | "salesReceiptPayments" | "salesReceiptSyncs";
  range: string;
  values: GoogleSheetRow[];
};

export interface IGoogleSheetsService {
  writeSalesSync?(updates: SalesSyncWrite[], beforeWrite: () => Promise<void>): Promise<void>;
  readMovementRanges?(ranges: MovementRange[]): Promise<GoogleSheetRow[][]>;
  readonly employeeCompensations: IGoogleRowsSheet;
  readonly employees: IGoogleRowsSheet;
  readonly employeeTimesheets: IGoogleRowsSheet;
  readonly employeeAdvances: IGoogleRowsSheet;
  readonly payrollSettlements: IGoogleRowsSheet;
  readonly orders: IGoogleRowsSheet;
  readonly orderBills: IGoogleRowsSheet;
  readonly orderItems: IGoogleBatchRowsSheet;
  readonly salesReceiptItems: IGoogleRowsSheet;
  readonly salesProfitCostOverrides: IGoogleRowsSheet;
  readonly salesReceiptPayments: IGoogleRowsSheet;
  readonly expenses: IGoogleRowsSheet;
  readonly expenseCategories: IGoogleRowsSheet;
  readonly shops: IGoogleRowsSheet;
  readonly salesReceipts: IGoogleRowsSheet;
  readonly salesReceiptSyncs: IGoogleRowsSheet;
  readonly shipmentOrders: IGoogleRowsSheet;
  readonly shipments: IGoogleRowsSheet;
  readonly stockCounts: IGoogleRowsSheet;
  readonly stockAdjustments: IGoogleRowsSheet;
  readonly movementMasters: IGoogleRowsSheet;
  readonly movementDetails: IGoogleRowsSheet;
  readonly userState: IGoogleRowsSheet;
  checkConnection(): Promise<void>;
}
