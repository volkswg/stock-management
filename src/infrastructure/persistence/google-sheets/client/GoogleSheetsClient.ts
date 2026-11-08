import { GOOGLE_SHEETS_API_BASE } from "../const";
import type { GoogleServiceAccountAuth } from "../google-auth/GoogleServiceAccountAuth";
import type { GoogleSheetRangeUpdate, GoogleSheetRow } from "../types";

type GoogleSheetsValuesResponse = {
  values?: GoogleSheetRow[];
};

type GoogleSpreadsheetResponse = {
  sheets?: Array<{ properties?: { sheetId?: number; title?: string } }>;
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

  // One quota-counted read for related ranges; results preserve requested order.
  async getValuesBatch(
    ranges: Array<{ worksheetName: string; range: string }>,
  ): Promise<GoogleSheetRow[][]> {
    if (!ranges.length) return [];
    const query = new URLSearchParams();
    for (const { worksheetName, range } of ranges) {
      query.append("ranges", `${quoteWorksheetName(worksheetName)}!${range}`);
    }
    const response = await this.request<{ valueRanges?: GoogleSheetsValuesResponse[] }>(
      `/values:batchGet?${query.toString()}`, { method: "GET" },
    );
    if (response.valueRanges?.length !== ranges.length) {
      throw new Error("Google Sheets batch read returned an incomplete set of ranges.");
    }
    return response.valueRanges.map((range) => range.values || []);
  }

  async appendValues(
    worksheetName: string,
    range: string,
    values: GoogleSheetRow[],
    inputOption: "USER_ENTERED" | "RAW" = "USER_ENTERED",
  ): Promise<void> {
    await this.request(
      `/values/${this.encodeRange(
        worksheetName,
        range,
      )}:append?valueInputOption=${inputOption}&insertDataOption=INSERT_ROWS`,
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
    inputOption: "USER_ENTERED" | "RAW" = "USER_ENTERED",
  ): Promise<void> {
    await this.request(
      `/values/${this.encodeRange(
        worksheetName,
        range,
      )}?valueInputOption=${inputOption}`,
      {
        method: "PUT",
        body: JSON.stringify({ values }),
      },
    );
  }

  async batchUpdateValues(
    worksheetName: string,
    updates: GoogleSheetRangeUpdate[],
  ): Promise<void> {
    if (updates.length === 0) return;
    await this.request("/values:batchUpdate", {
      method: "POST",
      body: JSON.stringify({
        valueInputOption: "USER_ENTERED",
        data: updates.map(({ range, values }) => ({
          range: `${quoteWorksheetName(worksheetName)}!${range}`,
          majorDimension: "ROWS",
          values,
        })),
      }),
    });
  }

  async findMetadata(lookup: { metadataId?: number; metadataKey?: string }): Promise<Array<{ metadataId?: number; metadataKey?: string; metadataValue?: string }>> {
    const result = await this.request<{ matchedDeveloperMetadata?: Array<{ developerMetadata: { metadataId?: number; metadataKey?: string; metadataValue?: string } }> }>(
      "/developerMetadata:search", { method: "POST", body: JSON.stringify({ dataFilters: [{ developerMetadataLookup: { ...lookup, visibility: "DOCUMENT" } }] }) },
    );
    return (result.matchedDeveloperMetadata ?? []).map(match => match.developerMetadata);
  }

  async worksheetId(title: string): Promise<number> {
    const result = await this.request<GoogleSpreadsheetResponse>("?fields=sheets.properties(sheetId,title)", { method: "GET" });
    const matches = result.sheets?.filter(sheet => sheet.properties?.title === title) ?? [];
    if (matches.length !== 1 || !Number.isInteger(matches[0].properties?.sheetId)) throw new Error("Required worksheet is missing or invalid.");
    return matches[0].properties!.sheetId!;
  }

  async updateSpreadsheet(requests: unknown[]): Promise<void> {
    await this.request(":batchUpdate", { method: "POST", body: JSON.stringify({ requests }) });
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

  async deleteRow(worksheetName: string, rowNumber: number): Promise<void> {
    if (!Number.isInteger(rowNumber) || rowNumber < 2) {
      throw new Error("Only data rows can be deleted from Google Sheets.");
    }

    const spreadsheet = await this.request<GoogleSpreadsheetResponse>(
      "?fields=sheets.properties(sheetId,title)",
      { method: "GET" },
    );
    const worksheet = spreadsheet.sheets?.find(
      (sheet) => sheet.properties?.title === worksheetName,
    );
    const sheetId = worksheet?.properties?.sheetId;
    if (sheetId === undefined) {
      throw new Error(`Google Sheets worksheet not found: ${worksheetName}`);
    }

    await this.request(":batchUpdate", {
      method: "POST",
      body: JSON.stringify({
        requests: [{
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: rowNumber - 1,
              endIndex: rowNumber,
            },
          },
        }],
      }),
    });
  }

  async ensureWorksheet(worksheetName: string): Promise<void> {
    const spreadsheet = await this.request<GoogleSpreadsheetResponse>(
      "?fields=sheets.properties.title",
      { method: "GET" },
    );
    const exists = spreadsheet.sheets?.some(
      (sheet) => sheet.properties?.title === worksheetName,
    );
    if (exists) return;

    await this.request(":batchUpdate", {
      method: "POST",
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title: worksheetName } } }],
      }),
    });
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
