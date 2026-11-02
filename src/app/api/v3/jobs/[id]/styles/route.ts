import { resolveOwner } from "@/server/auth";
import { rateLimit, tooMany } from "@/server/rateLimit";
import { moreStyles } from "@/server/jobs/v6";
import { llmContext } from "@/engine-v3/llm";

/** Engine v6 style step, "Suggest another": three more styles made for the same topic (one AI call). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-z0-9-]{6,64}$/i.test(id)) return Response.json({ error: "bad id" }, { status: 400 });
  const { ownerKey } = await resolveOwner(req);
  if (!rateLimit(`styles:${ownerKey}`, 4, 10)) return tooMany();
  try {
    const plan = await llmContext.run({ stats: [] }, () => moreStyles(id, ownerKey));
    if (!plan) return Response.json({ error: "This plan was not found." }, { status: 404 });
    return Response.json({ plan }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    console.error("[api/v3/jobs/styles]", id, e);
    return Response.json({ error: "Could not make more styles right now. Please try again." }, { status: 500 });
  }
}
