import type { Metadata } from "next";
import { ExpensesPage } from "./ExpensesPage";

export const metadata: Metadata = { title: "Expenses" };

export default async function Page({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month } = await searchParams;
  const initialMonth = month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month)
    ? month
    : new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date()).slice(0, 7);
  return <ExpensesPage initialMonth={initialMonth} />;
}
