"use client";
/** Browser-side memory: an anonymous client id + the jobs this browser started ("My decks"). */

export interface SavedJob {
  id: string;
  topic: string;
  createdAt: string;
  request?: Record<string, unknown>; // to offer "Try again"
}

const JOBS_KEY = "deckcraft.jobs.v1";
const CLIENT_KEY = "deckcraft.client.v1";

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

export function savedJobs(): SavedJob[] {
  try {
    const v = JSON.parse(localStorage.getItem(JOBS_KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function saveJob(j: SavedJob) {
  const list = [j, ...savedJobs().filter((x) => x.id !== j.id)].slice(0, 50);
  try {
    localStorage.setItem(JOBS_KEY, JSON.stringify(list));
  } catch {}
}

export function forgetJob(id: string) {
  try {
    localStorage.setItem(JOBS_KEY, JSON.stringify(savedJobs().filter((x) => x.id !== id)));
  } catch {}
}

export function apiHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { "Content-Type": "application/json", "x-client-id": clientId(), ...extra };
}
