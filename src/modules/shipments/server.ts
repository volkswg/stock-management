import "server-only";
import type { IGoogleSheetsService } from "@/externals/google/sheet/types";
import { createSortableId } from "@/services/utils/createSortableId";
import type { Shipment, ShipmentListItem, ShipmentStatus } from "./contracts";
import { createShipment as executeCreateShipment } from "./application/create-shipment";
import { GoogleSheetsShipmentWriter } from "./infrastructure/google-sheets/shipment-writer";
import {
  listShipments as executeListShipments,
  getShipmentDetail as executeGetShipmentDetail,
} from "./application/list-shipments";
import { GoogleSheetsShipmentListReader } from "./infrastructure/google-sheets/shipment-list-reader";

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

export async function listShipments({
  excludeStatuses = [],
  googleSheetsService,
  includeOrders = true,
}: {
  excludeStatuses?: readonly ShipmentStatus[];
  googleSheetsService: IGoogleSheetsService;
  includeOrders?: boolean;
}): Promise<ShipmentListItem[]> {
  return await executeListShipments(new GoogleSheetsShipmentListReader(googleSheetsService), {
    excludeStatuses, includeOrders,
  });
}

export async function getShipmentDetail({
  googleSheetsService,
  shipmentId,
}: {
  googleSheetsService: IGoogleSheetsService;
  shipmentId: string;
}): Promise<ShipmentListItem | undefined> {
  return await executeGetShipmentDetail(new GoogleSheetsShipmentListReader(googleSheetsService), shipmentId);
}
