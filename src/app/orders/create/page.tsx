import type { Metadata } from "next";
import { OrderCreatePage } from "@/modules/orders/ui/create/OrderCreatePage";

export const metadata: Metadata = {
  title: "Create order | Stock Management",
  description: "Create a stock management order.",
};

export default function CreateOrderPage() {
  return <OrderCreatePage />;
}
