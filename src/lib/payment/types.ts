import { PresentationRequest, PresentationDeck } from "@/schemas/presentation";

export type OrderStatus =
  | "pending_payment"
  | "pending_review"
  | "paid"
  | "generating"
  | "completed"
  | "failed"
  | "rejected"
  | "refund_due";

export interface Order {
  id: string;
  topic: string;
  options: PresentationRequest;
  amountInr: number;
  status: OrderStatus;
  utr?: string;
  screenshotUrl?: string;
  rejectionReason?: string;
  deckId?: string;
  deckData?: PresentationDeck;
  errorMessage?: string;
  retryCount: number;
  createdAt: string;
  approvedAt?: string;
  completedAt?: string;
}

export interface PaymentProvider {
  name: string;
  createOrder(topic: string, options: PresentationRequest, amountInr?: number): Promise<Order>;
  getStatus(orderId: string): Promise<OrderStatus>;
  submitUtr(orderId: string, utr: string, screenshotUrl?: string): Promise<Order>;
  approve(orderId: string): Promise<Order>;
  reject(orderId: string, reason: string): Promise<Order>;
}

