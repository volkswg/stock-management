import type { Metadata } from "next";
import { SalesDashboardPage } from "./SalesDashboardPage";

export const metadata: Metadata = {
  title: "Sales Dashboard | Stock Management",
  description: "Analyze synced Google Sheets sales over a selected date range.",
};

export default function Page() {
  return <SalesDashboardPage />;
}
