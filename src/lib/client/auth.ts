"use client";
/**
 * Google sign-in through Supabase Auth, configured at runtime from /api/me (so the same Docker image works
 * with any Supabase project). Every API call goes through api(), which adds the browser key and, when
 * signed in, the Supabase access token.
 */
import { createClient, type SupabaseClient, type Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { clearJobs, clientId, ownerScope, setJobsOwner } from "./store";

export interface Me {
  user: { id: string; email?: string; name?: string; avatar?: string } | null;
  referralCode: string | null;
  credits: number;
  auth: { configured: boolean; required: boolean; url: string | null; anonKey: string | null };
  payments: { provider: string; keyId?: string; testMode?: boolean } | null;
  pricing: { deck: number; firstDeck: number; pack5: number; referralCredits: number; freeEdits: number };
  /** engine v4 beta: the owner may choose the engine per deck */
  engine?: { default: "v3" | "v4"; canChoose: boolean };
}

let sb: SupabaseClient | null = null;
let session: Session | null = null;
let configPromise: Promise<Me | null> | null = null;
const listeners = new Set<() => void>();

async function loadConfig(): Promise<Me | null> {
  const r = await fetch("/api/me", { headers: { "x-client-id": clientId() }, cache: "no-store" }).catch(() => null);
  return r && r.ok ? r.json() : null;
}

export async function supabase(): Promise<SupabaseClient | null> {
  if (sb) return sb;
  configPromise ||= loadConfig();
  const me = await configPromise;
  if (!me?.auth.configured || !me.auth.url || !me.auth.anonKey) return null;
  if (!sb) {
    sb = createClient(me.auth.url, me.auth.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" } });
    const { data } = await sb.auth.getSession();
    session = data.session;
    setJobsOwner(session?.user?.id);
    sb.auth.onAuthStateChange((e, s) => {
      const before = session?.user?.id;
      session = s;
      // signed out (here or in another tab) or switched account: forget the previous account's decks on this browser
      if (before && (e === "SIGNED_OUT" || (s?.user?.id && s.user.id !== before))) clearJobs(ownerScope(before));
      setJobsOwner(s?.user?.id);
      listeners.forEach((f) => f());
    });
  }
  return sb;
}

export async function accessToken(): Promise<string | null> {
  await supabase();
  return session?.access_token || null;
}

/** fetch() with the browser key + login token */
export async function api(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await accessToken();
  const headers: Record<string, string> = { "x-client-id": clientId(), ...(init.body ? { "Content-Type": "application/json" } : {}), ...((init.headers as any) || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(url, { cache: "no-store", ...init, headers });
}

export async function signInWithGoogle(redirectTo?: string) {
  const c = await supabase();
  if (!c) throw new Error("Sign-in is not set up on this site yet.");
  await c.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo || window.location.href } });
}

export async function signOut() {
  const c = await supabase();
  const before = session?.user?.id;
  await c?.auth.signOut();
  if (before) clearJobs(ownerScope(before));
  session = null;
  setJobsOwner(null);
  try {
    sessionStorage.removeItem("deckcraft.pending.v1");
  } catch {}
}

/** Resolves once the login state of this browser is known (so lists are read for the right person). */
export async function authReady(): Promise<string | null> {
  await supabase().catch(() => null);
  return session?.user?.id || null;
}

/** The visitor (re-loaded after sign-in/out) */
export function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const f = () => setTick((t) => t + 1);
    listeners.add(f);
    supabase().then(() => f());
    return () => {
      listeners.delete(f);
    };
  }, []);
  useEffect(() => {
    let stop = false;
    api("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => !stop && d && setMe(d))
      .catch(() => {});
    return () => {
      stop = true;
    };
  }, [tick]);
  return { me, refresh: () => setTick((t) => t + 1) };
}

const REF_KEY = "deckcraft.ref.v1";
/** ?ref=CODE on any link → remembered until the visitor signs in, then claimed once */
export function rememberReferral() {
  try {
    const code = new URLSearchParams(window.location.search).get("ref");
    if (code && /^[A-Z0-9]{4,12}$/i.test(code)) localStorage.setItem(REF_KEY, code.toUpperCase());
  } catch {}
}
export async function claimReferralIfAny() {
  try {
    const code = localStorage.getItem(REF_KEY);
    if (!code || !(await accessToken())) return;
    await api("/api/me/referral", { method: "POST", body: JSON.stringify({ code }) });
    localStorage.removeItem(REF_KEY);
  } catch {}
}
