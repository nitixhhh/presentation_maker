import { createJob, getJobViews, queueStats, QueueFullError } from "@/server/jobs/manager";
import { ownerKeyOf, parseV3Request } from "@/server/http";


/** Start a deck. Returns { job } immediately; the deck is generated in the background. */
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = parseV3Request(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  try {
    const job = await createJob(parsed.value, ownerKeyOf(req));
    return Response.json({ job }, { status: 202 });
  } catch (e: any) {
    if (e instanceof QueueFullError) return Response.json({ error: e.message }, { status: 429 });
    console.error("[api/v3/jobs]", e);
    return Response.json({ error: "Could not start the deck. Please try again." }, { status: 500 });
  }
}

/** GET ?ids=a,b,c → those jobs (the "My decks" list); without ids → queue stats. */
export async function GET(req: Request) {
  const ids = (new URL(req.url).searchParams.get("ids") || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[a-z0-9-]{6,64}$/i.test(s))
    .slice(0, 50);
  if (!ids.length) return Response.json({ queue: await queueStats() });
  return Response.json({ jobs: await getJobViews(ids) }, { headers: { "Cache-Control": "no-store" } });
}
