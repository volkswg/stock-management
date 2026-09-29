import type { Metadata } from "next";
import { EmployeeTimesheetSummaryPage } from "../employees/timesheets/summary/EmployeeTimesheetSummaryPage";

export const metadata: Metadata = {
  title: "Timesheets | Stock Management",
  description: "Review employee attendance and leave in a monthly calendar.",
};

export default function Page() {
  return <EmployeeTimesheetSummaryPage />;
}
