import type { Metadata } from "next";
import { Suspense } from "react";
import { MovementListPage } from "./MovementListPage";

export const metadata: Metadata = {
  title: "Movements",
  description: "Review product movements by packing date and shop.",
};

export default function MovementsPage() {
  return (
    <Suspense fallback={null}>
      <MovementListPage />
    </Suspense>
  );
}
