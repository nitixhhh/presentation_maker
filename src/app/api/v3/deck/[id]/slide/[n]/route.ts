import { loadDeck } from "@/engine-v3/store";
import { slideDocument } from "@/engine-v3/render/document";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; n: string }> }) {
  const { id, n } = await params;
  try {
    const deck = loadDeck(id);
    const s = deck?.slides.find((x) => x.n === Number(n));
    if (!deck || !s) return new Response("not found", { status: 404 });
    const html = slideDocument(deck.design, s.html, { assetBase: `/api/v3/deck/${id}/asset/`, deck, n: s.n });
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch {
    return new Response("bad request", { status: 400 });
  }
}
