export type GoogleSheetCellValue = string | number | boolean | null;
export type GoogleSheetRow = GoogleSheetCellValue[];

export type GoogleSheetsConfig = {
  spreadsheetId: string;
  employeesWorksheetName: string;
  employeeTimesheetsWorksheetName: string;
  ordersWorksheetName: string;
  orderBillsWorksheetName: string;
  orderItemsWorksheetName: string;
  purchasesWorksheetName: string;
  salesReceiptItemsWorksheetName: string;
  salesProfitCostOverridesWorksheetName: string;
  salesReceiptPaymentsWorksheetName: string;
  salesProfitExpensesWorksheetName: string;
  salesReceiptsWorksheetName: string;
  salesReceiptSyncsWorksheetName: string;
  shipmentOrdersWorksheetName: string;
  shipmentsWorksheetName: string;
  movementMasterWorksheetName: string;
  movementDetailWorksheetName: string;
  userStateWorksheetName: string;
  serviceAccountEmail: string;
  serviceAccountPrivateKey: string;
};

export interface IGoogleSheet {
  checkConnection(): Promise<void>;
  ensureExists(): Promise<void>;
  read(range: string): Promise<GoogleSheetRow[]>;
  append(range: string, values: GoogleSheetRow[]): Promise<void>;
  update(range: string, values: GoogleSheetRow[]): Promise<void>;
  clear(range: string): Promise<void>;
}

export interface IGoogleRowsSheet {
  ensureExists?(): Promise<void>;
  readRows(range?: string): Promise<GoogleSheetRow[]>;
  appendRows(range: string, values: GoogleSheetRow[]): Promise<void>;
  updateRows(range: string, values: GoogleSheetRow[]): Promise<void>;
}

export interface IGoogleSheetsService {
  readonly employees: IGoogleRowsSheet;
  readonly employeeTimesheets: IGoogleRowsSheet;
  readonly orders: IGoogleRowsSheet;
  readonly orderBills: IGoogleRowsSheet;
  readonly orderItems: IGoogleRowsSheet;
  readonly purchases: IGoogleRowsSheet;
  readonly salesReceiptItems: IGoogleRowsSheet;
  readonly salesProfitCostOverrides: IGoogleRowsSheet;
  readonly salesReceiptPayments: IGoogleRowsSheet;
  readonly salesProfitExpenses: IGoogleRowsSheet;
  readonly salesReceipts: IGoogleRowsSheet;
  readonly salesReceiptSyncs: IGoogleRowsSheet;
  readonly shipmentOrders: IGoogleRowsSheet;
  readonly shipments: IGoogleRowsSheet;
  readonly movementMasters: IGoogleRowsSheet;
  readonly movementDetails: IGoogleRowsSheet;
  readonly userState: IGoogleRowsSheet;
  checkConnection(): Promise<void>;
}
