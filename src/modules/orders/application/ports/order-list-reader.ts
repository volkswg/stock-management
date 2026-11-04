import type { OrderListItem } from "../../contracts";

export interface OrderListReader {
  /** A fresh, fully mapped list in persistence order; display reversal is a use-case rule. */
  readOrderList(): Promise<OrderListItem[]>;
}
