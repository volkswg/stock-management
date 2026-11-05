export type GoogleSheetCellValue = string | number | boolean | null;

export type GoogleSheetRow = GoogleSheetCellValue[];

export type GoogleSheetRangeUpdate = {
  range: string;
  values: GoogleSheetRow[];
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
  deleteRow?(rowNumber: number): Promise<void>;
}

export interface IGoogleBatchRowsSheet extends IGoogleRowsSheet {
  batchUpdateRows(updates: GoogleSheetRangeUpdate[]): Promise<void>;
}
