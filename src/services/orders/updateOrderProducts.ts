import type { GoogleSheetRangeUpdate, IGoogleSheetsService } from "@/externals/google/sheet";

export type OrderProductUpdate = {
  id: string;
  productCode?: string;
  quoteQuantity?: number;
  deliveredQuantity?: number;
};

export type UpdatedOrderProduct = {
  id: string;
  productCode: string;
  quoteQuantity: string;
  deliveredQuantity: string;
  updatedAt: string;
};

export async function updateOrderProducts({
  googleSheetsService,
  orderId,
  items,
}: {
  googleSheetsService: IGoogleSheetsService;
  orderId: string;
  items: OrderProductUpdate[];
}): Promise<
  | { outcome: "updated"; items: UpdatedOrderProduct[] }
  | { outcome: "not_found"; itemId: string }
> {
  const rows = await googleSheetsService.orderItems.readRows("A2:J");
  const ranges: GoogleSheetRangeUpdate[] = [];
  const updatedItems: UpdatedOrderProduct[] = [];
  const updatedAt = new Date().toISOString();

  // Resolve every product before writing so missing or foreign IDs save nothing.
  for (const item of items) {
    const rowIndex = rows.findIndex(
      ([id, linkedOrderId, , , , , , , deletedAt]) =>
        String(id ?? "").trim() === item.id &&
        String(linkedOrderId ?? "").trim() === orderId &&
        !String(deletedAt ?? "").trim(),
    );
    if (rowIndex === -1) return { outcome: "not_found", itemId: item.id };
    const row = rows[rowIndex];
    const updated: UpdatedOrderProduct = {
      id: item.id,
      productCode: item.productCode?.trim() ?? String(row[5] ?? ""),
      quoteQuantity: item.quoteQuantity === undefined
        ? String(row[3] ?? "") : String(item.quoteQuantity),
      deliveredQuantity: item.deliveredQuantity === undefined
        ? String(row[4] ?? "") : String(item.deliveredQuantity),
      updatedAt,
    };
    const rowNumber = rowIndex + 2;
    // Only write edited cells so unrelated concurrent edits are not overwritten.
    if (item.quoteQuantity !== undefined) {
      ranges.push({ range: `D${rowNumber}`, values: [[updated.quoteQuantity]] });
    }
    if (item.deliveredQuantity !== undefined) {
      ranges.push({ range: `E${rowNumber}`, values: [[updated.deliveredQuantity]] });
    }
    if (item.productCode !== undefined) {
      ranges.push({ range: `F${rowNumber}`, values: [[updated.productCode]] });
    }
    ranges.push({ range: `H${rowNumber}`, values: [[updatedAt]] });
    updatedItems.push(updated);
  }
  console.log(JSON.stringify(ranges));

  await googleSheetsService.orderItems.batchUpdateRows(ranges);
  return { outcome: "updated", items: updatedItems };
}
