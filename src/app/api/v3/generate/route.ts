import { NextRequest } from "next/server";
import { createJob, getJobView, subscribe, QueueFullError } from "@/server/jobs/manager";
import { ownerKeyOf, parseV3Request } from "@/server/http";
import { loadDeck } from "@/engine-v3/store";
import { deckSummary } from "@/engine-v3/summary";


/**
 * Legacy streaming endpoint (kept for scripts). It now starts a background job and streams its
 * progress; closing the stream does NOT stop the deck. New clients use /api/v3/jobs.
 */
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = parseV3Request(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  let jobId: string;
  try {
    jobId = (await createJob(parsed.value, ownerKeyOf(req))).id;
  } catch (e: any) {
    return Response.json({ error: e instanceof QueueFullError ? e.message : "could not start" }, { status: e instanceof QueueFullError ? 429 : 500 });
  }
  const enc = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: any) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          finish();
        }
      };
      const hb = setInterval(() => send("ping", { t: Date.now() }), 15000);
      const unsub = subscribe(jobId, (v) => {
        if (v.status === "done" && v.deckId) {
          const deck = loadDeck(v.deckId);
          send("complete", { jobId, deck: deck ? deckSummary(deck) : null });
          finish();
        } else if (v.status === "failed") {
          send("error", { jobId, message: v.error });
          finish();
        } else send("progress", { jobId, step: v.progress.step, stage: v.progress.stage, percent: v.progress.percent, details: v.progress.details, queuePosition: v.queuePosition, etaSeconds: v.etaSeconds });
      });
      function finish() {
        if (closed) return;
        closed = true;
        clearInterval(hb);
        unsub();
        try {
          controller.close();
        } catch {}
      }
      cleanup = finish;
      req.signal.addEventListener("abort", finish);
      send("job", { jobId, job: await getJobView(jobId) });
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
