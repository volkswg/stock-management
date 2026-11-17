export type GoogleSheetCellValue = string | number | boolean | null;

export type GoogleSheetRow = GoogleSheetCellValue[];

export type GoogleSheetRangeUpdate = {
  range: string;
  values: GoogleSheetRow[];
};

// Adapter-owned identity; never expose a database key/revision or Sheet position
// through an application DTO. PostgreSQL binds this handle to a PK and revision.
export interface RecordReference {
  update(columns: string, values: GoogleSheetRow): Promise<void>;
  archive(): Promise<void>;
}

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
  referenceRow?(row: GoogleSheetRow): RecordReference;
  referenceId?(id: string): Promise<RecordReference | undefined>;
  nextRecordNumber?(): Promise<number>;
  identifierAfter?(rows: GoogleSheetRow[]): number;
  readSelectionRows?(range?: string): Promise<GoogleSheetRow[]>;
  readCreationRows?(range: string | undefined, direction: "ascending" | "descending"): Promise<GoogleSheetRow[]>;
}

export interface IGoogleBatchRowsSheet extends IGoogleRowsSheet {
  batchUpdateRows(updates: GoogleSheetRangeUpdate[]): Promise<void>;
}
