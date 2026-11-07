import { RecordsSheet as LegacyRecords } from "@/modules/expenses/infrastructure/google-sheets/expenses/RecordsSheet";
import { RecordsSheet } from '../src/modules/expenses/infrastructure/google-sheets/expenses/RecordsSheet';
import { RecordsSheet as RootRecords } from '../src/infrastructure/persistence/google-sheets/sheets/RecordsSheet';
import { StockAdjustmentsSheet } from '../src/modules/inventory/infrastructure/google-sheets/stock-adjustments/StockAdjustmentsSheet';
import { PayrollRecordsSheet } from '../src/modules/hr/infrastructure/google-sheets/employee-advances/PayrollRecordsSheet';
import type { GoogleSheetsClient } from '../src/infrastructure/persistence/google-sheets/client';
import type { IGoogleRowsSheet } from '../src/infrastructure/persistence/google-sheets/types';
const constructors: [typeof RecordsSheet, typeof RootRecords] = [LegacyRecords, RecordsSheet];
export function worksheetCompatibility(client: GoogleSheetsClient): IGoogleRowsSheet[] {
  const subclasses: RootRecords[] = [new StockAdjustmentsSheet(client, 'adjustments'), new PayrollRecordsSheet(client, 'payroll')];
  return [...subclasses, new constructors[0](client, 'expenses'), new constructors[1](client, 'shops')];
}
