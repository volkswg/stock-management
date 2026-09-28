import type { Metadata } from "next";
import { SalesMenuPage } from "./SalesMenuPage";

export const metadata: Metadata = {
  title: "Sales | Stock Management",
  description: "Open sales reports, dashboards, and synchronization tools.",
};

export default function Page() {
  return <SalesMenuPage />;
}
