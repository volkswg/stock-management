import "server-only";
import type { IGoogleSheetsService } from "@/externals/google/sheet/types";
import { lastColumnLetter } from "@/infrastructure/persistence/google-sheets/const";
import { SHIPMENTS_SHEET_HEADERS } from "@/modules/shipments/infrastructure/google-sheets/shipments/const";
import type { Shipment } from "../../contracts";
import type { CreatedShipmentWriter } from "../../application/ports/created-shipment-writer";

export class GoogleSheetsShipmentWriter implements CreatedShipmentWriter {
  constructor(private readonly sheets: Pick<IGoogleSheetsService, "shipments">) {}

  async appendCreatedShipment(shipment: Shipment): Promise<void> {
    await this.sheets.shipments.appendRows(
      `A:${lastColumnLetter(SHIPMENTS_SHEET_HEADERS.length - 1)}`,
      [
        [
          shipment.id,
          shipment.status,
          shipment.carrier,
          shipment.poNumber,
          shipment.shippingFee,
          shipment.remark,
          shipment.shippedAt,
          shipment.deliveredAt,
          shipment.createdAt,
          shipment.updatedAt,
          shipment.deletedAt,
          shipment.createdBy,
          shipment.shippingBillUrl,
        ],
      ],
    );
  }
}
