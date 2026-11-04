import type { ComponentProps } from "react";
import type { OrderShipment } from "../src/modules/orders/contracts";
import type { OrderDetailPage } from "../src/modules/orders/ui/[id]/OrderDetailPage";
import type { OrderShipmentPickerPort, PickerShipment } from "../src/modules/orders/ui/[id]/shipment-picker-port";

type Assert<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
export type PickerTyping = [
  Assert<Equal<PickerShipment, Pick<OrderShipment, "id" | "poNumber" | "carrier" | "status">>>,
  Assert<Equal<PickerShipment["status"], OrderShipment["status"]>>,
  Assert<Equal<ComponentProps<typeof OrderDetailPage>["shipmentPicker"], OrderShipmentPickerPort>>,
  Assert<Equal<Required<Pick<ComponentProps<typeof OrderDetailPage>, "shipmentPicker">>, Pick<ComponentProps<typeof OrderDetailPage>, "shipmentPicker">>>,
  Assert<Equal<keyof OrderShipmentPickerPort, "listLinkableShipments" | "createShipmentMaster" | "linkOrderToShipment">>,
  Assert<Equal<ReturnType<OrderShipmentPickerPort["linkOrderToShipment"]>, Promise<void>>>,
  Assert<Equal<Parameters<OrderShipmentPickerPort["listLinkableShipments"]>[0], { signal?: AbortSignal }>>,
];
