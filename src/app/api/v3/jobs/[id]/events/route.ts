import { getJobViewFor, subscribe } from "@/server/jobs/manager";
import { resolveOwner } from "@/server/auth";
import { hasJobStreamToken } from "@/server/deckAuth";
import type { JobView } from "@/server/jobs/types";


/**
 * Server-Sent Events for one job. Purely a live view: closing it never affects the job.
 * Sends `job` events on every change, a heartbeat comment every 15 s, and ends when the job ends.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-z0-9-]{6,64}$/i.test(id)) return new Response("bad id", { status: 400 });
  const { ownerKey } = await resolveOwner(req);
  const first = await getJobViewFor(id, ownerKey, hasJobStreamToken(req, id));
  if (!first) return new Response("not found", { status: 404 });

  const enc = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = (v: JobView) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(`event: job\ndata: ${JSON.stringify(v)}\n\n`));
        } catch {
          close();
          return;
        }
        if (v.status === "done" || v.status === "failed") close();
      };
      const hb = setInterval(() => {
        try {
          controller.enqueue(enc.encode(`: ping\n\n`));
        } catch {
          close();
        }
      }, 15000);
      const unsub = subscribe(id, send);
      function close() {
        if (closed) return;
        closed = true;
        clearInterval(hb);
        unsub();
        try {
          controller.close();
        } catch {}
      }
      cleanup = close;
      req.signal.addEventListener("abort", close);
      controller.enqueue(enc.encode(`retry: 3000\n\n`));
      send(first);
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
}
