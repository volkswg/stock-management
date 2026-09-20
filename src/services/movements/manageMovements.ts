import type {
  GoogleSheetRow,
  IGoogleSheetsService,
} from "@/externals/google/sheet";
import { DETAIL_HEADERS, ensureHeader, MASTER_HEADERS } from "./state";

export type MovementStatus = "in_progress" | "created" | "delivered";

export type ProductMovementRecord = {
  movementId: string;
  movementMasterId: string;
  shopName: string;
  quantity: string;
  remark: string;
  fromLocation: string;
  toLocation: string;
  productImageUrl: string;
  purchaseDetailId: string;
  status: "created" | "delivered";
  createdAt: string;
  updatedAt: string;
  stockCounted: boolean;
};

export type ProductMovementMasterRecord = {
  id: string;
  userId: string;
  packingDate: string;
  deliverDateTime?: string;
  status: MovementStatus;
  totalQuantity: string;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  shopQuantities: Record<string, number>;
};

export type MovementDateFilter = {
  date?: string;
  fromDate?: string;
  toDate?: string;
};

export async function listMovements({
  filter,
  googleSheetsService,
}: {
  filter: MovementDateFilter;
  googleSheetsService: IGoogleSheetsService;
}): Promise<ProductMovementMasterRecord[]> {
  await Promise.all([
    ensureHeader(googleSheetsService.movementMasters, MASTER_HEADERS, "H"),
    ensureHeader(googleSheetsService.movementDetails, DETAIL_HEADERS, "M"),
  ]);
  const [masterRows, detailRows] = await Promise.all([
    googleSheetsService.movementMasters.readRows("A2:H"),
    googleSheetsService.movementDetails.readRows("A2:M"),
  ]);
  const detailsByMaster = new Map<string, ProductMovementRecord[]>();
  for (const row of detailRows) {
    const detail = rowToMovement(row);
    if (!detail.movementId || !detail.movementMasterId) continue;
    detailsByMaster.set(detail.movementMasterId, [
      ...(detailsByMaster.get(detail.movementMasterId) || []),
      detail,
    ]);
  }

  return masterRows
    .map((row) =>
      rowToMovementMaster(row, detailsByMaster.get(cell(row[0])) || []),
    )
    .filter((record) => record.id && matchesDateFilter(record, filter));
}

export async function getMovementItems({
  googleSheetsService,
  movementMasterId,
}: {
  googleSheetsService: IGoogleSheetsService;
  movementMasterId: string;
}): Promise<ProductMovementRecord[]> {
  await ensureHeader(googleSheetsService.movementDetails, DETAIL_HEADERS, "M");
  const normalizedId = movementMasterId.toUpperCase();
  return (await googleSheetsService.movementDetails.readRows("A2:M"))
    .map(rowToMovement)
    .filter(
      (record) =>
        record.movementId &&
        record.movementMasterId.toUpperCase() === normalizedId,
    );
}

export async function updateMovementItem({
  googleSheetsService,
  movementId,
  movementMasterId,
  quantity,
  remark,
  stockCounted,
}: {
  googleSheetsService: IGoogleSheetsService;
  movementId: string;
  movementMasterId: string;
  quantity?: string;
  remark?: string;
  stockCounted?: boolean;
}): Promise<ProductMovementRecord[] | null> {
  await ensureHeader(googleSheetsService.movementDetails, DETAIL_HEADERS, "M");
  const rows = await googleSheetsService.movementDetails.readRows("A:M");
  const rowIndex = rows.findIndex(
    (row, index) =>
      index > 0 &&
      cell(row[0]).toUpperCase() === movementId.toUpperCase() &&
      cell(row[1]).toUpperCase() === movementMasterId.toUpperCase(),
  );
  if (rowIndex === -1) return null;

  const nextRow = [...rows[rowIndex]];
  while (nextRow.length < DETAIL_HEADERS.length) nextRow.push("");
  if (quantity !== undefined) nextRow[3] = quantity;
  if (remark !== undefined) nextRow[4] = remark;
  if (stockCounted !== undefined) nextRow[12] = stockCounted;
  nextRow[11] = new Date().toISOString();
  await googleSheetsService.movementDetails.updateRows(
    `A${rowIndex + 1}:M${rowIndex + 1}`,
    [nextRow],
  );
  await refreshMovementMaster(googleSheetsService, movementMasterId);
  return getMovementItems({ googleSheetsService, movementMasterId });
}

export async function updateMovementImage({
  googleSheetsService,
  imageUrl,
  movementId,
  movementMasterId,
}: {
  googleSheetsService: IGoogleSheetsService;
  imageUrl: string;
  movementId: string;
  movementMasterId: string;
}): Promise<ProductMovementRecord[] | null> {
  await ensureHeader(googleSheetsService.movementDetails, DETAIL_HEADERS, "M");
  const rows = await googleSheetsService.movementDetails.readRows("A:M");
  const rowIndex = rows.findIndex(
    (row, index) =>
      index > 0 &&
      cell(row[0]).toUpperCase() === movementId.toUpperCase() &&
      cell(row[1]).toUpperCase() === movementMasterId.toUpperCase(),
  );
  if (rowIndex === -1) return null;

  const nextRow = [...rows[rowIndex]];
  while (nextRow.length < DETAIL_HEADERS.length) nextRow.push("");
  nextRow[7] = imageUrl;
  nextRow[11] = new Date().toISOString();
  await googleSheetsService.movementDetails.updateRows(
    `A${rowIndex + 1}:M${rowIndex + 1}`,
    [nextRow],
  );
  await refreshMovementMaster(googleSheetsService, movementMasterId);
  return getMovementItems({ googleSheetsService, movementMasterId });
}

export async function markMovementDelivered({
  googleSheetsService,
  movementMasterId,
}: {
  googleSheetsService: IGoogleSheetsService;
  movementMasterId: string;
}): Promise<{
  movementMaster: ProductMovementMasterRecord;
  records: ProductMovementRecord[];
} | null> {
  await Promise.all([
    ensureHeader(googleSheetsService.movementMasters, MASTER_HEADERS, "H"),
    ensureHeader(googleSheetsService.movementDetails, DETAIL_HEADERS, "M"),
  ]);
  const [masterRows, detailRows] = await Promise.all([
    googleSheetsService.movementMasters.readRows("A:H"),
    googleSheetsService.movementDetails.readRows("A:M"),
  ]);
  const normalizedId = movementMasterId.toUpperCase();
  const masterIndex = masterRows.findIndex(
    (row, index) => index > 0 && cell(row[0]).toUpperCase() === normalizedId,
  );
  const detailIndexes = detailRows.flatMap((row, index) =>
    index > 0 && cell(row[1]).toUpperCase() === normalizedId ? [index] : [],
  );
  if (masterIndex === -1 || detailIndexes.length === 0) return null;

  const now = new Date().toISOString();
  await Promise.all(
    detailIndexes.map((index) => {
      const nextRow = [...detailRows[index]];
      while (nextRow.length < DETAIL_HEADERS.length) nextRow.push("");
      nextRow[9] = "delivered";
      nextRow[11] = now;
      return googleSheetsService.movementDetails.updateRows(
        `A${index + 1}:M${index + 1}`,
        [nextRow],
      );
    }),
  );

  const nextMasterRow = [...masterRows[masterIndex]];
  while (nextMasterRow.length < MASTER_HEADERS.length) nextMasterRow.push("");
  nextMasterRow[3] = now;
  nextMasterRow[4] = "delivered";
  nextMasterRow[7] = now;
  await googleSheetsService.movementMasters.updateRows(
    `A${masterIndex + 1}:H${masterIndex + 1}`,
    [nextMasterRow],
  );

  const records = await getMovementItems({
    googleSheetsService,
    movementMasterId,
  });
  return {
    movementMaster: rowToMovementMaster(nextMasterRow, records),
    records,
  };
}

async function refreshMovementMaster(
  googleSheetsService: IGoogleSheetsService,
  movementMasterId: string,
): Promise<void> {
  await ensureHeader(googleSheetsService.movementMasters, MASTER_HEADERS, "H");
  const [rows, items] = await Promise.all([
    googleSheetsService.movementMasters.readRows("A:H"),
    getMovementItems({ googleSheetsService, movementMasterId }),
  ]);
  const rowIndex = rows.findIndex(
    (row, index) =>
      index > 0 &&
      cell(row[0]).toUpperCase() === movementMasterId.toUpperCase(),
  );
  if (rowIndex === -1) return;
  const nextRow = [...rows[rowIndex]];
  while (nextRow.length < MASTER_HEADERS.length) nextRow.push("");
  nextRow[5] = String(sumQuantity(items));
  nextRow[7] = new Date().toISOString();
  await googleSheetsService.movementMasters.updateRows(
    `A${rowIndex + 1}:H${rowIndex + 1}`,
    [nextRow],
  );
}

function rowToMovement(row: GoogleSheetRow): ProductMovementRecord {
  return {
    movementId: cell(row[0]),
    movementMasterId: cell(row[1]),
    shopName: cell(row[2]),
    quantity: cell(row[3]),
    remark: cell(row[4]),
    fromLocation: cell(row[5]),
    toLocation: cell(row[6]),
    productImageUrl: cell(row[7]),
    purchaseDetailId: cell(row[8]),
    status: cell(row[9]).toLowerCase() === "delivered" ? "delivered" : "created",
    createdAt: cell(row[10]),
    updatedAt: cell(row[11]),
    stockCounted: booleanCell(row[12]),
  };
}

function rowToMovementMaster(
  row: GoogleSheetRow,
  details: ProductMovementRecord[],
): ProductMovementMasterRecord {
  const status = cell(row[4]).toLowerCase();
  return {
    id: cell(row[0]),
    userId: cell(row[1]),
    packingDate: cell(row[2]),
    deliverDateTime: cell(row[3]) || undefined,
    status:
      status === "delivered"
        ? "delivered"
        : status === "in_progress"
          ? "in_progress"
          : "created",
    totalQuantity: cell(row[5]) || String(sumQuantity(details)),
    createdAt: cell(row[6]),
    updatedAt: cell(row[7]),
    itemCount: details.length,
    shopQuantities: details.reduce<Record<string, number>>((totals, detail) => {
      const shop = detail.shopName || "Unknown";
      totals[shop] = (totals[shop] || 0) + toNumber(detail.quantity);
      return totals;
    }, {}),
  };
}

function matchesDateFilter(
  record: ProductMovementMasterRecord,
  filter: MovementDateFilter,
): boolean {
  const date = toBangkokDate(record.packingDate);
  if (!date) return false;
  if (filter.date && date !== filter.date) return false;
  if (filter.fromDate && date < filter.fromDate) return false;
  if (filter.toDate && date > filter.toDate) return false;
  return true;
}

function toBangkokDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function sumQuantity(records: ProductMovementRecord[]): number {
  return records.reduce((sum, record) => sum + toNumber(record.quantity), 0);
}

function toNumber(value: string): number {
  const number = Number(value.replace(/,/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function cell(value: GoogleSheetRow[number]): string {
  return value === null || value === undefined ? "" : String(value);
}

function booleanCell(value: GoogleSheetRow[number]): boolean {
  return value === true || cell(value).toLowerCase() === "true";
}
