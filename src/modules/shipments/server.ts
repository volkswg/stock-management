import "server-only";
import type { IGoogleSheetsService } from "@/infrastructure/persistence/google-sheets/service-contracts";
import { createSortableId } from "@/infrastructure/runtime/create-sortable-id";
import type { Shipment, ShipmentListItem, ShipmentStatus } from "./contracts";
import { createShipment as executeCreateShipment } from "./application/create-shipment";
import { GoogleSheetsShipmentWriter } from "./infrastructure/google-sheets/shipment-writer";
import {
  listShipments as executeListShipments,
  getShipmentDetail as executeGetShipmentDetail,
} from "./application/list-shipments";
import { GoogleSheetsShipmentListReader } from "./infrastructure/google-sheets/shipment-list-reader";

import { linkOrderToShipment as executeLinkOrderToShipment, LinkOrderToShipmentError, type LinkOrderToShipmentResult } from "./application/link-order-to-shipment";
export { LinkOrderToShipmentError };
import { GoogleSheetsShipmentOrderLinkStore } from "./infrastructure/google-sheets/shipment-order-link-store";

import { updateShipmentStatus as executeUpdateShipmentStatus, type UpdateShipmentStatusResult } from "./application/update-shipment-status";
import { GoogleSheetsShipmentStatusStore } from "./infrastructure/google-sheets/shipment-status-store";

import type { IGoogleDriveService } from "@/infrastructure/files/google-drive/types";
import { advanceShipmentStatusWithBill as executeAdvanceShipmentStatusWithBill, type ShipmentStatusUpdater, type AdvanceShipmentStatusWithBillResult } from "./application/advance-shipment-status-with-bill";
import { GoogleDriveShipmentBillStorage } from "./infrastructure/google-drive/shipment-bill-storage";

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

export async function linkOrderToShipment({
  googleSheetsService,
  shipmentId,
  orderId,
  createdBy,
}: {
  googleSheetsService: IGoogleSheetsService;
  shipmentId: string;
  orderId: string;
  createdBy: string;
}): Promise<LinkOrderToShipmentResult> {
  return await executeLinkOrderToShipment({ shipmentId, orderId, createdBy }, {
    store: new GoogleSheetsShipmentOrderLinkStore(googleSheetsService),
    now: () => new Date().toISOString(),
    createId: createSortableId,
  });
}

export async function updateShipmentStatus({
  deliveryFee,
  googleSheetsService,
  poNumber,
  shippingBillUrl,
  shipmentId,
  status,
}: {
  deliveryFee?: number;
  googleSheetsService: IGoogleSheetsService;
  poNumber?: string;
  shippingBillUrl?: string;
  shipmentId: string;
  status: ShipmentStatus;
}): Promise<UpdateShipmentStatusResult> {
  return await executeUpdateShipmentStatus({ deliveryFee, poNumber, shippingBillUrl, shipmentId, status }, {
    store: new GoogleSheetsShipmentStatusStore(googleSheetsService),
    now: () => new Date().toISOString(),
  });
}

export async function advanceShipmentStatusWithBill({
  shipmentId,
  shippingBill,
  createDriveService,
  updateStatus,
}: {
  shipmentId: string;
  shippingBill?: File;
  createDriveService: () => IGoogleDriveService | undefined;
  updateStatus: ShipmentStatusUpdater;
}): Promise<AdvanceShipmentStatusWithBillResult> {
  return await executeAdvanceShipmentStatusWithBill({
    storage: shippingBill
      ? new GoogleDriveShipmentBillStorage(shipmentId, shippingBill, createDriveService)
      : undefined,
    updateStatus,
  });
}
