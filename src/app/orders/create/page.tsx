import type { Metadata } from "next";
import { OrderCreatePage } from "./OrderCreatePage";

export const metadata: Metadata = {
  title: "Create order | Stock Management",
  description: "Create a stock management order.",
};

export default function CreateOrderPage() {
  return <OrderCreatePage />;
}
