import { RecordsSheet } from "@/infrastructure/persistence/google-sheets/sheets/RecordsSheet";
import type { GoogleSheetRow } from "@/infrastructure/persistence/google-sheets/types";

// Preserve dates, photo links and owner notes literally, never as formulas.
export class StockAdjustmentsSheet extends RecordsSheet {
  async appendRows(range: string, values: GoogleSheetRow[]): Promise<void> {
    await this.client.appendValues(this.worksheetName, range, values, "RAW");
  }
  async updateRows(range: string, values: GoogleSheetRow[]): Promise<void> {
    await this.client.updateValues(this.worksheetName, range, values, "RAW");
  }
}
