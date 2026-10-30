import { loginRequired, resolveOwner } from "@/server/auth";
import { createPaymentOrder, deckAccess } from "@/server/billing";
import { clientIp, rateLimit, tooMany } from "@/server/rateLimit";

/** Start a payment: { product: "deck" | "pack5", deckId }. */
export async function POST(req: Request) {
  if (!rateLimit(`pay:${clientIp(req)}`, 10)) return tooMany();
  const { ownerKey, user } = await resolveOwner(req);
  if (loginRequired() && !user) return Response.json({ error: "Please sign in to pay." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const product = body?.product === "pack5" ? "pack5" : "deck";
  const deckId = typeof body?.deckId === "string" && /^[a-z0-9-]+$/i.test(body.deckId) ? body.deckId : undefined;
  if (product === "deck" && !deckId) return Response.json({ error: "Which deck?" }, { status: 400 });
  if (deckId) {
    const acc = await deckAccess(deckId, ownerKey);
    if (!acc?.owner) return Response.json({ error: "not found" }, { status: 404 });
    if (acc.unlocked) return Response.json({ alreadyUnlocked: true });
  }
  try {
    return Response.json(await createPaymentOrder(ownerKey, user, product, deckId));
  } catch (e: any) {
    console.error("[pay/order]", e);
    return Response.json({ error: "Could not start the payment. Please try again." }, { status: 502 });
  }
}
