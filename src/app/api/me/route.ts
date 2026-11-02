import { authConfigured, loginRequired, resolveOwner } from "@/server/auth";
import { ensureProfile } from "@/server/billing";
import { accounts } from "@/server/accounts/store";
import { paymentProvider } from "@/server/payments";
import { pricing } from "@/server/pricing";
import { canChoosePlan, engineDefault } from "@/server/engineChoice";
import { plansPublic, TIERS } from "@/server/plans";

/** What the browser needs to know about the visitor and the site's setup. */
export async function GET(req: Request) {
  const { ownerKey, user } = await resolveOwner(req);
  const profile = user ? await ensureProfile(user) : null;
  const provider = paymentProvider();
  const canChoose = canChoosePlan(user);
  return Response.json(
    {
      user: user ? { id: user.id, email: user.email, name: user.name, avatar: user.avatar } : null,
      referralCode: profile?.referralCode || null,
      credits: await accounts().credits(ownerKey),
      auth: { configured: authConfigured(), required: loginRequired(), url: process.env.NEXT_PUBLIC_SUPABASE_URL || null, anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || null },
      payments: provider ? provider.publicConfig() : null,
      pricing: pricing(),
      // the plan picker: the owner only until PLANS_PUBLIC=true; everyone else gets the site default engine
      engine: {
        default: engineDefault(),
        canChoose,
        plansPublic: plansPublic(),
        ...(canChoose ? { plans: TIERS.map(({ id, engine, name, tagline, approxTime }) => ({ id, engine, name, tagline, approxTime })) } : {}),
      },
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
