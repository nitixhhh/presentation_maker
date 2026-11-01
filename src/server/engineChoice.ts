/**
 * Which engine makes a deck. v3 stays the default on the live site; ENGINE_DEFAULT=v4 switches everyone.
 * The site owner (OWNER_USER_IDS = Supabase user ids and/or OWNER_EMAILS = Google login emails, comma-separated) can pick either engine per deck with the
 * "New engine (beta)" switch; everyone else always gets ENGINE_DEFAULT.
 */

export type Engine = "v3" | "v4";

export function engineDefault(): Engine {
  return String(process.env.ENGINE_DEFAULT || "v3").trim().toLowerCase() === "v4" ? "v4" : "v3";
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

/** the engine for a new deck: the owner's explicit choice, else the site default */
export function engineFor(user: { id?: string; email?: string } | null | undefined, requested: unknown): Engine {
  if ((requested === "v3" || requested === "v4") && isOwner(user)) return requested;
  return engineDefault();
}
