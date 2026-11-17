import "server-only";
import type { GoogleSheetRow, IGoogleRowsSheet } from "./types";

// Only actual Sheets transports use the positional fallback. A PostgreSQL table
// must supply referenceRow; a missing/foreign snapshot fails closed in that hook.
export function updateRecord(sheet: IGoogleRowsSheet, row: GoogleSheetRow, range: string, values: GoogleSheetRow[]): Promise<void> {
  if (!sheet.referenceRow) return sheet.updateRows(range, values);
  if (values.length !== 1) throw new Error("A record reference updates exactly one record.");
  const match = /^([A-Z]+)\d+(?::([A-Z]+)\d+)?$/.exec(range);
  if (!match) throw new Error("Invalid record columns.");
  return sheet.referenceRow(row).update(match[1]+(match[2] ? ':'+match[2] : ''), values[0]);
}

export function archiveRecord(sheet: IGoogleRowsSheet, row: GoogleSheetRow, sheetRowNumber: number): Promise<void> {
  if (sheet.referenceRow) return sheet.referenceRow(row).archive();
  if (!sheet.deleteRow) throw new Error("Record deletion is unavailable.");
  return sheet.deleteRow(sheetRowNumber);
}

// PostgreSQL input is creation-ordered with stable ID ties. Existing business
// priorities (effective dates, payroll months, receipt keys) remain feature-owned.
export function readSelectionRows(sheet: IGoogleRowsSheet, range?: string): Promise<GoogleSheetRow[]> {
  return sheet.readSelectionRows ? (range === undefined ? sheet.readSelectionRows() : sheet.readSelectionRows(range)) : (range === undefined ? sheet.readRows() : sheet.readRows(range));
}

// Order/Shipment ports historically supply input to a final reverse(). Construct
// that input from explicit newest-first order, so nulls and ID ties stay correct.
export function readReversedCreationRows(sheet: IGoogleRowsSheet, range?: string): Promise<GoogleSheetRow[]> {
  if (sheet.readReversedCreationRows) return range === undefined ? sheet.readReversedCreationRows() : sheet.readReversedCreationRows(range);
  if (!sheet.readCreationRows) return range === undefined ? sheet.readRows() : sheet.readRows(range);
  return sheet.readCreationRows(range, "descending").then(rows => [rows[0], ...rows.slice(1).reverse()]);
}
