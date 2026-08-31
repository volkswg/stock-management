import type { Metadata } from "next";
import { SalesDailySalesPage } from "./SalesDailySalesPage";

export const metadata: Metadata = {
  title: "Daily Sales | Stock Management",
  description: "Review synced daily sales from Google Sheets.",
};

export default function Page() {
  return <SalesDailySalesPage />;
}
