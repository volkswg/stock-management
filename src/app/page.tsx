import type { Metadata } from "next";
import { HomeMenuPage } from "./HomeMenuPage";

export const metadata: Metadata = {
  title: "Stock Management",
  description: "Stock management workspace.",
};

export default function Home() {
  return <HomeMenuPage />;
}
