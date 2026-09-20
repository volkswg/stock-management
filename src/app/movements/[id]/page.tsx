import type { Metadata } from "next";
import { Suspense } from "react";
import { MovementDetailPage } from "./MovementDetailPage";

export const metadata: Metadata = {
  title: "Movement details",
  description: "Review and update movement items.",
};

export default async function MovementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <MovementDetailPage movementMasterId={(await params).id} />
    </Suspense>
  );
}
