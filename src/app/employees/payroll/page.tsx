import type { Metadata } from "next";
import { PayrollPage } from "./PayrollPage";

export const metadata: Metadata = {
  title: "Payroll",
  description: "Calculate employee payroll from monthly timesheets.",
};

export default function Page() {
  return <PayrollPage />;
}
