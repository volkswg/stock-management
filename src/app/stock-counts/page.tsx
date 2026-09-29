import type { Metadata } from "next";
import { StockCountsPage } from "./StockCountsPage";

export const metadata: Metadata = {
  title: "Monthly stock count",
  description: "Compare calculated and physical stock totals for each shop.",
};

export default function Page() {
  return <StockCountsPage />;
}
