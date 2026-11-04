import { OrderStatus, type CreatedOrder } from "../contracts";
import type { CreatedOrderWriter } from "./ports/created-order-writer";

export type CreateOrderInput = {
  id?: string;
  seller?: string;
  totalPrice?: number | null;
  remark?: string;
  createdBy: string;
};

export type CreateOrderDependencies = {
  writer: CreatedOrderWriter;
  now: () => string;
  createId: () => string;
};

export async function createOrder(
  { id, seller, totalPrice, remark, createdBy }: CreateOrderInput,
  { writer, now: readClock, createId }: CreateOrderDependencies,
): Promise<CreatedOrder> {
  const now = readClock();
  const normalizedTotalPrice = totalPrice ?? null;
  const order: CreatedOrder = {
    id: id?.trim() || createId(),
    status:
      normalizedTotalPrice === null
        ? OrderStatus.WaitingForTotalPrice
        : OrderStatus.Complete,
    seller: seller?.trim() || "",
    totalPrice: normalizedTotalPrice,
    remark: remark?.trim() || "",
    createdAt: now,
    updatedAt: now,
    deletedAt: "",
    createdBy,
  };

  await writer.appendCreatedOrder(order);
  return order;
}
