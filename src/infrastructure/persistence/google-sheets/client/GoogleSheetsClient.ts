import { GOOGLE_SHEETS_API_BASE } from "../const";
import type { GoogleServiceAccountAuth } from "../google-auth/GoogleServiceAccountAuth";
import type { GoogleSheetRangeUpdate, GoogleSheetRow } from "../types";

type GoogleSheetsValuesResponse = {
  values?: GoogleSheetRow[];
};

type GoogleSpreadsheetResponse = {
  sheets?: Array<{ properties?: { sheetId?: number; title?: string; gridProperties?: { rowCount?: number; columnCount?: number } } }>;
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

  // Atomic workbook request. Callers must durably coordinate explicit row
  // positions and never retry an ambiguous POST without reconciling its intent.
  async batchUpdateWorkbookValues(updates: Array<{
    worksheetName: string; range: string; values: GoogleSheetRow[];
  }>, beforeWrite: () => Promise<void>): Promise<void> {
    if (!updates.length) return;
    const ranges = new Set<string>();
    const data = updates.map(({ worksheetName, range, values }) => {
      const match = /^A([1-9]\d*):([A-Z]+)([1-9]\d*)$/.exec(range);
      if (!worksheetName.trim() || !match || ranges.has(worksheetName) || !values.length) {
        throw new Error("Invalid or overlapping atomic Sheets batch.");
      }
      ranges.add(worksheetName);
      const width = [...match[2]].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
      if (Number(match[3]) - Number(match[1]) + 1 !== values.length || values.some(row =>
        row.length !== width || row.some(cell => cell !== null && typeof cell !== "string" && typeof cell !== "boolean" && (typeof cell !== "number" || !Number.isFinite(cell)))
      )) throw new Error("Invalid atomic Sheets dimensions or cells.");
      return { range: `${quoteWorksheetName(worksheetName)}!${range}`, majorDimension: "ROWS", values };
    });
    const body = JSON.stringify({ valueInputOption: "USER_ENTERED", data });
    // Google's recommended payload is <= 2 MB. Leave room for protocol overhead.
    if (new TextEncoder().encode(body).length > 1_500_000 || data.reduce((n, d) => n + d.values.reduce((m, row) => m + row.length, 0), 0) > 50_000) {
      throw new Error("Sales sync batch exceeds safe limits; staged publication is required before retrying.");
    }
    const metadata = await this.request<GoogleSpreadsheetResponse>(
      "?fields=sheets.properties(title,gridProperties)", { method: "GET" },
    );
    for (const update of updates) {
      const grid = metadata.sheets?.find(sheet => sheet.properties?.title === update.worksheetName)?.properties?.gridProperties;
      const match = /^A([1-9]\d*):([A-Z]+)([1-9]\d*)$/.exec(update.range)!;
      if (!grid || Number(match[3]) > (grid.rowCount ?? 0) || update.values[0].length > (grid.columnCount ?? 0)) {
        throw new Error("Sales sync target grid is missing or too small; the operator must review worksheet capacity before retrying.");
      }
    }
    // Check formulas as well as displayed values: a formula evaluating to ""
    // is historical content, not an empty append destination. This is a
    // defensive preflight, never a substitute for durable coordination.
    const query = new URLSearchParams({ valueRenderOption: "FORMULA" });
    for (const entry of data) query.append("ranges", entry.range);
    const destinations = await this.request<{ valueRanges?: GoogleSheetsValuesResponse[] }>(
      `/values:batchGet?${query.toString()}`, { method: "GET" },
    );
    if (destinations.valueRanges?.length !== data.length || destinations.valueRanges.some(range =>
      range.values?.some(row => row.some(cell => cell !== null && cell !== ""))
    )) throw new Error("Sales sync target grid contains existing data or cannot be verified; no historical cells were overwritten.");
    await beforeWrite();
    await this.request("/values:batchUpdate", { method: "POST", body });
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
