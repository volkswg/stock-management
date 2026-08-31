import type { GoogleSheetRow, IGoogleRowsSheet } from "../../types";
import { BaseGoogleSheet } from "../BaseGoogleSheet";

export class SalesReceiptPaymentsSheet
  extends BaseGoogleSheet
  implements IGoogleRowsSheet
{
  async readRows(range = "A:J"): Promise<GoogleSheetRow[]> {
    return this.read(range);
  }

  async appendRows(range: string, values: GoogleSheetRow[]): Promise<void> {
    await this.append(range, values);
  }

  async updateRows(range: string, values: GoogleSheetRow[]): Promise<void> {
    await this.update(range, values);
  }
}
