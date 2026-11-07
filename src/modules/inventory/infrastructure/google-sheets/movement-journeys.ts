import "server-only";
import type { GoogleSheetRow, IGoogleRowsSheet } from "@/infrastructure/persistence/google-sheets/types";
import { readAndRepairRows, type RepairRowsTable } from "@/infrastructure/persistence/google-sheets/read-and-repair-rows";
import type { MovementJourneyItem, MovementJourneyMaster } from "../../contracts";
import type { MovementJourneyStore, MovementJourneyMasterReference } from "../../application/ports/movement-journeys";
import { MASTER_HEADERS, DETAIL_HEADERS } from "./movement-schema";
type TableName = 'movementMasters' | 'movementDetails';
type JourneySheets = {
    movementMasters: IGoogleRowsSheet;
    movementDetails: IGoogleRowsSheet;
    readMovementRanges?(ranges: {
        sheet: TableName;
        range: string;
    }[]): Promise<GoogleSheetRow[][]>;
};
const rawItems = new WeakMap<MovementJourneyItem, GoogleSheetRow>();
export function createMovementJourneyAdapter(sheets: JourneySheets) {
    const locations = new WeakMap<MovementJourneyMasterReference, number>();
    const tables: {
        [key in TableName]: RepairRowsTable & {
            range: string;
        };
    } = { movementMasters: { headers: MASTER_HEADERS, headerRange: 'A1:H1', range: 'A:H', sheet: () => sheets.movementMasters }, movementDetails: { headers: DETAIL_HEADERS, headerRange: 'A1:N1', range: 'A:N', sheet: () => sheets.movementDetails } };
    function project(row: GoogleSheetRow): MovementJourneyItem { const value = { get id() { return row[0]; }, get masterId() { return row[1]; }, get shop() { return row[2]; }, get quantity() { return row[3]; }, get remark() { return row[4]; }, get fromLocation() { return row[5]; }, get toLocation() { return row[6]; }, get imageUrl() { return row[7]; }, get purchaseDetailId() { return row[8]; }, get status() { return row[9]; }, get createdAt() { return row[10]; }, get updatedAt() { return row[11]; }, get stockCounted() { return row[12]; }, get isNewArrival() { return row[13]; } }; rawItems.set(value, row); return value; }
    function projectItems(rows: GoogleSheetRow[]) { return rows.map(project); }
    function itemsFor(rows: GoogleSheetRow[], readId: () => string | undefined) { return rows.slice(1).filter(row => row[1] === readId() && row[0]).map(project); }
    function master(row: GoogleSheetRow, index: number): MovementJourneyMasterReference { const value = { get id() { return row[0]; }, get userId() { return row[1]; }, get packingDate() { return row[2]; }, get deliveredAt() { return row[3]; }, get status() { return row[4]; }, get quantity() { return row[5]; }, get createdAt() { return row[6]; }, get updatedAt() { return row[7]; } }; locations.set(value, index + 1); return value; }
    function serializeMaster(value: MovementJourneyMaster): GoogleSheetRow { return [value.id, value.userId, value.packingDate, value.deliveredAt, value.status, value.quantity, value.createdAt, value.updatedAt] as GoogleSheetRow; }
    function serializeItem(value: MovementJourneyItem): GoogleSheetRow { return [value.id, value.masterId, value.shop, value.quantity, value.remark, value.fromLocation, value.toLocation, value.imageUrl, value.purchaseDetailId, value.status, value.createdAt, value.updatedAt, value.stockCounted, value.isNewArrival] as GoogleSheetRow; }
    function read(names: TableName[]) { const ranges = names.map(sheet => ({ sheet, range: tables[sheet].range })); return readAndRepairRows(names.map(name => tables[name]), () => sheets.readMovementRanges ? sheets.readMovementRanges(ranges) : Promise.all(ranges.map(({ sheet, range }) => sheets[sheet].readRows(range)))); }
    const store: MovementJourneyStore = {
        async readCombined() { const [rows, details] = await read(['movementMasters', 'movementDetails']); return { findMaster(readId) { const index = rows.findIndex((row, i) => i > 0 && row[0] === readId()); return index < 0 ? undefined : master(rows[index], index); }, items: readId => itemsFor(details, readId) }; },
        async readMasters() { const [rows] = await read(['movementMasters']); return rows.slice(1).map((row, index) => master(row, index + 1)); },
        async readItems(masterId) { const [rows] = await read(['movementDetails']); return itemsFor(rows, () => masterId); },
        appendItem: readItem => sheets.movementDetails.appendRows('A:N', [serializeItem(readItem())]),
        appendMaster: value => sheets.movementMasters.appendRows('A:H', [serializeMaster(value)]),
        updateMaster: (target, value) => sheets.movementMasters.updateRows(`A${locations.get(target)!}:H${locations.get(target)!}`, [serializeMaster(value)])
    };
    return { store, tables, itemsFor, projectItems, rawItems: (items: MovementJourneyItem[]) => items.map(item => rawItems.get(item)!) };
}
