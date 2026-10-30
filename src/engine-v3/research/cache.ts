/** Small disk cache for research (same topic / same query → no repeated API or LLM work). Mechanical only. */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { DATA_ROOT } from "@/server/paths";

const DIR = path.join(DATA_ROOT, "cache", "research");
const TTL_MS = Number(process.env.V3_RESEARCH_CACHE_DAYS || 7) * 86_400_000;

function file(ns: string, key: string) {
  return path.join(DIR, ns, crypto.createHash("sha1").update(key).digest("hex") + ".json");
}

export function cacheGet<T>(ns: string, key: string): T | null {
  if (process.env.V3_RESEARCH_CACHE === "off") return null;
  try {
    const f = file(ns, key);
    const st = fs.statSync(f);
    if (Date.now() - st.mtimeMs > TTL_MS) return null;
    return JSON.parse(fs.readFileSync(f, "utf8"));
  } catch {
    return null;
  }
}

export function cacheSet(ns: string, key: string, value: unknown) {
  try {
    const f = file(ns, key);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, JSON.stringify(value));
  } catch {
    /* cache is best-effort */
  }
}

/** Wrap an async fetcher: identical calls within the TTL return the stored result. Empty results are not cached. */
export async function cached<T>(ns: string, key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cacheGet<T>(ns, key);
  if (hit !== null) return hit;
  const v = await fn();
  if (v && (!Array.isArray(v) || v.length)) cacheSet(ns, key, v);
  return v;
}

export function normTopic(s: string) {
  return s.toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
