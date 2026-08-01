export type GoogleSheetCellValue = string | number | boolean | null;
export type GoogleSheetRow = GoogleSheetCellValue[];

export type GoogleSheetsConfig = {
  spreadsheetId: string;
  ordersWorksheetName: string;
  orderDetailsWorksheetName: string;
  purchasesWorksheetName: string;
  serviceAccountEmail: string;
  serviceAccountPrivateKey: string;
};

export interface IGoogleSheetsService {
  checkConnection(): Promise<void>;
  getValues(range: string, worksheetName?: string): Promise<GoogleSheetRow[]>;
  appendValues(
    range: string,
    values: GoogleSheetRow[],
    worksheetName?: string,
  ): Promise<void>;
  updateValues(
    range: string,
    values: GoogleSheetRow[],
    worksheetName?: string,
  ): Promise<void>;
  clearValues(range: string, worksheetName?: string): Promise<void>;
  readOrderRows(range?: string): Promise<GoogleSheetRow[]>;
  appendOrderRows(range: string, values: GoogleSheetRow[]): Promise<void>;
  updateOrderRows(range: string, values: GoogleSheetRow[]): Promise<void>;
  readOrderDetailRows(range?: string): Promise<GoogleSheetRow[]>;
  appendOrderDetailRows(
    range: string,
    values: GoogleSheetRow[],
  ): Promise<void>;
  updateOrderDetailRows(
    range: string,
    values: GoogleSheetRow[],
  ): Promise<void>;
  readPurchaseRows(range?: string): Promise<GoogleSheetRow[]>;
  appendPurchaseRows(range: string, values: GoogleSheetRow[]): Promise<void>;
  updatePurchaseRows(range: string, values: GoogleSheetRow[]): Promise<void>;
}
