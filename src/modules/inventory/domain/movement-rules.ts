import type { ProductMovementRecord, ProductMovementMasterRecord, MovementDateFilter } from "../contracts";
export function matchesDateFilter(
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

export function sumQuantity(records: ProductMovementRecord[]): number {
  return records.reduce((sum, record) => sum + toNumber(record.quantity), 0);
}

export function toNumber(value: string): number {
  const number = Number(value.replace(/,/g, ""));
  return Number.isFinite(number) ? number : 0;
}

