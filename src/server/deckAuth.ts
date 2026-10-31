/**
 * Image tags and download links cannot send auth headers, so the authenticated deck endpoint hands out
 * short-lived signed URLs: scope "view" (watermarked previews) or "full" (clean previews, slide HTML, files).
 */
import { makeToken, readToken } from "./secret";

export function deckToken(deckId: string, scope: "view" | "full", ttlSeconds = 6 * 3600) {
  return makeToken({ d: deckId, s: scope }, ttlSeconds);
}

/** Signed link for the live progress stream (EventSource cannot send the login header). */
export function jobStreamToken(jobId: string, ttlSeconds = 12 * 3600) {
  return makeToken({ j: jobId, s: "stream" }, ttlSeconds);
}

export function hasJobStreamToken(req: Request, jobId: string): boolean {
  const t = new URL(req.url).searchParams.get("t") || "";
  const d = readToken<{ j: string; s: string }>(t);
  return !!d && d.j === jobId && d.s === "stream";
}

export function tokenScope(req: Request, deckId: string): "view" | "full" | null {
  const t = new URL(req.url).searchParams.get("t") || "";
  const d = readToken<{ d: string; s: "view" | "full" }>(t);
  if (!d || d.d !== deckId) return null;
  return d.s === "full" ? "full" : "view";
}
