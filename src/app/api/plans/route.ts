import { resolveOwner } from "@/server/auth";
import { canChoosePlan, engineDefault } from "@/server/engineChoice";
import { plansPublic, TIERS, tierView } from "@/server/plans";

/** The three plans with their example slides. Hidden (404) unless the visitor is the owner or PLANS_PUBLIC=true. */
export async function GET(req: Request) {
  const { user } = await resolveOwner(req);
  const headers = { "Cache-Control": "private, no-store" };
  if (!canChoosePlan(user)) return Response.json({ error: "Not found." }, { status: 404, headers });
  return Response.json({ public: plansPublic(), default: engineDefault(), plans: TIERS.map(tierView) }, { headers });
}
