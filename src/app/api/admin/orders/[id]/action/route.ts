import { NextRequest, NextResponse } from "next/server";
import { manualUpiProvider } from "@/lib/payment/manualUpiProvider";

function isAuthorized(req: NextRequest): boolean {
  const cookie = req.cookies.get("admin_session");
  const authHeader = req.headers.get("Authorization");
  const expectedPassword = process.env.ADMIN_PASSWORD || "change_me_in_production";
  return cookie?.value === "authenticated" || authHeader === `Bearer ${expectedPassword}`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { action, reason } = await req.json();

    if (action === "approve") {
      const order = await manualUpiProvider.approve(id);
      return NextResponse.json({ success: true, message: "Order approved and generation enqueued", order });
    }

    if (action === "reject") {
      const order = await manualUpiProvider.reject(id, reason || "Payment not verified");
      return NextResponse.json({ success: true, message: "Order rejected", order });
    }

    return NextResponse.json({ error: "Invalid action. Use 'approve' or 'reject'." }, { status: 400 });
  } catch (err: any) {
    console.error("[API admin action error]:", err);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

