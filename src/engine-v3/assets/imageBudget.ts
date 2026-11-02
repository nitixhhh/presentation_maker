/**
 * Engine v3 — daily budget for Cloudflare Workers AI images.
 *
 * Cloudflare's free tier gives 10,000 "neurons" a day per account (reset 00:00 UTC = 5:30 AM IST), shared by every model.
 * Cost per image (Cloudflare's pricing page, Nov 2026; see neuronEstimate):
 *   - FLUX.2 klein 4B (Advanced plan): 26.05 neurons per output 512×512 tile → 1024×768 or 1024×576 ≈ 104 → ≈ 95 a day
 *   - FLUX.1 schnell, 4 steps (Basic/Standard): 4.8 per tile + 9.6 per step → 1024×1024 ≈ 58 → ≈ 170 a day
 * Test decks used to drain it silently; afterwards every deck got 0 AI images (and 429s). This counter keeps the day's
 * count (images + estimated neurons, per model) where it survives restarts and redeploys (Supabase storage when
 * configured, else the data dir), writes one log line per image ("[ai-image] …"), and stops asking Cloudflare once:
 *   - the day's count reaches CF_IMAGE_DAILY_LIMIT (default 90; 0 = AI images off), or
 *   - the day's estimated neurons reach CF_NEURON_DAILY_LIMIT (default 9,500 of the 10,000 free), or
 *   - Cloudflare has answered "daily allowance used" (429 / 4006 / neurons) today.
 * Slots that cannot get an AI image fall back to a real, attributed photo (assets/images.ts).
 * V3_AI_IMAGES_PER_DECK (default 6) caps one deck so a single big deck cannot take the whole day.
 */
import { storage } from "@/server/storage";

export interface BudgetState {
  day: string; // UTC date
  used: number; // images Cloudflare returned today
  failed: number;
  /** estimated neurons spent today (sum of neuronEstimate per image) */
  neurons?: number;
  /** images per model today, e.g. { "flux-2-klein-4b": 5, "flux-1-schnell": 2 } */
  byModel?: Record<string, number>;
  exhausted: boolean; // Cloudflare said the daily allowance is gone
  exhaustedAt?: string;
  updatedAt: string;
}

export const utcDay = (d = new Date()) => d.toISOString().slice(0, 10);
export const dailyLimit = () => {
  const n = Number(process.env.CF_IMAGE_DAILY_LIMIT ?? 90);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 90;
};
export const FREE_NEURONS_PER_DAY = 10_000;
export const neuronLimit = () => {
  const n = Number(process.env.CF_NEURON_DAILY_LIMIT ?? 9500);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 9500;
};

/** Cloudflare's published neuron price for one text-to-image call (an estimate: Cloudflare bills tiles of 512×512). */
export function neuronEstimate(model: string, width = 1024, height = 1024, steps = 4): number {
  const tiles = Math.ceil(width / 512) * Math.ceil(height / 512);
  if (/flux-2-klein-4b/.test(model)) return Math.round(26.05 * tiles * 10) / 10;
  if (/flux-1-schnell/.test(model)) return Math.round((4.8 * tiles + 9.6 * steps) * 10) / 10;
  return 0;
}
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
  const nl = neuronLimit();
  if ((s.neurons || 0) >= nl) return { ok: false, reason: `daily neuron budget reached (~${Math.round(s.neurons || 0)}/${nl} of Cloudflare's ${FREE_NEURONS_PER_DAY} free, resets 00:00 UTC)`, used: s.used, limit };
  return { ok: true, used: s.used, limit };
}

/** Today's numbers from memory only (no storage read): for /api/health. Null before the first image of this process. */
export function budgetSnapshot(): { day: string; images: number; failed: number; neuronsEst: number; freeNeurons: number; byModel: Record<string, number>; exhausted: boolean } | null {
  if (!state || state.day !== utcDay()) return null;
  return { day: state.day, images: state.used, failed: state.failed, neuronsEst: Math.round(state.neurons || 0), freeNeurons: FREE_NEURONS_PER_DAY, byModel: { ...(state.byModel || {}) }, exhausted: state.exhausted };
}

/** Record one Cloudflare answer: "ok" (an image came back), "fail" (error/timeout), "quota" (daily allowance gone).
 *  For "ok", pass the model and size: the day's neuron estimate grows and one "[ai-image]" line goes to the server log. */
export async function recordGeneration(result: "ok" | "fail" | "quota", info?: { model: string; width?: number; height?: number; steps?: number; ms?: number; slide?: number }): Promise<void> {
  await loadBudget();
  if (result === "ok") {
    state!.used++;
    if (info) {
      const short = info.model.split("/").pop() || info.model;
      const est = neuronEstimate(info.model, info.width, info.height, info.steps);
      state!.neurons = Math.round(((state!.neurons || 0) + est) * 10) / 10;
      state!.byModel = { ...(state!.byModel || {}), [short]: ((state!.byModel || {})[short] || 0) + 1 };
      console.log(
        `[ai-image] ${state!.day} #${state!.used} ${short} ${info.width || 1024}x${info.height || 1024}${info.slide ? ` slide ${info.slide}` : ""}${info.ms ? ` ${(info.ms / 1000).toFixed(1)}s` : ""} ~${est} neurons · today ${state!.used} images, ~${Math.round(state!.neurons)}/${FREE_NEURONS_PER_DAY} neurons (${Object.entries(state!.byModel).map(([k, v]) => `${k} ${v}`).join(", ")})`
      );
    }
  } else state!.failed++;
  if (result === "quota") {
    state!.exhausted = true;
    state!.exhaustedAt = new Date().toISOString();
  }
  await save();
}

/** Is this Cloudflare error the daily free allowance (not a transient rate limit)? */
export function isDailyQuotaError(status: number, body: string): boolean {
  return (status === 429 && (!body || /neuron|daily|free allocation|4006|quota/i.test(body))) || /"code"\s*:\s*4006\b|daily free allocation/i.test(body || "");
}

/** tests only */
export function resetBudgetForTests() {
  state = null;
  loadedAt = 0;
  writing = Promise.resolve();
}
