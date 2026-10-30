import { NextRequest, NextResponse } from "next/server";
import { OwnerAgent } from "@/lib/agents/owner";
import { PresentationRequestSchema } from "@/schemas/presentation";

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const validatedRequest = PresentationRequestSchema.parse(json);

    const deck = await OwnerAgent.orchestrate(validatedRequest);

    return NextResponse.json({
      success: true,
      deck,
    });
  } catch (err: any) {
    console.error("[API /api/pipeline/generate Error]:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to generate presentation",
      },
      { status: 400 }
    );
  }
}
