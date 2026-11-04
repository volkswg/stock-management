import type { CreatedOrder } from "../../contracts";

export interface CreatedOrderWriter {
  appendCreatedOrder(order: CreatedOrder): Promise<void>;
}
