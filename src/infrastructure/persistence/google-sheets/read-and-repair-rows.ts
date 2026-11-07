import type { GoogleSheetRow, IGoogleRowsSheet } from "./types";
export type RepairRowsTable = {
    headers: string[];
    headerRange: string;
    sheet(): IGoogleRowsSheet;
};
// Existing movement batching/recovery shared by Inventory tables and LINE session storage.
export async function readAndRepairRows(tables: RepairRowsTable[], read: () => Promise<GoogleSheetRow[][]>): Promise<GoogleSheetRow[][]> {
    let results: GoogleSheetRow[][];
    try {
        results = await read();
    }
    catch (error) {
        if (!(error instanceof Error) || !/Google Sheets API request failed: 400/.test(error.message) || !/Unable to parse range/i.test(error.message))
            throw error;
        for (const table of tables)
            await table.sheet().ensureExists?.();
        results = await read();
    }
    for (let index = 0; index < tables.length; index++) {
        const { headers, headerRange } = tables[index];
        const rows = results[index];
        if (JSON.stringify(rows[0] || []) !== JSON.stringify(headers)) {
            await tables[index].sheet().updateRows(headerRange, [headers]);
            results[index] = [headers, ...rows.slice(1)];
        }
    }
    return results;
}
