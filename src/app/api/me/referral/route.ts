import { resolveOwner } from "@/server/auth";
import { claimReferral } from "@/server/billing";
import { clientIp, rateLimit, tooMany } from "@/server/rateLimit";

export async function POST(req: Request) {
  if (!rateLimit(`ref:${clientIp(req)}`, 5)) return tooMany();
  const { user } = await resolveOwner(req);
  if (!user) return Response.json({ error: "Sign in first." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  return Response.json(await claimReferral(user, String(body?.code || "")));
}
