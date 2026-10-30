/** Local testing only (PAYMENTS_PROVIDER=mock): "pays" instantly with a signed fake payment. Never use in production. */
import crypto from "crypto";
import { sign } from "../secret";
import type { PaymentProvider } from "./types";

export class MockProvider implements PaymentProvider {
  name = "mock";
  publicConfig() {
    return { provider: "mock", testMode: true };
  }
  async createOrder(input: { amount: number; currency: string }) {
    const id = `mock_order_${crypto.randomBytes(6).toString("hex")}`;
    const paymentId = `mock_pay_${crypto.randomBytes(6).toString("hex")}`;
    return { providerOrderId: id, amount: input.amount, currency: input.currency, checkout: { orderId: id, paymentId, signature: sign(`${id}|${paymentId}`), amount: input.amount } };
  }
  async verifyCheckout(b: Record<string, string>) {
    const ok = !!b.orderId && !!b.paymentId && b.signature === sign(`${b.orderId}|${b.paymentId}`);
    return ok ? { ok, providerOrderId: b.orderId, paymentId: b.paymentId } : { ok: false };
  }
  async verifyWebhook() {
    return { ok: false, paid: [] };
  }
}
