import "server-only";
import { NativeRecords } from "@/infrastructure/persistence/postgres/native-records";

export function shipmentsTables() {
  return {
    shipments: new NativeRecords("shipments", {
      id: { column: "id", kind: "text" },
      status: { column: "status", kind: "text" },
      carrier: { column: "carrier", kind: "text" },
      poNumber: { column: "poNumber", kind: "text" },
      shippingFee: { column: "shippingFee", kind: "numeric" },
      remark: { column: "remark", kind: "text" },
      shippedAt: { column: "shippedAt", kind: "text" },
      deliveredAt: { column: "deliveredAt", kind: "text" },
      createdAt: { column: "createdAt", kind: "timestamp" },
      updatedAt: { column: "updatedAt", kind: "timestamp" },
      deletedAt: { column: "deletedAt", kind: "timestamp" },
      createdBy: { column: "createdBy", kind: "text" },
      shippingBillUrl: { column: "shippingBillMediaId", kind: "media" },
    } as const),
    shipmentOrders: new NativeRecords("shipment_orders", {
      id: { column: "id", kind: "text" },
      shipmentId: { column: "shipmentId", kind: "text" },
      orderId: { column: "orderId", kind: "text" },
      createdAt: { column: "createdAt", kind: "timestamp" },
      updatedAt: { column: "updatedAt", kind: "timestamp" },
      deletedAt: { column: "deletedAt", kind: "timestamp" },
      createdBy: { column: "createdBy", kind: "text" },
    } as const),
  };
}
