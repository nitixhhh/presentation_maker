import { fulfil } from "@/server/billing";
import { paymentProvider } from "@/server/payments";

/** Razorpay webhook (events: order.paid, payment.captured). Second confirmation path; idempotent. */
export async function POST(req: Request) {
  const provider = paymentProvider();
  if (!provider) return new Response("disabled", { status: 404 });
  const raw = await req.text();
  const v = await provider.verifyWebhook(raw, req.headers);
  if (!v.ok) return new Response("bad signature", { status: 400 });
  for (const p of v.paid) await fulfil(p.providerOrderId, p.paymentId).catch((e) => console.error("[pay/webhook]", e));
  return Response.json({ ok: true });
}
