import { RecordsSheet } from "../expenses/RecordsSheet";
import type { GoogleSheetRow } from "../../types";

// Financial audit strings and JSON snapshots must never be interpreted as formulas.
export class PayrollRecordsSheet extends RecordsSheet {
  async appendRows(range: string, values: GoogleSheetRow[]): Promise<void> {
    await this.client.appendValues(this.worksheetName, range, values, "RAW");
  }
  async updateRows(range: string, values: GoogleSheetRow[]): Promise<void> {
    await this.client.updateValues(this.worksheetName, range, values, "RAW");
  }
}
