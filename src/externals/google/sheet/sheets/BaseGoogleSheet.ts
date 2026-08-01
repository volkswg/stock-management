import type { GoogleSheetsClient } from "../client";
import type { GoogleSheetRow, IGoogleSheet } from "../types";

export abstract class BaseGoogleSheet implements IGoogleSheet {
  constructor(
    protected readonly client: GoogleSheetsClient,
    protected readonly worksheetName: string,
  ) {}

  async checkConnection(): Promise<void> {
    await this.read("A1:A1");
  }

  async read(range: string): Promise<GoogleSheetRow[]> {
    return this.client.getValues(this.worksheetName, range);
  }

  async append(range: string, values: GoogleSheetRow[]): Promise<void> {
    await this.client.appendValues(this.worksheetName, range, values);
  }

  async update(range: string, values: GoogleSheetRow[]): Promise<void> {
    await this.client.updateValues(this.worksheetName, range, values);
  }

  async clear(range: string): Promise<void> {
    await this.client.clearValues(this.worksheetName, range);
  }
}
