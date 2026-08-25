import type { Metadata } from "next";
import { OrderListPage } from "../../features/frontend/orders/components/OrderListPage";

export const metadata: Metadata = {
  title: "Orders | Stock Management",
  description: "Review and manage purchase orders.",
};

export default function OrdersPage() {
  return <OrderListPage />;
}
