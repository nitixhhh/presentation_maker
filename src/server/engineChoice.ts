/**
 * Which engine makes a deck. Three plans exist (src/server/plans.ts): Basic = v3, Standard = v5, Advanced = v6.
 * ENGINE_DEFAULT (v3 unless set) is what every visitor gets. The site owner (OWNER_USER_IDS = Supabase user ids
 * and/or OWNER_EMAILS = Google login emails, comma-separated) may pick a plan per deck; once PLANS_PUBLIC=true,
 * every visitor may.
 */
import { plansPublic, tierById, type Engine } from "./plans";

export type { Engine } from "./plans";

const ENGINES: Engine[] = ["v3", "v5", "v6"];

/** "v5", "standard", … → the engine, or undefined */
export function engineOf(value: unknown): Engine | undefined {
  const v = String(value ?? "").trim().toLowerCase();
  if ((ENGINES as string[]).includes(v)) return v as Engine;
  return tierById(v)?.engine;
}

export function engineDefault(): Engine {
  return engineOf(process.env.ENGINE_DEFAULT) || "v3";
}

export function ownerEmails(): string[] {
  return String(process.env.OWNER_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.includes("@"));
}

export function ownerUserIds(): string[] {
  return String(process.env.OWNER_USER_IDS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^[0-9a-f-]{20,}$/.test(s));
}

export function isOwner(user: { id?: string; email?: string } | null | undefined): boolean {
  if (!user) return false;
  const id = String(user.id || "").trim().toLowerCase();
  if (id && ownerUserIds().includes(id)) return true;
  const e = String(user.email || "").trim().toLowerCase();
  return !!e && ownerEmails().includes(e);
}

/** the plan picker and the /plans page: the owner always, everyone once PLANS_PUBLIC=true */
export function canChoosePlan(user: { id?: string; email?: string } | null | undefined): boolean {
  return isOwner(user) || plansPublic();
}

/** the engine for a new deck: the chosen plan (owner, or anyone when plans are public), else the site default */
export function engineFor(user: { id?: string; email?: string } | null | undefined, requested: unknown): Engine {
  const e = engineOf(requested);
  if (e && canChoosePlan(user)) return e;
  return engineDefault();
}
