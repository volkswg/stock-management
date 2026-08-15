import { OrderStatus } from "./createDraftOrder";

export function isActiveOrderCreateState(
  state: OrderStatus | undefined,
): boolean {
  return (
    state === OrderStatus.WaitingForBillImage ||
    state === OrderStatus.WaitingForProductImage
  );
}
