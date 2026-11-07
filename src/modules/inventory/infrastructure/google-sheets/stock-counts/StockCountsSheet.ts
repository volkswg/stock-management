import { lastColumnLetter } from "@/infrastructure/persistence/google-sheets/const";
import type { GoogleSheetRow, IGoogleRowsSheet } from "@/infrastructure/persistence/google-sheets/types";
import { BaseGoogleSheet } from "@/infrastructure/persistence/google-sheets/sheets/BaseGoogleSheet";
import { STOCK_COUNT_HEADERS } from "./const";

export class StockCountsSheet
  extends BaseGoogleSheet
  implements IGoogleRowsSheet
{
  async readRows(
    range = `A:${lastColumnLetter(STOCK_COUNT_HEADERS.length - 1)}`,
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
