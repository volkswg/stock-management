import type { Metadata } from "next";
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
  return <MovementDetailPage movementMasterId={(await params).id} />;
}
