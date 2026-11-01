import type { Metadata } from "next";
import { ExpenseMasterPage } from "../ExpenseMasterPage";
export const metadata: Metadata = { title: "Shop master" };
export default function Page() { return <ExpenseMasterPage kind="shops" />; }
