import { OrderStatus } from "./contracts";
export function isActiveOrderCreateState(state: OrderStatus | undefined): boolean {
    return (state === OrderStatus.WaitingForBillImage ||
        state === OrderStatus.WaitingForProductImage ||
        state === OrderStatus.WaitingForTotalPrice);
}
export function isOrderImageUploadState(state: OrderStatus | undefined): boolean {
    return (state === OrderStatus.WaitingForBillImage ||
        state === OrderStatus.WaitingForProductImage);
}
