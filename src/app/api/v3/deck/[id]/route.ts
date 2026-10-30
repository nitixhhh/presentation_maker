import { loadDeck } from "@/engine-v3/store";
import { deckSummary } from "@/engine-v3/summary";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const deck = loadDeck(id);
    if (!deck) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json(deckSummary(deck));
  } catch {
    return Response.json({ error: "bad id" }, { status: 400 });
  }
}
