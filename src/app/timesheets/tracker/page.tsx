import type { Metadata } from "next";
import { TimesheetTrackerPage } from "./TimesheetTrackerPage";

export const metadata: Metadata = {
  title: "Timesheet Tracker | Stock Management",
  description: "Track employee attendance, working time, and leave.",
};

type PageProps = {
  searchParams: Promise<{
    date?: string | string[];
    timesheetId?: string | string[];
  }>;
};

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  return (
    <TimesheetTrackerPage
      initialDate={firstValue(params.date)}
      selectedTimesheetId={firstValue(params.timesheetId)}
    />
  );
}

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || "" : value || "";
}
