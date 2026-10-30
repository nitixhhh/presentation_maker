import { authConfigured, loginRequired, resolveOwner } from "@/server/auth";
import { ensureProfile } from "@/server/billing";
import { accounts } from "@/server/accounts/store";
import { paymentProvider } from "@/server/payments";
import { pricing } from "@/server/pricing";

/** What the browser needs to know about the visitor and the site's setup. */
export async function GET(req: Request) {
  const { ownerKey, user } = await resolveOwner(req);
  const profile = user ? await ensureProfile(user) : null;
  const provider = paymentProvider();
  return Response.json(
    {
      user: user ? { id: user.id, email: user.email, name: user.name, avatar: user.avatar } : null,
      referralCode: profile?.referralCode || null,
      credits: await accounts().credits(ownerKey),
      auth: { configured: authConfigured(), required: loginRequired(), url: process.env.NEXT_PUBLIC_SUPABASE_URL || null, anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || null },
      payments: provider ? provider.publicConfig() : null,
      pricing: pricing(),
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
