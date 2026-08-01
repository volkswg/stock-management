import { BaseGoogleSheet } from "../BaseGoogleSheet";
import type { GoogleSheetRow, IGoogleRowsSheet } from "../../types";

export class OrderDetailsSheet
  extends BaseGoogleSheet
  implements IGoogleRowsSheet
{
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
