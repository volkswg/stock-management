import type { Metadata } from "next";
import { EmployeeTimesheetSummaryPage } from "../../employees/timesheets/summary/EmployeeTimesheetSummaryPage";

export const metadata: Metadata = {
  title: "Timesheet Summary | Stock Management",
  description: "Review monthly employee attendance and leave.",
};

export default function Page() {
  return <EmployeeTimesheetSummaryPage />;
}
