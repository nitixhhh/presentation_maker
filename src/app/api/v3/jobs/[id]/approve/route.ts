import { resolveOwner } from "@/server/auth";
import { rateLimit, tooMany } from "@/server/rateLimit";
import { approvePlan } from "@/server/jobs/v6";

/** Engine v6: the student approved the plan (cards may be edited, reordered, added, removed) and chose a style. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-z0-9-]{6,64}$/i.test(id)) return Response.json({ error: "bad id" }, { status: 400 });
  const { ownerKey, user } = await resolveOwner(req);
  if (!rateLimit(`approve:${ownerKey}`, 3, 4)) return tooMany();
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const r = await approvePlan(id, ownerKey, user?.id, body);
  if (r.error) return Response.json({ error: r.error }, { status: r.status || 400 });
  return Response.json({ job: r.job }, { status: 202 });
}
