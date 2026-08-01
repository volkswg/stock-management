import { GOOGLE_SHEETS_API_BASE } from "../const";
import type { GoogleServiceAccountAuth } from "../../auth/GoogleServiceAccountAuth";
import type { GoogleSheetRow } from "../types";

type GoogleSheetsValuesResponse = {
  values?: GoogleSheetRow[];
};

export class GoogleSheetsClient {
  constructor(
    private readonly auth: GoogleServiceAccountAuth,
    private readonly spreadsheetId: string,
  ) {}

  async getValues(
    worksheetName: string,
    range: string,
  ): Promise<GoogleSheetRow[]> {
    const response = await this.request<GoogleSheetsValuesResponse>(
      `/values/${this.encodeRange(worksheetName, range)}`,
      { method: "GET" },
    );

    return response.values || [];
  }

  async appendValues(
    worksheetName: string,
    range: string,
    values: GoogleSheetRow[],
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
    worksheetName: string,
    range: string,
    values: GoogleSheetRow[],
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

  async clearValues(worksheetName: string, range: string): Promise<void> {
    await this.request(
      `/values/${this.encodeRange(worksheetName, range)}:clear`,
      {
        method: "POST",
        body: JSON.stringify({}),
      },
    );
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
