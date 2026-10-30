/** Pluggable payment provider. Razorpay is the default; another gateway only needs this interface. */
export interface CreatedOrder {
  providerOrderId: string;
  amount: number; // paise
  currency: string;
  /** public data the browser needs to open the checkout (never secrets) */
  checkout: Record<string, unknown>;
}

export interface PaymentProvider {
  name: string;
  /** shown to the browser so it knows which checkout to open */
  publicConfig(): Record<string, unknown>;
  createOrder(input: { amount: number; currency: string; receipt: string; notes: Record<string, string> }): Promise<CreatedOrder>;
  /** verify the browser's "payment done" message (signature from the checkout) */
  verifyCheckout(body: Record<string, string>): Promise<{ ok: boolean; providerOrderId?: string; paymentId?: string }>;
  /** verify a server-to-server webhook; returns paid orders it confirms */
  verifyWebhook(rawBody: string, headers: Headers): Promise<{ ok: boolean; paid: { providerOrderId: string; paymentId: string }[] }>;
}
