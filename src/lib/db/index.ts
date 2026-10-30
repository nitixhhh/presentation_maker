import crypto from "crypto";
import { Order, OrderStatus } from "@/lib/payment/types";
import { PresentationDeck } from "@/schemas/presentation";

export interface JobRecord {
  id: string;
  orderId: string;
  status: "queued" | "processing" | "completed" | "failed";
  attempts: number;
  maxAttempts: number;
  lockedBy?: string;
  lockedAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Pure In-Memory Transient Database for Test Phase
 * - Supabase is completely disabled.
 * - Zero user data is written to disk or external databases.
 * - Data only lives in process memory during active runtime.
 */
declare global {
  // Use globalThis to persist across Next.js Turbopack dev hot-reloads
  var __memoryOrders: Map<string, Order> | undefined;
  var __memoryJobs: Map<string, JobRecord> | undefined;
}

const memoryOrders: Map<string, Order> = globalThis.__memoryOrders || new Map();
const memoryJobs: Map<string, JobRecord> = globalThis.__memoryJobs || new Map();

if (process.env.NODE_ENV !== "production") {
  globalThis.__memoryOrders = memoryOrders;
  globalThis.__memoryJobs = memoryJobs;
}

export class Database {
  public static async createOrder(orderData: Omit<Order, "id" | "createdAt" | "retryCount">): Promise<Order> {
    const id = crypto.randomUUID();
    const newOrder: Order = {
      ...orderData,
      id,
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };
    memoryOrders.set(id, newOrder);
    return newOrder;
  }

  public static async getOrderById(id: string): Promise<Order | null> {
    return memoryOrders.get(id) || null;
  }

  public static async getOrderByUtr(utr: string): Promise<Order | null> {
    for (const order of memoryOrders.values()) {
      if (order.utr === utr) return order;
    }
    return null;
  }

  public static async updateOrder(id: string, updates: Partial<Order>): Promise<Order> {
    const existing = memoryOrders.get(id);
    if (!existing) {
      throw new Error(`Order not found: ${id}`);
    }
    const updated = { ...existing, ...updates };
    memoryOrders.set(id, updated);
    return updated;
  }

  public static async listOrders(status?: OrderStatus): Promise<Order[]> {
    const orders = Array.from(memoryOrders.values());
    if (status) {
      return orders.filter((o) => o.status === status);
    }
    return orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public static async countOrdersCreatedToday(): Promise<number> {
    const today = new Date().toISOString().split("T")[0];
    let count = 0;
    for (const order of memoryOrders.values()) {
      if (order.createdAt.startsWith(today)) count++;
    }
    return count;
  }

  // --- IN-MEMORY JOB QUEUE OPERATIONS ---
  public static async enqueueJob(orderId: string): Promise<string> {
    const jobId = crypto.randomUUID();
    const newJob: JobRecord = {
      id: jobId,
      orderId,
      status: "queued",
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    memoryJobs.set(jobId, newJob);
    return jobId;
  }

  public static async claimNextJob(workerId: string): Promise<JobRecord | null> {
    const now = new Date().toISOString();

    for (const job of memoryJobs.values()) {
      if (job.status === "queued") {
        job.status = "processing";
        job.lockedBy = workerId;
        job.lockedAt = now;
        job.attempts += 1;
        job.updatedAt = now;
        return job;
      }
      if (job.status === "processing" && job.lockedAt) {
        const lockAge = Date.now() - new Date(job.lockedAt).getTime();
        if (lockAge > 5 * 60 * 1000) {
          // Recover stale job
          job.lockedBy = workerId;
          job.lockedAt = now;
          job.attempts += 1;
          job.updatedAt = now;
          return job;
        }
      }
    }

    return null;
  }

  public static async completeJob(jobId: string, orderId: string, deck: PresentationDeck): Promise<void> {
    const job = memoryJobs.get(jobId);
    if (job) {
      job.status = "completed";
      job.updatedAt = new Date().toISOString();
    }

    await this.updateOrder(orderId, {
      status: "completed",
      deckId: deck.id,
      deckData: deck,
      completedAt: new Date().toISOString(),
    });
  }

  public static async failJob(jobId: string, orderId: string, errorMessage: string): Promise<void> {
    const job = memoryJobs.get(jobId);
    let retryable = false;

    if (job) {
      job.lastError = errorMessage;
      job.updatedAt = new Date().toISOString();
      if (job.attempts < job.maxAttempts) {
        job.status = "queued";
        retryable = true;
      } else {
        job.status = "failed";
      }
    }

    const order = memoryOrders.get(orderId);
    await this.updateOrder(orderId, {
      status: retryable ? "paid" : "failed",
      errorMessage,
      retryCount: order ? order.retryCount + 1 : 1,
    });
  }

  /**
   * Clears in-memory data if needed for test resets
   */
  public static clearAll(): void {
    memoryOrders.clear();
    memoryJobs.clear();
  }
}
