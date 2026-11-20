import "server-only";
import { NativeRecords } from "@/infrastructure/persistence/postgres/native-records";

export function ordersTables() {
  return {
    orders: new NativeRecords("orders", {
      id: { column: "id", kind: "text" },
      status: { column: "status", kind: "text" },
      seller: { column: "seller", kind: "text" },
      totalPrice: { column: "totalPrice", kind: "numeric" },
      remark: { column: "remark", kind: "text" },
      createdAt: { column: "createdAt", kind: "timestamp" },
      updatedAt: { column: "updatedAt", kind: "timestamp" },
      deletedAt: { column: "deletedAt", kind: "timestamp" },
      createdBy: { column: "createdBy", kind: "text" },
    } as const),
    orderItems: new NativeRecords("order_items", {
      id: { column: "id", kind: "text" },
      orderId: { column: "orderId", kind: "text" },
      imageUrl: { column: "imageMediaId", kind: "media" },
      quoteQuantity: { column: "quoteQuantity", kind: "numeric" },
      deliveredQuantity: { column: "deliveredQuantity", kind: "numeric" },
      productCode: { column: "productCode", kind: "text" },
      createdAt: { column: "createdAt", kind: "timestamp" },
      updatedAt: { column: "updatedAt", kind: "timestamp" },
      deletedAt: { column: "deletedAt", kind: "timestamp" },
      createdBy: { column: "createdBy", kind: "text" },
    } as const),
    orderBills: new NativeRecords("order_bills", {
      id: { column: "id", kind: "text" },
      orderId: { column: "orderId", kind: "text" },
      imageUrl: { column: "imageMediaId", kind: "media" },
      createdAt: { column: "createdAt", kind: "timestamp" },
      updatedAt: { column: "updatedAt", kind: "timestamp" },
      deletedAt: { column: "deletedAt", kind: "timestamp" },
      createdBy: { column: "createdBy", kind: "text" },
    } as const, "id", true),
  };
}
