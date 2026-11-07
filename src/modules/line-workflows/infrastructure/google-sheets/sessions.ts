import "server-only";
import type { GoogleSheetRow, IGoogleRowsSheet } from "@/infrastructure/persistence/google-sheets/types";
import { lastColumnLetter } from "@/infrastructure/persistence/google-sheets/const";
import { readAndRepairRows, type RepairRowsTable } from "@/infrastructure/persistence/google-sheets/read-and-repair-rows";
import { USER_STATE_SHEET_HEADERS } from "./user-state/const";
import { OrderStatus } from "@/modules/orders/contracts";
import type { MovementJourneyItem } from "@/modules/inventory/contracts";
import { MOVEMENT_FLOW, UserStateFlowName, type UserState } from "../../contracts";
import type { OrderSessionStore, MovementSessionStore, MovementSessionSnapshot, SessionEntry } from "../../application/ports/workflows";
type Name = 'userState' | 'movementDetails' | 'movementMasters';
type SessionSheets = {
    userState: IGoogleRowsSheet;
    movementDetails: IGoogleRowsSheet;
    movementMasters: IGoogleRowsSheet;
    readMovementRanges?(ranges: {
        sheet: Name;
        range: string;
    }[]): Promise<GoogleSheetRow[][]>;
};
type InventoryProjection = {
    tables: {
        movementDetails: RepairRowsTable & {
            range: string;
        };
        movementMasters: RepairRowsTable & {
            range: string;
        };
    };
    itemsFor(rows: GoogleSheetRow[], readMasterId: () => string | undefined): MovementJourneyItem[];
};
export function createSessionAdapter(sheets: SessionSheets, inventory: InventoryProjection) {
    function readTables(names: Name[]): Promise<GoogleSheetRow[][]> { const schemas = { userState: { headers: USER_STATE_SHEET_HEADERS, headerRange: 'A1:H1', range: 'A:H', sheet: () => sheets.userState }, movementDetails: inventory.tables.movementDetails, movementMasters: inventory.tables.movementMasters }; const ranges = names.map(sheet => ({ sheet, range: schemas[sheet].range })); return readAndRepairRows(names.map(name => schemas[name]), () => sheets.readMovementRanges ? sheets.readMovementRanges(ranges) : Promise.all(ranges.map(({ sheet, range }) => sheets[sheet].readRows(range)))); }
    function snapshot(rows: GoogleSheetRow[]): MovementSessionSnapshot {
        const locations = new WeakMap<SessionEntry, number>();
        function entry(row: GoogleSheetRow, index: number): SessionEntry { const value = { get id() { return row[0]; }, get referenceId() { return row[3]; }, get step() { return row[4]; }, get createdAt() { return row[5]; }, get context() { return row[7]; } }; locations.set(value, index + 1); return value; }
        return {
            latestForReading(userId) { const reversed = rows.slice().reverse(), row = reversed.find(candidate => candidate[1] === userId && candidate[2] === MOVEMENT_FLOW); return row ? entry(row, rows.indexOf(row)) : undefined; },
            findForWriting(readUserId) { for (let index = rows.length - 1; index > 0; index--)
                if (rows[index]?.[1] === readUserId() && rows[index]?.[2] === MOVEMENT_FLOW)
                    return entry(rows[index], index); return undefined; },
            nextIdentifier: () => String(rows.length + 1), eraseMovement: userId => deleteMovementStateRows(sheets.userState, rows, userId),
            async writeMovement(target, value) { const values: GoogleSheetRow = [value.id as GoogleSheetRow[number], value.userId, value.flowname, value.referenceId, value.state, value.createdAt as GoogleSheetRow[number], value.updatedAt, value.context]; if (!target)
                await sheets.userState.appendRows('A:H', [values]);
            else
                await sheets.userState.updateRows(`A${locations.get(target)!}:H${locations.get(target)!}`, [values]); }
        };
    }
    const orders: OrderSessionStore = {
        async findLatest(userId, flowname) { const rows = await sheets.userState.readRows(); return rows.map(mapUserStateRow).filter((value): value is UserState => Boolean(value)).reverse().find(value => value.userId === userId && value.flowname === flowname); },
        async nextIdentifier() { const rows = await sheets.userState.readRows('A:A'); return String(rows.length + 1); },
        append: value => sheets.userState.appendRows(`A:${lastColumnLetter(USER_STATE_SHEET_HEADERS.length - 1)}`, [[value.id, value.userId, value.flowname, value.referenceId, value.state, value.createdAt, value.updatedAt]]),
        reference(id) { const row = parseSheetRowNumber(id, 'user state'); return { update: (state, createdAt, now) => sheets.userState.updateRows(`E${row}:G${row}`, [[state, createdAt, now]]), clear: () => sheets.userState.updateRows(`A${row}:G${row}`, [["", "", "", "", "", "", ""]]) }; }
    };
    const movements: MovementSessionStore = { async read() { return snapshot((await readTables(['userState']))[0]); } };
    return { orders, movements, readTables, snapshot, async photoContext() { const [users, items] = await readTables(['userState', 'movementDetails']); return { sessions: snapshot(users), items: (readMasterId: () => string | undefined) => inventory.itemsFor(items, readMasterId) }; } };
}
function parseSheetRowNumber(value: string, label: string): number { const rowNumber = Number(value); if (!Number.isInteger(rowNumber) || rowNumber < 2)
    throw new Error(`Invalid ${label} row number.`); return rowNumber; }
function mapUserStateRow(row: GoogleSheetRow): UserState | undefined {
    const [id, userId, flowname, referenceId, state, createdAt, updatedAt] = row;
    if (typeof id !== "string" ||
        typeof userId !== "string" ||
        typeof flowname !== "string" ||
        typeof referenceId !== "string" ||
        typeof state !== "string") {
        return undefined;
    }
    if (!isUserStateFlowName(flowname) || !isOrderStatus(state)) {
        return undefined;
    }
    return {
        id,
        userId,
        flowname,
        referenceId,
        state,
        createdAt: typeof createdAt === "string" ? createdAt : "",
        updatedAt: typeof updatedAt === "string" ? updatedAt : "",
    };
}
function isUserStateFlowName(value: string): value is UserStateFlowName {
    return Object.values(UserStateFlowName).includes(value as UserStateFlowName);
}
function isOrderStatus(value: string): value is OrderStatus {
    return Object.values(OrderStatus).includes(value as OrderStatus);
}
async function deleteMovementStateRows(sheet: IGoogleRowsSheet, rows: GoogleSheetRow[], userId: string): Promise<void> {
    const rowNumbers: number[] = [];
    for (let index = 1; index < rows.length; index += 1) {
        if (rows[index]?.[1] === userId && rows[index]?.[2] === MOVEMENT_FLOW) {
            rowNumbers.push(index + 1);
        }
    }
    if (!rowNumbers.length)
        return;
    const deleteRow = sheet.deleteRow?.bind(sheet);
    if (!deleteRow) {
        throw new Error("Google Sheets user state row deletion is unavailable.");
    }
    for (const rowNumber of rowNumbers.reverse()) {
        await deleteRow(rowNumber);
    }
}
