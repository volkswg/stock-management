import type { Metadata } from "next";
import { EmployeeTimesheetsPage } from "../../employees/timesheets/EmployeeTimesheetsPage";

export const metadata: Metadata = {
  title: "Timesheet Tracker | Stock Management",
  description: "Track employee attendance, working time, and leave.",
};

export default function Page() {
  return <EmployeeTimesheetsPage />;
}
