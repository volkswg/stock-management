export type GoogleSheetCellValue = string | number | boolean | null;

export type GoogleSheetRow = GoogleSheetCellValue[];

export type GoogleSheetRangeUpdate = {
  range: string;
  values: GoogleSheetRow[];
};
