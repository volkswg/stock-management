import type { ILoyverseService, LoyverseReceipt } from "@/externals/loyverse";

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export async function getLoyverseReceiptsForSalesDate({
  loyverseService,
  salesDate,
  storeId,
}: {
  loyverseService: ILoyverseService;
  salesDate: string;
  storeId?: string;
}): Promise<LoyverseReceipt[]> {
  const range = createBangkokDateRange(salesDate);
  if (!range) {
    throw new Error("A valid date in YYYY-MM-DD format is required.");
  }

  return loyverseService.getReceipts({
    receiptDateMin: range.start,
    receiptDateMax: range.end,
    storeId,
  });
}

export function isValidBangkokSalesDate(date: string): boolean {
  return createBangkokDateRange(date) !== null;
}

function createBangkokDateRange(
  date: string,
): { start: string; end: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const start = new Date(`${date}T00:00:00+07:00`);
  if (Number.isNaN(start.getTime()) || getBangkokDate(start) !== date) {
    return null;
  }

  return {
    start: start.toISOString(),
    end: new Date(start.getTime() + DAY_IN_MILLISECONDS - 1).toISOString(),
  };
}

function getBangkokDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Bangkok",
    year: "numeric",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value || "";
  const month = parts.find((part) => part.type === "month")?.value || "";
  const day = parts.find((part) => part.type === "day")?.value || "";
  return `${year}-${month}-${day}`;
}
