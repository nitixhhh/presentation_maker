import type { Metadata } from "next";
import App from "@/components/app/App";

export const metadata: Metadata = { title: "Create a deck — DeckCraft" };

export default function Create() {
  return <App />;
}
