import type { Metadata } from "next";
import { SalesSyncStatusPage } from "./SalesSyncStatusPage";

export const metadata: Metadata = {
  title: "Sales Sync Status | Stock Management",
  description: "Review synced Loyverse sales data from Google Sheets.",
};

export default function Page() {
  return <SalesSyncStatusPage />;
}
