export type GoogleSheetCellValue = string | number | boolean | null;
export type GoogleSheetRow = GoogleSheetCellValue[];

export type GoogleSheetsConfig = {
  spreadsheetId: string;
  ordersWorksheetName: string;
  orderBillsWorksheetName: string;
  purchasesWorksheetName: string;
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
  readonly orders: IGoogleRowsSheet;
  readonly orderBills: IGoogleRowsSheet;
  readonly purchases: IGoogleRowsSheet;
  readonly userState: IGoogleRowsSheet;
  checkConnection(): Promise<void>;
}
