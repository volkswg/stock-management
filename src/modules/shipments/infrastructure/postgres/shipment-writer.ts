import "server-only";
import type { Shipment } from "../../contracts";
import type { CreatedShipmentWriter } from "../../application/ports/created-shipment-writer";
import type { Storage } from "./storage";
export class PostgresShipmentWriter implements CreatedShipmentWriter {
  constructor(private readonly storage: Pick<Storage, "shipments">) {}
  async appendCreatedShipment(value: Shipment): Promise<void> {
    await this.storage.shipments.insert({ id: value.id, status: value.status, carrier: value.carrier, poNumber: value.poNumber, shippingFee: value.shippingFee, remark: value.remark, shippedAt: value.shippedAt, deliveredAt: value.deliveredAt, createdAt: value.createdAt, updatedAt: value.updatedAt, deletedAt: value.deletedAt, createdBy: value.createdBy, shippingBillUrl: value.shippingBillUrl });
  }
}
