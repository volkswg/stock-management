import type { IGoogleSheetsService } from "@/infrastructure/persistence/google-sheets/service-contracts";
import type { CreatedOrder, OrderListItem } from "../src/modules/orders/contracts";
import type * as Public from "../src/modules/orders/server";
import type * as Legacy from "../src/services/orders";

type Assert<T extends true> = T;
type Same<A, B> = A extends B ? (B extends A ? true : false) : false;
type LegacyCreateInput = {
  googleSheetsService: IGoogleSheetsService;
  id?: string;
  seller?: string;
  totalPrice?: number | null;
  remark?: string;
  createdBy: string;
};

export type Compatibility = [
  Assert<Same<Parameters<typeof Legacy.createOrder>[0], LegacyCreateInput>>,
  Assert<Same<ReturnType<typeof Legacy.createOrder>, Promise<CreatedOrder>>>,
  Assert<Same<Parameters<typeof Legacy.listOrders>[0], { googleSheetsService: IGoogleSheetsService }>>,
  Assert<Same<ReturnType<typeof Legacy.listOrders>, Promise<OrderListItem[]>>>,
  Assert<Same<typeof Legacy.createOrder, typeof Public.createOrder>>,
  Assert<Same<typeof Legacy.listOrders, typeof Public.listOrders>>,
];
