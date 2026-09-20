import dayjs, { type Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
const BANGKOK_OFFSET_MINUTES = 7 * 60;

export function formatBangkokDate(value: string): string {
  const date = dayjs.utc(value).utcOffset(BANGKOK_OFFSET_MINUTES);
  return date.isValid() ? date.format("YYYY-MM-DD") : "";
}

export function formatBangkokDateTime(value?: string): string {
  if (!value) return "";
  const date = dayjs.utc(value).utcOffset(BANGKOK_OFFSET_MINUTES);
  return date.isValid() ? date.format("YYYY-MM-DD HH:mm") : value;
}

export function getCurrentBangkokDate(): Dayjs {
  return dayjs().utcOffset(BANGKOK_OFFSET_MINUTES);
}

export function formatShopTotals(totals: Record<string, number>): string {
  const entries = Object.entries(totals).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  return entries.length
    ? entries.map(([shop, quantity]) => `${shop}: ${quantity}`).join(" | ")
    : "—";
}

export function toNumber(value: string): number {
  const number = Number(value.replace(/,/g, ""));
  return Number.isFinite(number) ? number : 0;
}

export function movementImageUrl(value: string, size: number): string {
  const driveId =
    value.match(/[?&]id=([^&]+)/)?.[1] ||
    value.match(/\/file\/d\/([^/]+)/)?.[1];
  return driveId
    ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveId)}&sz=w${size}`
    : value;
}
