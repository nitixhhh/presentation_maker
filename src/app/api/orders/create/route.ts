import { NextRequest, NextResponse } from "next/server";
import { PresentationRequestSchema } from "@/schemas/presentation";
import { manualUpiProvider } from "@/lib/payment/manualUpiProvider";
import { Database } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const validatedRequest = PresentationRequestSchema.parse(json);
    const instantTest = Boolean(json.instantTest);

    const order = await manualUpiProvider.createOrder(
      validatedRequest.topic,
      validatedRequest,
      20.00
    );

    // If instantTest is requested in test phase, auto-approve order and enqueue job
    if (instantTest) {
      await Database.updateOrder(order.id, {
        status: "paid",
        approvedAt: new Date().toISOString(),
      });
      await Database.enqueueJob(order.id);
      const updatedOrder = await Database.getOrderById(order.id);

      return NextResponse.json({
        success: true,
        order: updatedOrder,
        instantTest: true,
      });
    }

    return NextResponse.json({
      success: true,
      order,
      instantTest: false,
    });
  } catch (err: any) {
    console.error("[API /api/orders/create Error]:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to create order",
      },
      { status: 400 }
    );
  }
}
