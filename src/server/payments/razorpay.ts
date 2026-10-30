/**
 * Razorpay (https://razorpay.com/docs/payments/server-integration/nodejs/). Test mode = test keys (rzp_test_…).
 * Orders API → Checkout.js in the browser → signature check (HMAC-SHA256 of "order_id|payment_id" with the key
 * secret) → webhook "order.paid"/"payment.captured" (HMAC-SHA256 of the raw body with the webhook secret) as a
 * second, server-to-server confirmation. Both paths are idempotent.
 */
import crypto from "crypto";
import type { PaymentProvider } from "./types";

function safeEq(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export class RazorpayProvider implements PaymentProvider {
  name = "razorpay";
  constructor(private keyId: string, private keySecret: string, private webhookSecret?: string) {}

  publicConfig() {
    return { provider: "razorpay", keyId: this.keyId, testMode: this.keyId.startsWith("rzp_test_") };
  }

  async createOrder(input: { amount: number; currency: string; receipt: string; notes: Record<string, string> }) {
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: input.amount, currency: input.currency, receipt: input.receipt.slice(0, 40), notes: input.notes }),
    });
    const d: any = await res.json().catch(() => ({}));
    if (!res.ok || !d.id) throw new Error(`Razorpay order failed: ${d?.error?.description || res.status}`);
    return { providerOrderId: d.id, amount: d.amount, currency: d.currency, checkout: { keyId: this.keyId, orderId: d.id, amount: d.amount, currency: d.currency } };
  }

  async verifyCheckout(body: Record<string, string>) {
    const orderId = body.razorpay_order_id || "", paymentId = body.razorpay_payment_id || "", sig = body.razorpay_signature || "";
    if (!orderId || !paymentId || !sig) return { ok: false };
    const expect = crypto.createHmac("sha256", this.keySecret).update(`${orderId}|${paymentId}`).digest("hex");
    return safeEq(expect, sig) ? { ok: true, providerOrderId: orderId, paymentId } : { ok: false };
  }

  async verifyWebhook(raw: string, headers: Headers) {
    if (!this.webhookSecret) return { ok: false, paid: [] };
    const sig = headers.get("x-razorpay-signature") || "";
    const expect = crypto.createHmac("sha256", this.webhookSecret).update(raw).digest("hex");
    if (!safeEq(expect, sig)) return { ok: false, paid: [] };
    const ev = JSON.parse(raw);
    const paid: { providerOrderId: string; paymentId: string }[] = [];
    if (ev.event === "order.paid" || ev.event === "payment.captured") {
      const p = ev.payload?.payment?.entity;
      const orderId = p?.order_id || ev.payload?.order?.entity?.id;
      if (orderId && p?.id) paid.push({ providerOrderId: orderId, paymentId: p.id });
    }
    return { ok: true, paid };
  }
}
