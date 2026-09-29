import type { Metadata } from "next";
import { TimesheetCalendarPage } from "./TimesheetCalendarPage";

export const metadata: Metadata = {
  title: "Timesheets | Stock Management",
  description: "Review employee attendance and leave in a monthly calendar.",
};

export default function Page() {
  return <TimesheetCalendarPage />;
}
