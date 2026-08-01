import { GoogleServiceAccountAuth } from "../auth/GoogleServiceAccountAuth";
import {
  GOOGLE_SHEETS_API_BASE,
  GOOGLE_SHEETS_SCOPE,
} from "./const";
import type {
  GoogleSheetRow,
  GoogleSheetsConfig,
  IGoogleSheetsService,
} from "./types";

type GoogleSheetsValuesResponse = {
  values?: GoogleSheetRow[];
};

export class GoogleSheetsService implements IGoogleSheetsService {
  private readonly auth: GoogleServiceAccountAuth;
  private readonly spreadsheetId: string;
  private readonly ordersWorksheetName: string;
  private readonly orderDetailsWorksheetName: string;
  private readonly purchasesWorksheetName: string;

  constructor(config: GoogleSheetsConfig) {
    if (!config.spreadsheetId.trim()) {
      throw new Error("Google Sheets spreadsheet id is required.");
    }

    if (!config.ordersWorksheetName.trim()) {
      throw new Error("Google Sheets orders worksheet name is required.");
    }

    if (!config.orderDetailsWorksheetName.trim()) {
      throw new Error(
        "Google Sheets order details worksheet name is required.",
      );
    }

    if (!config.purchasesWorksheetName.trim()) {
      throw new Error("Google Sheets purchases worksheet name is required.");
    }

    this.spreadsheetId = config.spreadsheetId;
    this.ordersWorksheetName = config.ordersWorksheetName;
    this.orderDetailsWorksheetName = config.orderDetailsWorksheetName;
    this.purchasesWorksheetName = config.purchasesWorksheetName;
    this.auth = new GoogleServiceAccountAuth({
      serviceAccountEmail: config.serviceAccountEmail,
      serviceAccountPrivateKey: config.serviceAccountPrivateKey,
      scopes: [GOOGLE_SHEETS_SCOPE],
    });
  }

  async checkConnection(): Promise<void> {
    await Promise.all([
      this.getValues("A1:A1", this.ordersWorksheetName),
      this.getValues("A1:A1", this.orderDetailsWorksheetName),
      this.getValues("A1:A1", this.purchasesWorksheetName),
    ]);
  }

  async getValues(
    range: string,
    worksheetName = this.ordersWorksheetName,
  ): Promise<GoogleSheetRow[]> {
    const response = await this.request<GoogleSheetsValuesResponse>(
      `/values/${this.encodeRange(worksheetName, range)}`,
      { method: "GET" },
    );

    return response.values || [];
  }

  async appendValues(
    range: string,
    values: GoogleSheetRow[],
    worksheetName = this.ordersWorksheetName,
  ): Promise<void> {
    await this.request(
      `/values/${this.encodeRange(
        worksheetName,
        range,
      )}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: "POST",
        body: JSON.stringify({ values }),
      },
    );
  }

  async updateValues(
    range: string,
    values: GoogleSheetRow[],
    worksheetName = this.ordersWorksheetName,
  ): Promise<void> {
    await this.request(
      `/values/${this.encodeRange(
        worksheetName,
        range,
      )}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        body: JSON.stringify({ values }),
      },
    );
  }

  async clearValues(
    range: string,
    worksheetName = this.ordersWorksheetName,
  ): Promise<void> {
    await this.request(
      `/values/${this.encodeRange(worksheetName, range)}:clear`,
      {
        method: "POST",
        body: JSON.stringify({}),
      },
    );
  }

  async readOrderRows(range = "A:Z"): Promise<GoogleSheetRow[]> {
    return this.getValues(range, this.ordersWorksheetName);
  }

  async appendOrderRows(
    range: string,
    values: GoogleSheetRow[],
  ): Promise<void> {
    await this.appendValues(range, values, this.ordersWorksheetName);
  }

  async updateOrderRows(
    range: string,
    values: GoogleSheetRow[],
  ): Promise<void> {
    await this.updateValues(range, values, this.ordersWorksheetName);
  }

  async readOrderDetailRows(range = "A:Z"): Promise<GoogleSheetRow[]> {
    return this.getValues(range, this.orderDetailsWorksheetName);
  }

  async appendOrderDetailRows(
    range: string,
    values: GoogleSheetRow[],
  ): Promise<void> {
    await this.appendValues(range, values, this.orderDetailsWorksheetName);
  }

  async updateOrderDetailRows(
    range: string,
    values: GoogleSheetRow[],
  ): Promise<void> {
    await this.updateValues(range, values, this.orderDetailsWorksheetName);
  }

  async readPurchaseRows(range = "A:Z"): Promise<GoogleSheetRow[]> {
    return this.getValues(range, this.purchasesWorksheetName);
  }

  async appendPurchaseRows(
    range: string,
    values: GoogleSheetRow[],
  ): Promise<void> {
    await this.appendValues(range, values, this.purchasesWorksheetName);
  }

  async updatePurchaseRows(
    range: string,
    values: GoogleSheetRow[],
  ): Promise<void> {
    await this.updateValues(range, values, this.purchasesWorksheetName);
  }

  private async request<T = unknown>(
    path: string,
    init: RequestInit,
  ): Promise<T> {
    const accessToken = await this.auth.getAccessToken();
    const response = await fetch(
      `${GOOGLE_SHEETS_API_BASE}/${encodeURIComponent(
        this.spreadsheetId,
      )}${path}`,
      {
        ...init,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
          ...init.headers,
        },
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Google Sheets API request failed: ${response.status} ${errorBody}`,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  private encodeRange(worksheetName: string, range: string): string {
    return encodeURIComponent(`${quoteWorksheetName(worksheetName)}!${range}`);
  }
}

function quoteWorksheetName(worksheetName: string): string {
  return `'${worksheetName.replace(/'/g, "''")}'`;
}
