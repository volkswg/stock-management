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
  salesReceiptPaymentsWorksheetName: string;
  salesReceiptsWorksheetName: string;
  salesReceiptSyncsWorksheetName: string;
  shipmentOrdersWorksheetName: string;
  shipmentsWorksheetName: string;
  userStateWorksheetName: string;
  serviceAccountEmail: string;
  serviceAccountPrivateKey: string;
};

export interface IGoogleSheet {
  checkConnection(): Promise<void>;
  read(range: string): Promise<GoogleSheetRow[]>;
  append(range: string, values: GoogleSheetRow[]): Promise<void>;
  update(range: string, values: GoogleSheetRow[]): Promise<void>;
  clear(range: string): Promise<void>;
}

export interface IGoogleRowsSheet {
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
  readonly salesReceiptPayments: IGoogleRowsSheet;
  readonly salesReceipts: IGoogleRowsSheet;
  readonly salesReceiptSyncs: IGoogleRowsSheet;
  readonly shipmentOrders: IGoogleRowsSheet;
  readonly shipments: IGoogleRowsSheet;
  readonly userState: IGoogleRowsSheet;
  checkConnection(): Promise<void>;
}
