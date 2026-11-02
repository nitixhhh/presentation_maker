import type { Metadata } from "next";
import PlansView from "@/components/plans/PlansView";

export const metadata: Metadata = { title: "Plans — DeckCraft", robots: { index: false, follow: false } };

export default function Plans() {
  return <PlansView />;
}
