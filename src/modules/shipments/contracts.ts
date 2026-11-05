// Temporary physical ownership: the pure legacy leaf retains the single enum
// while Orders uses its existing bridge. See docs/architecture/shipments-contracts.md.
export { ShipmentStatus } from "./status";
export type {
  Shipment,
  ShipmentListItem,
  ShipmentRelatedOrder,
  ShipmentRelatedProductImage,
  ShipmentQuantityCost,
  ShipmentCostSummary,
  ShipmentStatusUpdate,
  ShipmentOrder,
} from "@/services/shipments/types";
