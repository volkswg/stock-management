import type { GoogleSheetRow, IGoogleRowsSheet, IGoogleSheetsService } from "@/externals/google/sheet/types";
import { USER_STATE_SHEET_HEADERS } from "@/externals/google/sheet/sheets/user-state/const";

export const MOVEMENT_FLOW = "MovementCreate";
export const MASTER_HEADERS = [
  "id", "userId", "packingDate", "deliverDateTime", "status",
  "totalQuantity", "createdAt", "updatedAt",
];
export const DETAIL_HEADERS = [
  "id", "movementMasterId", "shopName", "quantity", "remark",
  "fromLocation", "toLocation", "productImageUrl", "purchaseDetailId",
  "status", "createdAt", "updatedAt", "stockCounted",
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

export async function readMovementSession(sheets: IGoogleSheetsService, userId: string, eventId: string): Promise<{ state?: MovementState; processed: boolean }> {
  await ensureHeader(sheets.userState, USER_STATE_SHEET_HEADERS, "H");
  const rows = await sheets.userState.readRows("A:H");
  const history = rows.filter((row) => row[1] === userId && row[2] === MOVEMENT_FLOW);
  const row = history.at(-1);
  if (!row) return { processed: false };
  let context: unknown;
  try {
    context = JSON.parse(String(row[7] || ""));
  } catch {
    throw new Error("Movement user state contains invalid context.");
  }
  if (!isRecord(context) ||
    !["masterId", "itemId", "userId", "startedAt", "shop", "quantity", "remark", "imageUrl", "lastEventId"].every((key) => typeof context[key] === "string") ||
    !isStep(context.step) || context.masterId !== row[3] || context.userId !== userId || context.step !== row[4]
  ) {
    throw new Error("Movement user state is incomplete. Please resume the movement.");
  }
  const processed = history.some((checkpoint) => {
    try {
      const saved: unknown = JSON.parse(String(checkpoint[7] || ""));
      return isRecord(saved) && saved.lastEventId === eventId;
    } catch {
      return false;
    }
  });
  return { state: context as MovementState, processed };
}

export async function saveMovementState(sheets: IGoogleSheetsService, state: MovementState): Promise<void> {
  // Append a checkpoint; never overwrite the existing order-create state rows.
  await ensureHeader(sheets.userState, USER_STATE_SHEET_HEADERS, "H");
  await sheets.userState.appendRows("A:H", [[
    `${state.masterId}:${state.itemId}:${state.step}:${state.lastEventId}`,
    state.userId, MOVEMENT_FLOW, state.masterId, state.step,
    state.startedAt, new Date().toISOString(), JSON.stringify(state),
  ]]);
}

export async function movementItems(sheets: IGoogleSheetsService, masterId: string): Promise<GoogleSheetRow[]> {
  await ensureHeader(sheets.movementDetails, DETAIL_HEADERS, "M");
  return (await sheets.movementDetails.readRows("A2:M")).filter((row) => row[1] === masterId && row[0]);
}

export async function saveMaster(sheets: IGoogleSheetsService, state: MovementState, complete = false): Promise<void> {
  await ensureHeader(sheets.movementMasters, MASTER_HEADERS, "H");
  const rows = await sheets.movementMasters.readRows("A:H");
  const index = rows.findIndex((row, i) => i > 0 && row[0] === state.masterId);
  const existing = rows[index];
  const items = await movementItems(sheets, state.masterId);
  const total = items.reduce((sum, row) => sum + (Number(String(row[3] || "0").replace(/,/g, "")) || 0), 0);
  const row: GoogleSheetRow = [
    state.masterId, state.userId, existing?.[2] || state.startedAt,
    existing?.[3] || "", existing?.[4] === "delivered" ? "delivered" : complete ? "created" : "in_progress",
    String(total), existing?.[6] || state.startedAt, new Date().toISOString(),
  ];
  if (index === -1) await sheets.movementMasters.appendRows("A:H", [row]);
  else await sheets.movementMasters.updateRows(`A${index + 1}:H${index + 1}`, [row]);
}

export async function resumeLegacyMovement(sheets: IGoogleSheetsService, userId: string): Promise<MovementState | undefined> {
  await ensureHeader(sheets.movementMasters, MASTER_HEADERS, "H");
  const master = (await sheets.movementMasters.readRows("A2:H"))
    .filter((row) => row[1] === userId && row[4] === "in_progress")
    .sort((a, b) => String(b[7]).localeCompare(String(a[7])))[0];
  if (!master) return undefined;
  const masterId = String(master[0]);
  const items = await movementItems(sheets, masterId);
  return {
    masterId, itemId: `${masterId}-RESUME-${Date.now()}`, userId,
    step: items.length ? "bag_closed" : "shop",
    startedAt: String(master[6] || master[2]), shop: "", quantity: "", remark: "", imageUrl: "", lastEventId: "",
  };
}

function isStep(value: unknown): value is MovementStep {
  return typeof value === "string" && ["shop", "quantity", "product_image", "close_bag", "bag_closed", "complete"].includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
