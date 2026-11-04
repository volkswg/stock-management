import type { OrderListItem } from "../contracts";
import type { OrderListReader } from "./ports/order-list-reader";

export async function listOrders(reader: OrderListReader): Promise<OrderListItem[]> {
  return (await reader.readOrderList()).reverse();
}
