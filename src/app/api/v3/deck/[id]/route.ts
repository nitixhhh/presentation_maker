import { ensureDeckLocal } from "@/server/jobs/manager";
import { deckSummary } from "@/engine-v3/summary";
import { resolveOwner } from "@/server/auth";
import { deckAccess, priceFor } from "@/server/billing";
import { deckToken } from "@/server/deckAuth";
import { paymentProvider } from "@/server/payments";
import { pricing } from "@/server/pricing";
import { accounts } from "@/server/accounts/store";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-z0-9-]+$/i.test(id)) return Response.json({ error: "bad id" }, { status: 400 });
  try {
    await ensureDeckLocal(id);
    const { ownerKey } = await resolveOwner(req);
    const acc = await deckAccess(id, ownerKey);
    if (!acc || !acc.owner) return Response.json({ error: "not found" }, { status: 404 });
    const { deck, unlocked } = acc;
    const t = deckToken(id, unlocked ? "full" : "view");
    const sum = deckSummary(deck);
    const provider = paymentProvider();
    const p = pricing();
    const owner = deck.ownerKey || ownerKey;
    const body = {
      ...sum,
      locked: !unlocked,
      references: unlocked ? sum.references : [],
      slides: sum.slides.map((s) => ({ ...s, image: `${s.image}?t=${t}`, url: unlocked ? `${s.url}?t=${t}` : null, notes: unlocked ? s.notes : undefined })),
      payments: provider
        ? {
            ...provider.publicConfig(),
            price: await priceFor(owner, "deck"),
            pack5: p.pack5,
            credits: await accounts().credits(owner),
          }
        : null,
      edits: { used: await accounts().editsUsed(id), free: p.freeEdits },
    };
    return Response.json(body, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    console.error("[deck]", e);
    return Response.json({ error: "bad id" }, { status: 400 });
  }
}
