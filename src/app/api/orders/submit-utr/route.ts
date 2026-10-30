import { NextRequest, NextResponse } from "next/server";
import { manualUpiProvider } from "@/lib/payment/manualUpiProvider";

export async function POST(req: NextRequest) {
  try {
    const { orderId, utr, screenshotUrl } = await req.json();

    if (!orderId || !utr) {
      return NextResponse.json(
        { success: false, error: "Both orderId and 12-digit UTR are required." },
        { status: 400 }
      );
    }

    const order = await manualUpiProvider.submitUtr(orderId, utr, screenshotUrl);

    return NextResponse.json({
      success: true,
      order,
      message: "Payment submitted successfully. Your order is now under verification.",
    });
  } catch (err: any) {
    console.error("[API /api/orders/submit-utr Error]:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to submit UTR",
      },
      { status: 400 }
    );
  }
}

