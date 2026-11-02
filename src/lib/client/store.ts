"use client";
/**
 * Browser-side memory: an anonymous client id + the jobs started on this browser ("My decks").
 *
 * The saved-jobs list is kept PER IDENTITY: one list for the signed-in account (key "u:<user id>") and a
 * separate "anon" list for decks made while signed out. Signing out deletes that account's list from this
 * browser, so the next person (or the next Google account) on the same phone never sees it.
 * Signed in, "My decks" shows the account's list from the server; the local list only remembers the
 * newest job so the app can reopen it.
 */

/** the plan picked on this phone (an engine id: v3 | v5 | v6) */
export const PLAN_KEY = "dc_plan";

export interface SavedJob {
  id: string;
  topic: string;
  createdAt: string;
  request?: Record<string, unknown>; // to offer "Try again"
}

/** v1 was one list for everyone on the browser — the account-mixing bug. Moved to "anon" once. */
const LEGACY_JOBS_KEY = "deckcraft.jobs.v1";
const JOBS_PREFIX = "deckcraft.jobs.v2.";
const CLIENT_KEY = "deckcraft.client.v1";

let owner = "anon";

export function jobsKey(who: string = owner): string {
  return JOBS_PREFIX + who;
}

/** "anon" when signed out, "u:<id>" when signed in. */
export function ownerScope(userId?: string | null): string {
  return userId ? `u:${userId}` : "anon";
}

/** Called by the auth layer whenever the session changes. */
export function setJobsOwner(userId?: string | null) {
  owner = ownerScope(userId);
  migrateLegacy();
}

function migrateLegacy() {
  try {
    const raw = localStorage.getItem(LEGACY_JOBS_KEY);
    if (raw == null) return;
    localStorage.removeItem(LEGACY_JOBS_KEY);
    // We cannot tell whose decks the old shared list held. Keep them only in the signed-out list: the server
    // leaves out any deck that belongs to an account, so nothing private resurfaces from it.
    const old = JSON.parse(raw);
    if (!Array.isArray(old) || !old.length) return;
    const anonKey = jobsKey("anon");
    const cur = readList(anonKey);
    const merged = [...cur, ...old.filter((o: SavedJob) => o && o.id && !cur.some((c) => c.id === o.id))].slice(0, 50);
    localStorage.setItem(anonKey, JSON.stringify(merged));
  } catch {}
}

export function clientId(): string {
  try {
    let id = localStorage.getItem(CLIENT_KEY);
    if (!id) {
      id = (crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^a-z0-9-]/gi, "");
      localStorage.setItem(CLIENT_KEY, id);
    }
    return id;
  } catch {
    return "anonymous-browser";
  }
}

function readList(key: string): SavedJob[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function savedJobs(who: string = owner): SavedJob[] {
  migrateLegacy();
  return readList(jobsKey(who));
}

export function saveJob(j: SavedJob, who: string = owner) {
  const list = [j, ...savedJobs(who).filter((x) => x.id !== j.id)].slice(0, 50);
  try {
    localStorage.setItem(jobsKey(who), JSON.stringify(list));
  } catch {}
}

export function forgetJob(id: string, who: string = owner) {
  try {
    localStorage.setItem(jobsKey(who), JSON.stringify(savedJobs(who).filter((x) => x.id !== id)));
  } catch {}
}

/** Keep only the ids the server still shows to this visitor (drops decks of other accounts, deleted jobs). */
export function keepOnly(ids: string[], who: string = owner) {
  const ok = new Set(ids);
  try {
    localStorage.setItem(jobsKey(who), JSON.stringify(savedJobs(who).filter((x) => ok.has(x.id))));
  } catch {}
}

/** Sign-out: remove that account's list from this browser. */
export function clearJobs(who: string) {
  try {
    localStorage.removeItem(jobsKey(who));
  } catch {}
}

