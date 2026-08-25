import type { Metadata } from "next";
import { ShipmentDetailPage } from "./ShipmentDetailPage";

export const metadata: Metadata = {
  title: "Shipment details | Stock Management",
  description: "Review shipment information and linked orders.",
};

export default async function ShipmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ShipmentDetailPage key={id} shipmentId={id} />;
}
