import type { Metadata } from "next";
import { EmployeeTimesheetsPage } from "../employees/timesheets/EmployeeTimesheetsPage";

export const metadata: Metadata = {
  title: "Timesheets | Stock Management",
  description: "Track employee attendance, working time, and leave.",
};

export default function Page() {
  return <EmployeeTimesheetsPage />;
}
