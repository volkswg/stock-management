import "server-only";
import type { IGoogleSheetsService } from "@/infrastructure/persistence/google-sheets/service-contracts";
import type { ShipmentStatusUpdate } from "../../contracts";
import type { ShipmentStatusStore, ShipmentStatusTarget } from "../../application/ports/shipment-status-store";

export class GoogleSheetsShipmentStatusStore implements ShipmentStatusStore {
  constructor(private readonly googleSheetsService: Pick<IGoogleSheetsService, "shipments">) {}

  async prepareStatusUpdate(shipmentId: string): Promise<ShipmentStatusTarget | undefined> {
    await this.googleSheetsService.shipments.updateRows("M1", [
      ["shippingBillUrl"],
    ]);
    const rows = await this.googleSheetsService.shipments.readRows("A2:M");
    const rowIndex = rows.findIndex(
      ([id, , , , , , , , , , deletedAt]) =>
        String(id ?? "").trim() === shipmentId &&
        !String(deletedAt ?? "").trim(),
    );
    if (rowIndex === -1) {
      return undefined;
    }

    const [
      ,
      currentStatus,
      carrier,
      currentPoNumber,
      currentShippingFee,
      remark,
      currentShippedAt,
      currentDeliveredAt,
      createdAt,
      ,
      deletedAt,
      createdBy,
      currentShippingBillUrl,
    ] = rows[rowIndex];
    const googleSheetsService = this.googleSheetsService;
    return {
      readCurrentStatus: () => String(currentStatus ?? "").trim(),
      readPoNumber: () => String(currentPoNumber ?? "").trim(),
      readShippingFee: () => toNumber(currentShippingFee),
      readShippedAt: () => String(currentShippedAt ?? "").trim(),
      readDeliveredAt: () => String(currentDeliveredAt ?? "").trim(),
      readShippingBillUrl: () => String(currentShippingBillUrl ?? "").trim(),
      async saveStatusUpdate(update: ShipmentStatusUpdate): Promise<void> {
        const sheetRowNumber = rowIndex + 2;
        await googleSheetsService.shipments.updateRows(
          `B${sheetRowNumber}:M${sheetRowNumber}`,
          [
            [
              update.status,
              carrier ?? "",
              update.poNumber,
              update.shippingFee,
              remark ?? "",
              update.shippedAt,
              update.deliveredAt,
              createdAt ?? "",
              update.updatedAt,
              deletedAt ?? "",
              createdBy ?? "",
              update.shippingBillUrl,
            ],
          ],
        );
      },
    };
  }
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const number = Number(value.replace(/,/g, ""));
  return Number.isFinite(number) ? number : null;
}
