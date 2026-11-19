import "server-only";
import type { ShipmentStatusStore, ShipmentStatusTarget } from "../../application/ports/shipment-status-store";
import type { Storage } from "./storage";
export class PostgresShipmentStatusStore implements ShipmentStatusStore {
  constructor(private readonly storage: Pick<Storage, "shipments">) {}
  async prepareStatusUpdate(id: string): Promise<ShipmentStatusTarget | undefined> {
    const record = (await this.storage.shipments.all()).find(r => String(r.id).trim() === id);
    if (!record) return undefined;
    return {
      readCurrentStatus: () => String(record.status ?? "").trim(), readPoNumber: () => String(record.poNumber ?? "").trim(),
      readShippingFee: () => toNumber(record.shippingFee), readShippedAt: () => String(record.shippedAt ?? "").trim(),
      readDeliveredAt: () => String(record.deliveredAt ?? "").trim(), readShippingBillUrl: () => String(record.shippingBillUrl ?? "").trim(),
      saveStatusUpdate: update => this.storage.shipments.update(record, { status: update.status, poNumber: update.poNumber, shippingFee: update.shippingFee, shippedAt: update.shippedAt, deliveredAt: update.deliveredAt, updatedAt: update.updatedAt, shippingBillUrl: update.shippingBillUrl }),
    };
  }
}
function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  const number = Number(value.replace(/,/g, "")); return Number.isFinite(number) ? number : null;
}
