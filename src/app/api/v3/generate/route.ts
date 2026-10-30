import { NextRequest } from "next/server";
import { generateDeckV3 } from "@/engine-v3/pipeline";
import { deckSummary } from "@/engine-v3/summary";
import type { V3Request } from "@/engine-v3/types";

/** Engine v3 — streaming generation (Server-Sent Events: progress / complete / error). */
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!body?.topic || typeof body.topic !== "string") return Response.json({ error: "Topic is required" }, { status: 400 });

  const request: V3Request = {
    topic: body.topic.slice(0, 300),
    audience: body.audience,
    slideCount: Math.max(4, Math.min(25, Number(body.slideCount) || 10)),
    language: ["English", "Hindi", "Hinglish"].includes(body.language) ? body.language : "English",
    purpose: body.purpose,
    formatNotes: typeof body.formatNotes === "string" ? body.formatNotes.slice(0, 4000) : undefined,
    presenter: body.presenter || undefined,
    imageMode: body.imageSource === "none" ? "none" : body.imageSource === "ai" ? "ai-allowed" : "real-first",
    styleHint: body.styleHint || body.visualStyle,
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: any) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          /* client went away */
        }
      };
      const keepAlive = setInterval(() => send("ping", { t: Date.now() }), 15000);
      try {
        const deck = await generateDeckV3(request, { onProgress: (p) => send("progress", p) });
        send("complete", { deck: deckSummary(deck) });
      } catch (e: any) {
        console.error("[api/v3/generate]", e);
        send("error", { message: String(e?.message || e).slice(0, 800) });
      } finally {
        clearInterval(keepAlive);
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
