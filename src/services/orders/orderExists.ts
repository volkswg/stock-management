import type { IGoogleSheetsService } from "@/externals/google/sheet";

export async function orderExists({
  googleSheetsService,
  orderId,
}: {
  googleSheetsService: IGoogleSheetsService;
  orderId: string;
}): Promise<boolean> {
  const rows = await googleSheetsService.orders.readRows("A2:A");
  return rows.some(([id]) => String(id ?? "").trim() === orderId);
}
