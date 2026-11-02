import type { GoogleSheetRow, IGoogleRowsSheet, IGoogleSheetsService, MovementWorksheet } from "@/externals/google/sheet/types";
import { USER_STATE_SHEET_HEADERS } from "@/externals/google/sheet/sheets/user-state/const";
import { createSortableId } from "@/services/utils/createSortableId";

export const MOVEMENT_FLOW = "MovementCreate";
export const MASTER_HEADERS = [
  "id", "userId", "packingDate", "deliverDateTime", "status",
  "totalQuantity", "createdAt", "updatedAt",
];
export const DETAIL_HEADERS = [
  "id", "movementMasterId", "shopName", "quantity", "remark",
  "fromLocation", "toLocation", "productImageUrl", "purchaseDetailId",
  "status", "createdAt", "updatedAt", "stockCounted", "isNewArrival",
];
export type MovementStep = "shop" | "quantity" | "product_image" | "close_bag" | "bag_closed" | "complete";
export type MovementState = {
  masterId: string;
  itemId: string;
  userId: string;
  step: MovementStep;
  startedAt: string;
  shop: string;
  quantity: string;
  remark: string;
  imageUrl: string;
  lastEventId: string;
};

export async function ensureHeader(sheet: IGoogleRowsSheet, headers: string[], end: string): Promise<void> {
  await sheet.ensureExists?.();
  const rows = await sheet.readRows(`A1:${end}1`);
  if (JSON.stringify(rows[0] || []) !== JSON.stringify(headers)) {
    await sheet.updateRows(`A1:${end}1`, [headers]);
  }
}

// Header validation shares the data read. No mutable rows are cached across events.
export async function readMovementTables(
  sheets: IGoogleSheetsService, tables: MovementWorksheet[],
): Promise<GoogleSheetRow[][]> {
  const schemas = {
    userState: { headers: USER_STATE_SHEET_HEADERS, end: "H" },
    movementDetails: { headers: DETAIL_HEADERS, end: "N" },
    movementMasters: { headers: MASTER_HEADERS, end: "H" },
  };
  const ranges = tables.map((sheet) => ({ sheet, range: `A:${schemas[sheet].end}` }));
  const read = () => sheets.readMovementRanges
    ? sheets.readMovementRanges(ranges)
    : Promise.all(ranges.map(({ sheet, range }) => sheets[sheet].readRows(range)));
  let results: GoogleSheetRow[][];
  try {
    results = await read();
  } catch (error) {
    // Only provision a missing worksheet. Never turn quota/auth failures into more reads.
    if (!(error instanceof Error) ||
      !/Google Sheets API request failed: 400/.test(error.message) ||
      !/Unable to parse range/i.test(error.message)) throw error;
    for (const table of tables) await sheets[table].ensureExists?.();
    results = await read();
  }
  for (let index = 0; index < tables.length; index++) {
    const table = tables[index];
    const { headers, end } = schemas[table];
    const rows = results[index];
    if (JSON.stringify(rows[0] || []) !== JSON.stringify(headers)) {
      await sheets[table].updateRows(`A1:${end}1`, [headers]);
      results[index] = [headers, ...rows.slice(1)];
    }
  }
  return results;
}

export async function readMovementSession(sheets: IGoogleSheetsService, userId: string, eventId: string, loadedRows?: GoogleSheetRow[]): Promise<{ state?: MovementState; processed: boolean }> {
  const rows = loadedRows ?? (await readMovementTables(sheets, ["userState"]))[0];
  const row = rows
    .slice()
    .reverse()
    .find((candidate) => candidate[1] === userId && candidate[2] === MOVEMENT_FLOW);
  if (!row) return { processed: false };

  if (!String(row[7] || "").trim()) {
    if (row[4] === "complete") {
      await deleteMovementStateRows(sheets.userState, rows, userId);
      return { processed: false };
    }
    throw new Error("Movement user state is missing its active context.");
  }

  let context: unknown;
  try {
    context = JSON.parse(String(row[7]));
  } catch {
    throw new Error("Movement user state contains invalid context.");
  }
  if (!isRecord(context) ||
    !["masterId", "itemId", "userId", "startedAt", "shop", "quantity", "remark", "imageUrl", "lastEventId"].every((key) => typeof context[key] === "string") ||
    !isStep(context.step) || context.masterId !== row[3] || context.userId !== userId || context.step !== row[4]
  ) {
    throw new Error("Movement user state is incomplete. Please resume the movement.");
  }
  const state = context as MovementState;
  return { state, processed: state.lastEventId === eventId };
}

export async function saveMovementState(sheets: IGoogleSheetsService, state: MovementState): Promise<void> {
  const [rows] = await readMovementTables(sheets, ["userState"]);
  let existingRowIndex = -1;
  for (let index = rows.length - 1; index > 0; index -= 1) {
    if (rows[index]?.[1] === state.userId && rows[index]?.[2] === MOVEMENT_FLOW) {
      existingRowIndex = index;
      break;
    }
  }

  const existingRow = existingRowIndex === -1 ? undefined : rows[existingRowIndex];
  if (state.step === "complete") {
    await deleteMovementStateRows(sheets.userState, rows, state.userId);
    return;
  }

  const isSameMovement = existingRow?.[3] === state.masterId;
  const now = new Date().toISOString();
  const values: GoogleSheetRow = [
    existingRow?.[0] || String(rows.length + 1),
    state.userId,
    MOVEMENT_FLOW,
    state.masterId,
    state.step,
    isSameMovement ? existingRow?.[5] || state.startedAt : state.startedAt,
    now,
    JSON.stringify(state),
  ];

  if (existingRowIndex === -1) {
    await sheets.userState.appendRows("A:H", [values]);
    return;
  }

  const rowNumber = existingRowIndex + 1;
  await sheets.userState.updateRows(`A${rowNumber}:H${rowNumber}`, [values]);
}

export async function movementItems(sheets: IGoogleSheetsService, masterId: string): Promise<GoogleSheetRow[]> {
  const [rows] = await readMovementTables(sheets, ["movementDetails"]);
  return rows.slice(1).filter((row) => row[1] === masterId && row[0]);
}

export async function saveMaster(sheets: IGoogleSheetsService, state: MovementState, complete = false): Promise<void> {
  const [rows, detailRows] = await readMovementTables(sheets, ["movementMasters", "movementDetails"]);
  const index = rows.findIndex((row, i) => i > 0 && row[0] === state.masterId);
  const existing = rows[index];
  const items = detailRows.slice(1).filter((row) => row[1] === state.masterId && row[0]);
  const total = items.reduce((sum, row) => sum + (Number(String(row[3] || "0").replace(/,/g, "")) || 0), 0);
  const row: GoogleSheetRow = [
    state.masterId, state.userId, existing?.[2] || state.startedAt,
    existing?.[3] || "", existing?.[4] === "delivered" ? "delivered" : complete || existing?.[4] === "created" ? "created" : "in_progress",
    String(total), existing?.[6] || state.startedAt, new Date().toISOString(),
  ];
  if (index === -1) await sheets.movementMasters.appendRows("A:H", [row]);
  else await sheets.movementMasters.updateRows(`A${index + 1}:H${index + 1}`, [row]);
}

export async function resumeLegacyMovement(sheets: IGoogleSheetsService, userId: string): Promise<MovementState | undefined> {
  const [rows] = await readMovementTables(sheets, ["movementMasters"]);
  const master = rows.slice(1)
    .filter((row) => row[1] === userId && row[4] === "in_progress")
    .sort((a, b) => String(b[7]).localeCompare(String(a[7])))[0];
  if (!master) return undefined;
  const masterId = String(master[0]);
  const items = await movementItems(sheets, masterId);
  return {
    masterId, itemId: `MOVED-${createSortableId()}`, userId,
    step: items.length ? "bag_closed" : "shop",
    startedAt: String(master[6] || master[2]), shop: "", quantity: "", remark: "", imageUrl: "", lastEventId: "",
  };
}

async function deleteMovementStateRows(
  sheet: IGoogleRowsSheet,
  rows: GoogleSheetRow[],
  userId: string,
): Promise<void> {
  const rowNumbers: number[] = [];
  for (let index = 1; index < rows.length; index += 1) {
    if (rows[index]?.[1] === userId && rows[index]?.[2] === MOVEMENT_FLOW) {
      rowNumbers.push(index + 1);
    }
  }
  if (!rowNumbers.length) return;

  const deleteRow = sheet.deleteRow?.bind(sheet);
  if (!deleteRow) {
    throw new Error("Google Sheets user state row deletion is unavailable.");
  }
  for (const rowNumber of rowNumbers.reverse()) {
    await deleteRow(rowNumber);
  }
}

function isStep(value: unknown): value is MovementStep {
  return typeof value === "string" && ["shop", "quantity", "product_image", "close_bag", "bag_closed", "complete"].includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
