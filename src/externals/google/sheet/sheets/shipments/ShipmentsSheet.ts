import { lastColumnLetter } from "../../const";
import type { GoogleSheetRow, IGoogleRowsSheet } from "../../types";
import { BaseGoogleSheet } from "../BaseGoogleSheet";
import { SHIPMENTS_SHEET_HEADERS } from "./const";

export class ShipmentsSheet extends BaseGoogleSheet implements IGoogleRowsSheet {
  async readRows(
    range = `A:${lastColumnLetter(SHIPMENTS_SHEET_HEADERS.length - 1)}`,
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
