import { Order, PaymentProvider, OrderStatus } from "./types";
import { PresentationRequest } from "@/schemas/presentation";

/**
 * RazorpayProvider Stub
 * Prepared for future automated payment integration.
 */
export class RazorpayProvider implements PaymentProvider {
  public name = "Razorpay Automated (Coming Soon)";

  public async createOrder(topic: string, options: PresentationRequest, amountInr = 20.0): Promise<Order> {
    throw new Error("Razorpay automated checkout is not yet activated. Please use Manual UPI.");
  }

  public async getStatus(orderId: string): Promise<OrderStatus> {
    throw new Error("Not implemented");
  }

  public async submitUtr(orderId: string, utr: string, screenshotUrl?: string): Promise<Order> {
    throw new Error("Razorpay orders are verified via Webhooks, not manual UTR.");
  }

  public async approve(orderId: string): Promise<Order> {
    throw new Error("Automated by webhook signature verification.");
  }

  public async reject(orderId: string, reason: string): Promise<Order> {
    throw new Error("Not implemented");
  }
}

