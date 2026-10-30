import { loginRequired, resolveOwner } from "@/server/auth";
import { deckAccess, useCredit } from "@/server/billing";

/** Unlock a deck with one credit (from a 5-pack or a referral). */
export async function POST(req: Request) {
  const { ownerKey, user } = await resolveOwner(req);
  if (loginRequired() && !user) return Response.json({ error: "Please sign in." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const deckId = String(body?.deckId || "");
  const acc = /^[a-z0-9-]+$/i.test(deckId) ? await deckAccess(deckId, ownerKey) : null;
  if (!acc?.owner) return Response.json({ error: "not found" }, { status: 404 });
  const ok = await useCredit(acc.deck.ownerKey || ownerKey, deckId);
  return ok ? Response.json({ ok: true }) : Response.json({ error: "No credits left." }, { status: 402 });
}
