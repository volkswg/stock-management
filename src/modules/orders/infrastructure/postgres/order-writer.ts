import "server-only";
import type { CreatedOrder } from "../../contracts";
import type { CreatedOrderWriter } from "../../application/ports/created-order-writer";
import type { Storage } from "./storage";
export class PostgresOrderWriter implements CreatedOrderWriter {
  constructor(private readonly storage: Pick<Storage, "orders">) {}
  async appendCreatedOrder(value: CreatedOrder): Promise<void> {
    await this.storage.orders.insert({ id: value.id, status: value.status, seller: value.seller, totalPrice: value.totalPrice, remark: value.remark, createdAt: value.createdAt, updatedAt: value.updatedAt, deletedAt: value.deletedAt, createdBy: value.createdBy });
  }
}
