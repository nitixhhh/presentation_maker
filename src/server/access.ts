/**
 * Who may see what. Pure functions (no I/O) so the rules are unit-tested.
 *
 * Owner keys: "u:<supabase user id>" for a signed-in account, "c:<browser key>" or "ip:<ip>" without one.
 *  - A job/deck started by a signed-in ACCOUNT belongs to that account only: any other account and any
 *    anonymous caller gets "not found" (404), never a hint that it exists.
 *  - A job started anonymously stays readable by its link (status/progress only — the deck itself is still
 *    checked against the owner key by deckAccess, and files need a signed link).
 */
export function isAccountKey(key?: string | null): boolean {
  return typeof key === "string" && key.startsWith("u:");
}

export function canSeeJob(job: { ownerKey?: string; userId?: string }, viewerKey: string, hasStreamToken = false): boolean {
  const accountOwned = !!job.userId || isAccountKey(job.ownerKey);
  if (!accountOwned) return true;
  if (hasStreamToken) return true; // signed link handed only to the owner by GET /api/v3/jobs/[id]
  if (job.userId) return viewerKey === `u:${job.userId}`;
  return job.ownerKey === viewerKey;
}

/** The live HTML slide: who may load it. */
export function slideAccess(o: { isPublic: boolean; deckOwnerKey?: string; scope: "view" | "full" | null; paymentsOn: boolean }): "ok" | "locked" | "forbidden" {
  if (o.isPublic) return "ok";
  if (o.scope === "full") return "ok";
  if (o.paymentsOn) return o.scope === "view" ? "locked" : "forbidden";
  // payments off: every owner's deck is unlocked, but a signed link from the owner's deck page is still required
  if (o.scope === "view") return "ok";
  return o.deckOwnerKey ? "forbidden" : "ok"; // decks with no owner at all (old gallery samples) stay open
}
