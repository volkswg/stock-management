"use client";

import { ProductSelector } from "@/modules/products/ui/ProductSelector";
import type { OrderProductPickerPort } from "@/modules/orders/ui/[id]/product-picker-port";
import { OrderDetailPage } from "@/modules/orders/ui/[id]/OrderDetailPage";
import type { OrderShipmentPickerPort } from "@/modules/orders/ui/[id]/shipment-picker-port";
import {
  createShipmentMaster,
  getShipments,
  linkOrderToShipment,
} from "@/modules/shipments/ui/api";
import { ShipmentStatus } from "@/modules/shipments/contracts";

const shipmentPicker: OrderShipmentPickerPort = {
  listLinkableShipments({ signal }) {
    return getShipments({
      excludeStatuses: [
        ShipmentStatus.Shipping,
        ShipmentStatus.Delivered,
        ShipmentStatus.Canceled,
      ],
      includeOrders: false,
      signal,
    });
  },
  createShipmentMaster,
  async linkOrderToShipment(shipmentId, orderId) {
    await linkOrderToShipment(shipmentId, orderId);
  },
};

const productPicker: OrderProductPickerPort = { render: input => <ProductSelector {...input} /> };

export function OrderDetailClient({ orderId }: { orderId: string }) {
  return <OrderDetailPage orderId={orderId} shipmentPicker={shipmentPicker} productPicker={productPicker} />;
}
