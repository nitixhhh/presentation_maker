import { NextResponse } from "next/server";
import { CapacityGate } from "@/lib/capacity/capacityGate";

export async function GET() {
  try {
    const status = await CapacityGate.checkCapacity();
    return NextResponse.json(status);
  } catch (err: any) {
    return NextResponse.json(
      { allowed: false, message: err.message || "Failed to check capacity" },
      { status: 500 }
    );
  }
}

