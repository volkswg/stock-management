import type { ShipmentListItem, ShipmentRelatedOrder } from "../../contracts";

export type ShipmentReadModel = {
  shipments: ReadonlyArray<Omit<ShipmentListItem, "costSummary" | "orders">>;
  orderIdsByShipmentId: ReadonlyMap<string, readonly string[]>;
  ordersById: ReadonlyMap<string, ShipmentRelatedOrder>;
};

export interface ShipmentListReader {
  readShipmentList(input: { includeOrders: boolean }): Promise<ShipmentReadModel>;
}
