/**
 * PAYMENTS_PROVIDER = razorpay (default when RAZORPAY_KEY_ID is set) | mock (local tests) | off.
 * When payments are off, every finished deck is unlocked (free testing mode).
 */
import { RazorpayProvider } from "./razorpay";
import { MockProvider } from "./mock";
import type { PaymentProvider } from "./types";

let cached: PaymentProvider | null | undefined;

export function paymentProvider(): PaymentProvider | null {
  if (cached !== undefined) return cached;
  const want = (process.env.PAYMENTS_PROVIDER || (process.env.RAZORPAY_KEY_ID ? "razorpay" : "off")).toLowerCase();
  if (want === "razorpay" && process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    cached = new RazorpayProvider(process.env.RAZORPAY_KEY_ID, process.env.RAZORPAY_KEY_SECRET, process.env.RAZORPAY_WEBHOOK_SECRET);
  } else if (want === "mock" && (process.env.NODE_ENV !== "production" || process.env.ALLOW_MOCK_PAYMENTS === "true")) {
    cached = new MockProvider();
  } else cached = null;
  return cached;
}

export function paymentsEnabled() {
  return !!paymentProvider();
}
