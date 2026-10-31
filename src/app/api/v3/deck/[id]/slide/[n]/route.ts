import { loadDeck } from "@/engine-v3/store";
import { ensureDeckLocal } from "@/server/jobs/manager";
import { slideDocument } from "@/engine-v3/render/document";
import { tokenScope } from "@/server/deckAuth";
import { paymentsEnabled } from "@/server/payments";
import { slideAccess } from "@/server/access";

/** The live HTML slide (selectable text) — only after unlocking. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string; n: string }> }) {
  const { id, n } = await params;
  try {
    await ensureDeckLocal(id);
    const deck = loadDeck(id);
    const s = deck?.slides.find((x) => x.n === Number(n));
    if (!deck || !s) return new Response("not found", { status: 404 });
    const a = slideAccess({ isPublic: !!deck.public, deckOwnerKey: deck.ownerKey, scope: tokenScope(req, id), paymentsOn: paymentsEnabled() });
    if (a === "locked") return new Response("locked", { status: 402 });
    if (a === "forbidden") return new Response("not found", { status: 404 });
    const html = slideDocument(deck.design, s.html, { assetBase: `/api/v3/deck/${id}/asset/`, deck, n: s.n });
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" } });
  } catch {
    return new Response("bad request", { status: 400 });
  }
}
