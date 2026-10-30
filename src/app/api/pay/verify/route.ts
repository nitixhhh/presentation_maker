import { resolveOwner } from "@/server/auth";
import { fulfil } from "@/server/billing";
import { paymentProvider } from "@/server/payments";
import { clientIp, rateLimit, tooMany } from "@/server/rateLimit";

/** The checkout finished in the browser: verify its signature, then unlock. */
export async function POST(req: Request) {
  if (!rateLimit(`payv:${clientIp(req)}`, 20)) return tooMany();
  const provider = paymentProvider();
  if (!provider) return Response.json({ error: "Payments are not enabled." }, { status: 400 });
  const { ownerKey } = await resolveOwner(req);
  const body = await req.json().catch(() => ({}));
  const v = await provider.verifyCheckout(body || {});
  if (!v.ok || !v.providerOrderId || !v.paymentId) return Response.json({ error: "Payment could not be verified." }, { status: 400 });
  const r = await fulfil(v.providerOrderId, v.paymentId);
  if (!r.ok || r.order?.ownerKey !== ownerKey) return Response.json({ error: "Payment could not be matched to your account." }, { status: 400 });
  return Response.json({ ok: true, product: r.order.product, deckId: r.order.deckId });
}
