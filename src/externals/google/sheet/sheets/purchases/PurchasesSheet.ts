import { PURCHASE_SHEET_HEADERS, lastColumnLetter } from "../../const";
import { BaseGoogleSheet } from "../BaseGoogleSheet";
import type { GoogleSheetRow, IGoogleRowsSheet } from "../../types";

export class PurchasesSheet
  extends BaseGoogleSheet
  implements IGoogleRowsSheet
{
  async readRows(
    range = `A:${lastColumnLetter(PURCHASE_SHEET_HEADERS.length - 1)}`,
  ): Promise<GoogleSheetRow[]> {
    return this.read(range);
  }

  async appendRows(range: string, values: GoogleSheetRow[]): Promise<void> {
    await this.append(range, values);
  }

  async updateRows(range: string, values: GoogleSheetRow[]): Promise<void> {
    await this.update(range, values);
  }
}
