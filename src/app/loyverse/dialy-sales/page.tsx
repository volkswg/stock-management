import type { Metadata } from "next";
import { LoyverseDialySalesPage } from "./LoyverseDialySalesPage";

export const metadata: Metadata = {
  title: "Loyverse Daily Sales | Stock Management",
  description: "Review today's Loyverse sales by item and payment type.",
};

export default function Page() {
  return <LoyverseDialySalesPage />;
}
