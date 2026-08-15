import type { IGoogleSheetsService } from "@/externals/google/sheet";
import { OrderStatus } from "./createDraftOrder";
import { updateOrderCreateState } from "./updateOrderCreateState";

export async function completeOrderProducts({
  googleSheetsService,
  orderId,
  userStateId,
  userStateCreatedAt,
}: {
  googleSheetsService: IGoogleSheetsService;
  orderId: string;
  userStateId: string;
  userStateCreatedAt: string;
}): Promise<void> {
  await updateOrderCreateState({
    googleSheetsService,
    orderId,
    userStateId,
    userStateCreatedAt,
    state: OrderStatus.Paid,
  });
}
