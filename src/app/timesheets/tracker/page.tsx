import type { Metadata } from "next";
import { TimesheetTrackerPage } from "./TimesheetTrackerPage";

export const metadata: Metadata = {
  title: "Timesheet Tracker | Stock Management",
  description: "Track employee attendance, working time, and leave.",
};

export default function Page() {
  return <TimesheetTrackerPage />;
}
