import { BaseGoogleSheet } from "@/infrastructure/persistence/google-sheets/sheets/BaseGoogleSheet";
import type { GoogleSheetRow, IGoogleRowsSheet } from "@/infrastructure/persistence/google-sheets/types";

export class OrdersSheet extends BaseGoogleSheet implements IGoogleRowsSheet {
  async readRows(range = "A:Z"): Promise<GoogleSheetRow[]> {
    return this.read(range);
  }

  async appendRows(range: string, values: GoogleSheetRow[]): Promise<void> {
    await this.append(range, values);
  }

  async updateRows(range: string, values: GoogleSheetRow[]): Promise<void> {
    await this.update(range, values);
  }
}
