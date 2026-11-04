import type { Metadata } from "next";
import { ShipmentListPage } from "@/modules/shipments/ui/ShipmentListPage";

export const metadata: Metadata = {
  title: "Shipments | Stock Management",
  description: "Review and manage shipments.",
};

export default function ShipmentsPage() {
  return <ShipmentListPage />;
}
