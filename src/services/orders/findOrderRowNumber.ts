import type { IGoogleSheetsService } from "@/externals/google/sheet";

export async function findOrderRowNumber({
  googleSheetsService,
  orderId,
}: {
  googleSheetsService: IGoogleSheetsService;
  orderId: string;
}): Promise<number> {
  const rows = await googleSheetsService.orders.readRows("A2:A");
  const rowIndex = rows.findIndex(([id]) => String(id ?? "") === orderId);
  if (rowIndex === -1) {
    throw new Error(`Order not found: ${orderId}`);
  }

  return rowIndex + 2;
}
