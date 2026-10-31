import type { GoogleSheetRow, IGoogleRowsSheet } from "../../types";
import { BaseGoogleSheet } from "../BaseGoogleSheet";

export class MovementSheet extends BaseGoogleSheet implements IGoogleRowsSheet {
  async readRows(range = "A:N"): Promise<GoogleSheetRow[]> {
    return this.read(range);
  }

  async appendRows(range: string, values: GoogleSheetRow[]): Promise<void> {
    await this.append(range, values);
  }

  async deleteRow(rowNumber: number): Promise<void> {
    await this.client.deleteRow(this.worksheetName, rowNumber);
  }

  async updateRows(range: string, values: GoogleSheetRow[]): Promise<void> {
    await this.update(range, values);
  }
}
