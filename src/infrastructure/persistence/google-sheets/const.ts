export const GOOGLE_SHEETS_SCOPE =
  "https://www.googleapis.com/auth/spreadsheets";
export const GOOGLE_SHEETS_API_BASE =
  "https://sheets.googleapis.com/v4/spreadsheets";

export const lastColumnLetter = (columnIndex: number): string => {
  let letter = "";
  let index = columnIndex;

  while (index >= 0) {
    letter = String.fromCharCode((index % 26) + 65) + letter;
    index = Math.floor(index / 26) - 1;
  }

  return letter;
};
