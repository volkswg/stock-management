import "server-only";
import type { GoogleSheetRow, IGoogleRowsSheet } from "@/infrastructure/persistence/google-sheets/types";
import type { SalaryAdvance, PayrollSettlement } from "../../contracts";
import { SalaryAdvanceError, str } from "../../domain/salary-rules";
import type { SalaryStore, SettlementEntry } from "../../application/ports/payroll";
import { ADVANCE_HEADERS, SETTLEMENT_HEADERS } from "./employee-advances/const";
export type SalarySheets = { readonly employeeAdvances: IGoogleRowsSheet; readonly payrollSettlements: IGoogleRowsSheet };

export async function readSalaryTable(sheet: IGoogleRowsSheet, headers: string[]): Promise<GoogleSheetRow[]> {
  let rows: GoogleSheetRow[];
  try { rows = await sheet.readRows(); } catch (error) {
    // A missing, new worksheet is empty. Auth, quota and other errors must fail closed.
    if (error instanceof Error && /Google Sheets API request failed: 400/.test(error.message) && /Unable to parse range/.test(error.message)) return [];
    throw error;
  }
  if (!rows.length) return [];
  if (rows[0]?.slice(0, headers.length).join("|") !== headers.join("|")) throw new SalaryAdvanceError("Salary storage has unexpected headers. No records were changed.", 503);
  return rows;
}
export async function prepareSalaryTable(sheet: IGoogleRowsSheet, headers: string[], lastColumn: string) {
  await sheet.ensureExists?.();
  const rows = await readSalaryTable(sheet, headers);
  if (!rows.length) await sheet.updateRows(`A1:${lastColumn}1`, [headers]);
}

export class GoogleSheetsSalaryStore implements SalaryStore {
  constructor(private readonly sheets: SalarySheets) {}
  readAdvances(): Promise<SalaryAdvance[]> {
    return readSalaryTable(this.sheets.employeeAdvances, ADVANCE_HEADERS).then(rows => {
  return rows.slice(1).filter(row => row[0]).map(row => ({
    id: str(row[0]), employeeId: str(row[1]), shopId: str(row[2]), requestedDate: str(row[3]), payrollMonth: str(row[4]),
    requestedAmount: Number(row[5]), paidAmount: Number(row[6]), status: str(row[7]) as SalaryAdvance["status"],
    paidDate: str(row[8]), reference: str(row[9]), note: str(row[10]), createdAt: str(row[11]), updatedAt: str(row[12]),
  }));
    });
  }
  readSettlements(): Promise<SettlementEntry[]> {
    return readSalaryTable(this.sheets.payrollSettlements, SETTLEMENT_HEADERS).then(rows => rows.slice(1).filter(row => row[0]).map(row => ({
      get id() { return str(row[0]); },
      get employeeId() { return str(row[1]); },
      get month() { return str(row[2]); },
      get paidDate() { return str(row[3]); },
      get reference() { return str(row[4]); },
      get createdAt() { return str(row[5]); },
      get snapshotText() { return str(row[6]); },
    })));
  }
  async prepareAdvances(): Promise<void> { await prepareSalaryTable(this.sheets.employeeAdvances, ADVANCE_HEADERS, "M"); }
  async prepareSettlements(): Promise<void> { await prepareSalaryTable(this.sheets.payrollSettlements, SETTLEMENT_HEADERS, "G"); }
  async appendAdvance(advance: SalaryAdvance): Promise<void> { await this.sheets.employeeAdvances.appendRows("A:M", [advanceRow(advance)]); }
  async updateAdvanceCopies(id: string, next: SalaryAdvance): Promise<void> {
  const rows = await readSalaryTable(this.sheets.employeeAdvances, ADVANCE_HEADERS);
  const indexes = rows.flatMap((row, index) => str(row[0]) === id ? [index] : []);
  for (const index of indexes) await this.sheets.employeeAdvances.updateRows(`A${index + 1}:M${index + 1}`, [advanceRow(next)]);
  }
  async appendSettlement(readSettlement: () => PayrollSettlement, snapshotJson: string): Promise<void> {
    // Preserve sheet/method lookup before evaluating the original payment fields.
    await this.sheets.payrollSettlements.appendRows("A:G", [settlementRow(readSettlement(), snapshotJson)]);
  }
}
function advanceRow(a: SalaryAdvance): GoogleSheetRow { return [a.id, a.employeeId, a.shopId, a.requestedDate, a.payrollMonth, a.requestedAmount, a.paidAmount, a.status, a.paidDate, a.reference, a.note, a.createdAt, a.updatedAt]; }

function settlementRow(settlement: PayrollSettlement, snapshotJson: string): GoogleSheetRow { const { id, employeeId, month, paidDate, reference, createdAt } = settlement; return [id, employeeId, month, paidDate, reference, createdAt, snapshotJson]; }
