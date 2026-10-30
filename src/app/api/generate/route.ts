import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/db";
import { OwnerAgent } from "@/lib/agents/owner";

export async function POST(req: NextRequest) {
  try {
    const { orderId } = await req.json();

    if (!orderId) {
      return NextResponse.json({ error: "Missing orderId in request body" }, { status: 400 });
    }

    const order = await Database.getOrderById(orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // STRICT PAYMENT GATE: Return 402 if order is not paid
    if (order.status !== "paid" && order.status !== "generating" && order.status !== "completed") {
      return NextResponse.json(
        {
          error: "Payment Required (402): Generation requires a verified payment of Rs 20.",
          currentStatus: order.status,
        },
        { status: 402 }
      );
    }

    // If already completed, return existing deck
    if (order.status === "completed" && order.deckData) {
      return NextResponse.json({
        success: true,
        message: "Deck already generated.",
        deck: order.deckData,
      });
    }

    // Direct synchronous generation execution (if triggered directly instead of background worker)
    await Database.updateOrder(orderId, { status: "generating" });

    try {
      const deck = await OwnerAgent.orchestrate(order.options);
      await Database.updateOrder(orderId, {
        status: "completed",
        deckId: deck.id,
        deckData: deck,
        completedAt: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        deck,
      });
    } catch (genErr: any) {
      const errMsg = genErr.message || "Generation error";
      const isPolicy = errMsg.toLowerCase().includes("policy") || errMsg.toLowerCase().includes("inappropriate");

      await Database.updateOrder(orderId, {
        status: isPolicy ? "refund_due" : "paid", // keep retryable if not policy
        errorMessage: isPolicy ? "Content refused by safety policy. Marked for manual refund." : errMsg,
        retryCount: order.retryCount + 1,
      });

      return NextResponse.json(
        {
          error: isPolicy ? "Generation cancelled due to policy. Marked for refund." : "Generation failed. Order remains retryable.",
          details: errMsg,
        },
        { status: 500 }
      );
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

