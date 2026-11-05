import "server-only";
import type { IGoogleSheetsService } from "@/externals/google/sheet/types";
import { createSortableId } from "@/services/utils/createSortableId";
import type { Shipment } from "./contracts";
import { createShipment as executeCreateShipment } from "./application/create-shipment";
import { GoogleSheetsShipmentWriter } from "./infrastructure/google-sheets/shipment-writer";

export async function createShipment({
  googleSheetsService,
  poNumber,
  carrier,
  createdBy,
}: {
  googleSheetsService: IGoogleSheetsService;
  poNumber: string;
  carrier?: string;
  createdBy: string;
}): Promise<Shipment> {
  return await executeCreateShipment({ poNumber, carrier, createdBy }, {
    writer: new GoogleSheetsShipmentWriter(googleSheetsService),
    now: () => new Date().toISOString(),
    createId: createSortableId,
  });
}
