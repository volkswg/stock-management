import type { RecordValue, NativeRecord } from "@/infrastructure/persistence/postgres/native-records";
import type { Storage } from "./storage";
import "server-only";
import type { ShipmentOrder } from "../../contracts";
import type { ShipmentOrderLinkStore, ShipmentLinkSnapshot } from "../../application/ports/shipment-order-link-store";

export class PostgresShipmentOrderLinkStore implements ShipmentOrderLinkStore {
  constructor(private readonly storage: Pick<
    Storage, "shipments" | "orders" | "shipmentOrders"
  >) {}

  async readLinkSnapshot(): Promise<ShipmentLinkSnapshot> {
    const [shipmentRows, orderRows, shipmentOrderRows] = await Promise.all([
      this.storage.shipments.all(),
      this.storage.orders.all(),
      this.storage.shipmentOrders.all("descending").then(records => records.reverse()),
    ]);
    return {
      findActiveShipment(shipmentId) {
        const shipmentRow = shipmentRows.find(
          (row) =>
            toStringValue(row.id) === shipmentId && !toStringValue(row.deletedAt),
        );
        if (!shipmentRow) return undefined;
        return { readStatus: () => toStringValue(shipmentRow.status) };
      },
      hasActiveOrder(orderId) {
        return orderRows.some(
          (row) => toStringValue(row.id) === orderId && !toStringValue(row.deletedAt),
        );
      },
      findLatestActiveLink(orderId) {
        return findLatestShipmentOrder(shipmentOrderRows, orderId);
      },
    };
  }

  async appendShipmentOrder(shipmentOrder: ShipmentOrder): Promise<void> {
    await this.storage.shipmentOrders.insert({ id: shipmentOrder.id, shipmentId: shipmentOrder.shipmentId, orderId: shipmentOrder.orderId, createdAt: shipmentOrder.createdAt, updatedAt: shipmentOrder.updatedAt, deletedAt: shipmentOrder.deletedAt, createdBy: shipmentOrder.createdBy });
  }
}

function findLatestShipmentOrder(
  rows: NativeRecord[],
  orderId: string,
): ShipmentOrder | undefined {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const shipmentOrder = mapShipmentOrderRow(rows[index]);
    if (shipmentOrder?.orderId === orderId) {
      return shipmentOrder;
    }
  }
  return undefined;
}

function mapShipmentOrderRow(row: NativeRecord): ShipmentOrder | undefined {
  const { id, shipmentId, orderId, createdAt, updatedAt, deletedAt, createdBy } = row;
  const normalizedId = toStringValue(id);
  const normalizedShipmentId = toStringValue(shipmentId);
  const normalizedOrderId = toStringValue(orderId);
  if (
    !normalizedId ||
    !normalizedShipmentId ||
    !normalizedOrderId ||
    toStringValue(deletedAt)
  ) {
    return undefined;
  }

  return {
    id: normalizedId,
    shipmentId: normalizedShipmentId,
    orderId: normalizedOrderId,
    createdAt: toStringValue(createdAt),
    updatedAt: toStringValue(updatedAt),
    deletedAt: "",
    createdBy: toStringValue(createdBy),
  };
}

function toStringValue(value: RecordValue | undefined): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}
