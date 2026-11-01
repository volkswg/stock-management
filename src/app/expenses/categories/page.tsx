import type { Metadata } from "next";
import { ExpenseMasterPage } from "../ExpenseMasterPage";
export const metadata: Metadata = { title: "Expense categories" };
export default function Page() { return <ExpenseMasterPage kind="categories" />; }
