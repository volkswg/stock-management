import type { Metadata } from "next";
import { OrderDetailClient } from "./OrderDetailClient";

export const metadata: Metadata = {
  title: "Order details | Stock Management",
  description: "Review order information, bills, and product images.",
};

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OrderDetailClient orderId={id} />;
}
