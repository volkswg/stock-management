import { OrderStatus } from "./createDraftOrder";

export function isOrderImageUploadState(
  state: OrderStatus | undefined,
): boolean {
  return (
    state === OrderStatus.WaitingForBillImage ||
    state === OrderStatus.WaitingForProductImage
  );
}
