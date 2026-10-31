import { getJobViewFor } from "@/server/jobs/manager";
import { resolveOwner } from "@/server/auth";
import { hasJobStreamToken, jobStreamToken } from "@/server/deckAuth";

/** One job's progress. A deck started by a signed-in account is visible only to that account (404 otherwise). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-z0-9-]{6,64}$/i.test(id)) return Response.json({ error: "bad id" }, { status: 400 });
  const { ownerKey } = await resolveOwner(req);
  const job = await getJobViewFor(id, ownerKey, hasJobStreamToken(req, id));
  if (!job) return Response.json({ error: "not found" }, { status: 404 });
  // EventSource cannot send the login header, so the progress stream gets a signed link instead
  return Response.json({ job, streamToken: jobStreamToken(id) }, { headers: { "Cache-Control": "private, no-store" } });
}
