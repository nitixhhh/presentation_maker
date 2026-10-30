/**
 * Accounts: Supabase Auth (Google login). The browser signs in with supabase-js and sends its access
 * token as `Authorization: Bearer …`; the server verifies it with Supabase. Works once
 * NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY are set and Google is enabled in Supabase.
 * Without them the site runs in open testing mode (anonymous browser keys).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  avatar?: string;
}

export function authConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** Login is required to generate when auth is configured (set REQUIRE_LOGIN=false to keep it open). */
export function loginRequired(): boolean {
  return authConfigured() && process.env.REQUIRE_LOGIN !== "false";
}

let client: SupabaseClient | null = null;
const cache = new Map<string, { user: AuthUser | null; at: number }>();

export async function getUser(req: Request): Promise<AuthUser | null> {
  if (!authConfigured()) return null;
  const h = req.headers.get("authorization") || "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  if (!token || token.length < 20) return null;
  const hit = cache.get(token);
  if (hit && Date.now() - hit.at < 60_000) return hit.user;
  client ||= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  const user = error || !data?.user ? null : { id: data.user.id, email: data.user.email, name: (data.user.user_metadata as any)?.full_name, avatar: (data.user.user_metadata as any)?.avatar_url };
  cache.set(token, { user, at: Date.now() });
  if (cache.size > 2000) cache.clear();
  return user;
}

/** Who is asking: a signed-in user, else the anonymous browser key, else the IP. */
export async function resolveOwner(req: Request): Promise<{ ownerKey: string; user: AuthUser | null }> {
  const user = await getUser(req);
  if (user) return { ownerKey: `u:${user.id}`, user };
  const k = req.headers.get("x-client-id") || "";
  if (/^[a-z0-9-]{8,64}$/i.test(k)) return { ownerKey: `c:${k}`, user: null };
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "anon";
  return { ownerKey: `ip:${ip}`, user: null };
}
