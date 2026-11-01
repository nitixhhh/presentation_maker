import { createJob, getJobViewsFor, jobsOfOwner, queueStats, QueueFullError } from "@/server/jobs/manager";
import { parseV3Request } from "@/server/http";
import { loginRequired, resolveOwner } from "@/server/auth";
import { clientIp, rateLimit, tooMany } from "@/server/rateLimit";
import { engineFor } from "@/server/engineChoice";

/** Start a deck. Returns { job } immediately; the deck is generated in the background. */
export async function POST(req: Request) {
  const { ownerKey, user } = await resolveOwner(req);
  if (loginRequired() && !user) return Response.json({ error: "Please sign in with Google to make a deck." }, { status: 401 });
  // per person and per network: a few decks a minute at most (the queue limits the rest)
  if (!rateLimit(`job:${ownerKey}`, 3, 4) || !rateLimit(`jobip:${clientIp(req)}`, 6, 8)) return tooMany();
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  // Gemini API terms: users must be 18+ (the form asks once; REQUIRE_AGE_CONFIRM=false turns this off)
  if (process.env.REQUIRE_AGE_CONFIRM !== "false" && body?.ageConfirmed !== true) {
    return Response.json({ error: "Please confirm you are 18 or older to make a deck." }, { status: 400 });
  }
  const parsed = parseV3Request(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  // engine: v3 by default; only the owner may pick (body.engine "v4" / "v3"), ENGINE_DEFAULT switches everyone
  parsed.value.engine = engineFor(user, body?.engine);
  try {
    const job = await createJob(parsed.value, ownerKey, user?.id);
    return Response.json({ job }, { status: 202 });
  } catch (e: any) {
    if (e instanceof QueueFullError) return Response.json({ error: e.message }, { status: 429 });
    console.error("[api/v3/jobs]", e);
    return Response.json({ error: "Could not start the deck. Please try again." }, { status: 500 });
  }
}

/** GET ?ids=a,b,c → those jobs (the "My decks" list kept in this browser);
 *  GET ?mine=1 → all decks of the signed-in account; without either → queue stats. */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  if (!rateLimit(`jobsget:${clientIp(req)}`, 120, 60)) return tooMany();
  if (sp.get("mine")) {
    const { ownerKey, user } = await resolveOwner(req);
    if (!user) return Response.json({ jobs: [] });
    return Response.json({ jobs: await jobsOfOwner(ownerKey) }, { headers: { "Cache-Control": "private, no-store" } });
  }
  const ids = (sp.get("ids") || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[a-z0-9-]{6,64}$/i.test(s))
    .slice(0, 50);
  if (!ids.length) return Response.json({ queue: await queueStats() });
  // only the caller's own decks (jobs of another account are left out — no hint they exist)
  const { ownerKey } = await resolveOwner(req);
  return Response.json({ jobs: await getJobViewsFor(ids, ownerKey) }, { headers: { "Cache-Control": "private, no-store" } });
}
