import "server-only";
import type { Storage } from "./infrastructure/postgres/storage";
import { createSortableId } from "@/infrastructure/runtime/create-sortable-id";
import type { Shipment, ShipmentListItem, ShipmentStatus } from "./contracts";
import { createShipment as executeCreateShipment } from "./application/create-shipment";
import { PostgresShipmentWriter } from "./infrastructure/postgres/shipment-writer";
import {
  listShipments as executeListShipments,
  getShipmentDetail as executeGetShipmentDetail,
} from "./application/list-shipments";
import { PostgresShipmentListReader } from "./infrastructure/postgres/shipment-list-reader";

import { linkOrderToShipment as executeLinkOrderToShipment, LinkOrderToShipmentError, type LinkOrderToShipmentResult } from "./application/link-order-to-shipment";
export { LinkOrderToShipmentError };
import { PostgresShipmentOrderLinkStore } from "./infrastructure/postgres/shipment-order-link-store";

import { updateShipmentStatus as executeUpdateShipmentStatus, type UpdateShipmentStatusResult } from "./application/update-shipment-status";
import { PostgresShipmentStatusStore } from "./infrastructure/postgres/shipment-status-store";

import type { IGoogleDriveService } from "@/infrastructure/files/google-drive/types";
import { advanceShipmentStatusWithBill as executeAdvanceShipmentStatusWithBill, type ShipmentStatusUpdater, type AdvanceShipmentStatusWithBillResult } from "./application/advance-shipment-status-with-bill";
import { GoogleDriveShipmentBillStorage } from "./infrastructure/google-drive/shipment-bill-storage";

export async function createShipment({
  storage,
  poNumber,
  carrier,
  createdBy,
}: {
  storage: Storage;
  poNumber: string;
  carrier?: string;
  createdBy: string;
}): Promise<Shipment> {
  return await executeCreateShipment({ poNumber, carrier, createdBy }, {
    writer: new PostgresShipmentWriter(storage),
    now: () => new Date().toISOString(),
    createId: createSortableId,
  });
}

export async function listShipments({
  excludeStatuses = [],
  storage,
  includeOrders = true,
}: {
  excludeStatuses?: readonly ShipmentStatus[];
  storage: Storage;
  includeOrders?: boolean;
}): Promise<ShipmentListItem[]> {
  return await executeListShipments(new PostgresShipmentListReader(storage), {
    excludeStatuses, includeOrders,
  });
}

export async function getShipmentDetail({
  storage,
  shipmentId,
}: {
  storage: Storage;
  shipmentId: string;
}): Promise<ShipmentListItem | undefined> {
  return await executeGetShipmentDetail(new PostgresShipmentListReader(storage), shipmentId);
}

export async function linkOrderToShipment({
  storage,
  shipmentId,
  orderId,
  createdBy,
}: {
  storage: Storage;
  shipmentId: string;
  orderId: string;
  createdBy: string;
}): Promise<LinkOrderToShipmentResult> {
  return await executeLinkOrderToShipment({ shipmentId, orderId, createdBy }, {
    store: new PostgresShipmentOrderLinkStore(storage),
    now: () => new Date().toISOString(),
    createId: createSortableId,
  });
}

export async function updateShipmentStatus({
  deliveryFee,
  storage,
  poNumber,
  shippingBillUrl,
  shipmentId,
  status,
}: {
  deliveryFee?: number;
  storage: Storage;
  poNumber?: string;
  shippingBillUrl?: string;
  shipmentId: string;
  status: ShipmentStatus;
}): Promise<UpdateShipmentStatusResult> {
  return await executeUpdateShipmentStatus({ deliveryFee, poNumber, shippingBillUrl, shipmentId, status }, {
    store: new PostgresShipmentStatusStore(storage),
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
