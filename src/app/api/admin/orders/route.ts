import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/db";

function isAuthorized(req: NextRequest): boolean {
  const cookie = req.cookies.get("admin_session");
  const authHeader = req.headers.get("Authorization");
  const expectedPassword = process.env.ADMIN_PASSWORD || "change_me_in_production";
  return cookie?.value === "authenticated" || authHeader === `Bearer ${expectedPassword}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status") as any;

  const orders = await Database.listOrders(statusFilter || undefined);
  return NextResponse.json({ success: true, orders });
}

