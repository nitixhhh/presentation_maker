/**
 * Engine v3 — daily budget for Cloudflare Workers AI images.
 *
 * Cloudflare's free tier gives 10,000 "neurons" a day (reset 00:00 UTC = 5:30 AM IST). One Flux-schnell image at
 * 1024×1024 / 8 steps costs ≈ 96 neurons, so ≈ 100 images a day. Test decks used to drain it silently; afterwards every
 * deck got 0 AI images (and 429s). This counter keeps the day's count where it survives restarts and redeploys
 * (Supabase storage when configured, else the data dir) and stops asking Cloudflare once:
 *   - the day's count reaches CF_IMAGE_DAILY_LIMIT (default 90; 0 = AI images off), or
 *   - Cloudflare has answered "daily allowance used" (429 / neurons) today.
 * Slots that cannot get an AI image fall back to a real, attributed photo (assets/images.ts).
 * V3_AI_IMAGES_PER_DECK (default 6) caps one deck so a single big deck cannot take the whole day.
 */
import { storage } from "@/server/storage";

export interface BudgetState {
  day: string; // UTC date
  used: number; // images Cloudflare returned today
  failed: number;
  exhausted: boolean; // Cloudflare said the daily allowance is gone
  exhaustedAt?: string;
  updatedAt: string;
}

export const utcDay = (d = new Date()) => d.toISOString().slice(0, 10);
export const dailyLimit = () => {
  const n = Number(process.env.CF_IMAGE_DAILY_LIMIT ?? 90);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 90;
};
export const perDeckLimit = () => {
  const n = Number(process.env.V3_AI_IMAGES_PER_DECK ?? 6);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 6;
};

let state: BudgetState | null = null;
let loadedAt = 0;
let writing: Promise<void> = Promise.resolve();

const fresh = (day: string): BudgetState => ({ day, used: 0, failed: 0, exhausted: false, updatedAt: new Date().toISOString() });

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]).catch(() => null);
}

/** Today's state: in memory, refreshed from durable storage at most every 60 s (one server instance on Render free). */
export async function loadBudget(): Promise<BudgetState> {
  const day = utcDay();
  if (state && state.day === day && Date.now() - loadedAt < 60_000) return state;
  const stored = (await withTimeout(storage().getMeta(`cf-images-${day}`), 5000)) as BudgetState | null;
  const mem = state && state.day === day ? state : null;
  // never go backwards: the higher count wins (a write may still be in flight)
  if (stored && stored.day === day) state = mem && mem.used + mem.failed > stored.used + stored.failed ? mem : { ...fresh(day), ...stored, exhausted: !!(stored.exhausted || mem?.exhausted) };
  else state = mem || fresh(day);
  loadedAt = Date.now();
  return state;
}

function save() {
  const s = { ...state!, updatedAt: new Date().toISOString() };
  state = s;
  writing = writing.then(() => withTimeout(storage().putMeta(`cf-images-${s.day}`, s), 5000).then(() => undefined));
  return writing;
}

/** May the engine ask Cloudflare for one more image right now? */
export async function canGenerate(): Promise<{ ok: boolean; reason?: string; used: number; limit: number }> {
  const s = await loadBudget();
  const limit = dailyLimit();
  if (limit === 0) return { ok: false, reason: "AI images are switched off (CF_IMAGE_DAILY_LIMIT=0)", used: s.used, limit };
  if (s.exhausted) return { ok: false, reason: "Cloudflare's free daily allowance is used up (resets 00:00 UTC)", used: s.used, limit };
  if (s.used >= limit) return { ok: false, reason: `daily AI-image budget reached (${s.used}/${limit}, resets 00:00 UTC)`, used: s.used, limit };
  return { ok: true, used: s.used, limit };
}

/** Record one Cloudflare answer: "ok" (an image came back), "fail" (error/timeout), "quota" (daily allowance gone). */
export async function recordGeneration(result: "ok" | "fail" | "quota"): Promise<void> {
  await loadBudget();
  if (result === "ok") state!.used++;
  else state!.failed++;
  if (result === "quota") {
    state!.exhausted = true;
    state!.exhaustedAt = new Date().toISOString();
  }
  await save();
}

/** Is this Cloudflare error the daily free allowance (not a transient rate limit)? */
export function isDailyQuotaError(status: number, body: string): boolean {
  return status === 429 && (!body || /neuron|daily|free allocation|4006|quota/i.test(body));
}

/** tests only */
export function resetBudgetForTests() {
  state = null;
  loadedAt = 0;
  writing = Promise.resolve();
}
