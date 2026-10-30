import { Order, PaymentProvider, OrderStatus } from "./types";
import { PresentationRequest } from "@/schemas/presentation";
import { Database } from "@/lib/db";
import { CapacityGate } from "@/lib/capacity/capacityGate";

export class ManualUpiProvider implements PaymentProvider {
  public name = "Manual UPI (Google Pay)";

  public async createOrder(topic: string, options: PresentationRequest, amountInr = 20.0): Promise<Order> {
    // 1. Capacity Gate Check
    const capacity = await CapacityGate.checkCapacity();
    if (!capacity.allowed) {
      throw new Error(capacity.message || "Daily capacity reached. No new orders accepted today.");
    }

    // 2. Create order in Database
    const order = await Database.createOrder({
      topic,
      options,
      amountInr,
      status: "pending_payment",
    });

    return order;
  }

  public async getStatus(orderId: string): Promise<OrderStatus> {
    const order = await Database.getOrderById(orderId);
    if (!order) throw new Error(`Order not found: ${orderId}`);
    return order.status;
  }

  public async submitUtr(orderId: string, utr: string, screenshotUrl?: string): Promise<Order> {
    const cleanUtr = utr.trim();

    // Validate 12-digit format
    if (!/^\d{12}$/.test(cleanUtr)) {
      throw new Error("Invalid UTR: Bank Reference / UTR must be exactly 12 numeric digits.");
    }

    // Check for duplicate UTR
    const existing = await Database.getOrderByUtr(cleanUtr);
    if (existing && existing.id !== orderId) {
      throw new Error("Duplicate UTR: This transaction reference has already been submitted for another order.");
    }

    const order = await Database.getOrderById(orderId);
    if (!order) throw new Error(`Order not found: ${orderId}`);

    if (order.status !== "pending_payment" && order.status !== "rejected") {
      throw new Error(`Order is not eligible for payment submission. Current status: ${order.status}`);
    }

    const updated = await Database.updateOrder(orderId, {
      utr: cleanUtr,
      screenshotUrl,
      status: "pending_review",
      rejectionReason: undefined,
    });

    return updated;
  }

  public async approve(orderId: string): Promise<Order> {
    const order = await Database.getOrderById(orderId);
    if (!order) throw new Error(`Order not found: ${orderId}`);

    if (order.status !== "pending_review") {
      throw new Error(`Only orders in 'pending_review' can be approved. Current status: ${order.status}`);
    }

    const updated = await Database.updateOrder(orderId, {
      status: "paid",
      approvedAt: new Date().toISOString(),
    });

    // Automatically enqueue background generation job
    await Database.enqueueJob(orderId);

    return updated;
  }

  public async reject(orderId: string, reason: string): Promise<Order> {
    const order = await Database.getOrderById(orderId);
    if (!order) throw new Error(`Order not found: ${orderId}`);

    const updated = await Database.updateOrder(orderId, {
      status: "rejected",
      rejectionReason: reason || "Payment verification failed or UTR not matched.",
    });

    return updated;
  }
}

export const manualUpiProvider = new ManualUpiProvider();

