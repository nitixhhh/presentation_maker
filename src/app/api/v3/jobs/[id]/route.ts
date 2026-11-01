import { deleteJobFor, getJobViewFor } from "@/server/jobs/manager";
import { resolveOwner } from "@/server/auth";
import { hasJobStreamToken, jobStreamToken } from "@/server/deckAuth";

/** One job's progress. A deck started by a signed-in account is visible only to that account (404 otherwise). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-z0-9-]{6,64}$/i.test(id)) return Response.json({ error: "bad id" }, { status: 400 });
  const job = await getJobViewFor(id, resolveOwner(req).then((o) => o.ownerKey), hasJobStreamToken(req, id));
  if (!job) return Response.json({ error: "not found" }, { status: 404 });
  // EventSource cannot send the login header, so the progress stream gets a signed link instead
  return Response.json({ job, streamToken: jobStreamToken(id) }, { headers: { "Cache-Control": "private, no-store" } });
}

/** Delete a deck for good (owner only: the signed-in account, or the browser that made it while signed out). */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-z0-9-]{6,64}$/i.test(id)) return Response.json({ error: "bad id" }, { status: 400 });
  const { ownerKey } = await resolveOwner(req);
  try {
    const r = await deleteJobFor(id, ownerKey);
    if (r === "not_found") return Response.json({ error: "not found" }, { status: 404 });
    if (r === "busy") return Response.json({ error: "This deck is still being made. You can delete it once it is finished." }, { status: 409 });
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[api/v3/jobs] delete failed", id, e);
    return Response.json({ error: "Could not delete the deck. Please try again." }, { status: 500 });
  }
}
