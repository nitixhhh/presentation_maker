/**
 * Engine v3 — LLM provider pool with a rate-limit-aware scheduler (free tiers first).
 *
 * Every AI call names a ROLE (brief, research, outline, art, design, vision). Each role has an ordered
 * list of routes (provider + model) in src/config/models.json → engineV3.roles. The scheduler:
 *
 *  - knows each free model's published limits (requests/min, requests/day, tokens/min, tokens/day —
 *    engineV3.models) and keeps live budgets per API key, so it does not send requests it knows
 *    will be refused;
 *  - ONE key per provider (GROQ_API_KEY, CEREBRAS_API_KEY, …); a provider whose key is not set is skipped.
 *    (No multi-key rotation: one account per provider, as each provider's terms expect.)
 *  - quality tiers: art/design/vision ("strong" roles) only ever use models marked tier "strong" (or untiered);
 *    brief/research/outline ("light" roles) try fast models first so the Gemini quota is saved for design;
 *  - a provider that keeps timing out / erroring is benched for a few minutes (circuit breaker), and a
 *    request that gets no first byte (or stalls mid-stream) is abandoned early, so a dead provider costs
 *    seconds instead of minutes;
 *  - on 429 reads Retry-After / Gemini retryDelay / "try again in 7m12s", cools that key+model down,
 *    and marks a model "used up for today" when the provider says the DAILY quota is gone (kept on disk
 *    across restarts);
 *  - fails over instantly to the next route (e.g. Gemini 3.8 Flash → 3.7 Flash → … → OpenRouter :free →
 *    Groq → Cloudflare). For quality-critical roles it first waits a few seconds for the better model;
 *  - when every route is busy it WAITS (the job just progresses slower) instead of failing. It only
 *    gives up after V3_MAX_CAPACITY_WAIT_MIN minutes (default 20) with no capacity at all.
 *
 * Runtime overrides (no code change):
 *   ENGINE_V3_ROUTES='{"design":["groq:openai/gpt-oss-120b"], "*":[...]}'   (strings "provider:model" or {provider, model})
 *   <PROVIDER>_BASE_URL (GOOGLE_AI_BASE_URL, GROQ_BASE_URL, OPENROUTER_BASE_URL, CLOUDFLARE_BASE_URL)
 *   CUSTOM_LLM_BASE_URL + CUSTOM_LLM_API_KEY — any OpenAI-compatible provider, route provider "custom"
 *   V3_LIMIT_<PROVIDER>_RPM=… to override a provider's requests/minute for every model.
 */
import fs from "fs";
import path from "path";
import { AsyncLocalStorage } from "async_hooks";
import modelsConfig from "@/config/models.json";
import { DATA_ROOT } from "@/server/paths";

export type Role = "brief" | "research" | "outline" | "plan" | "art" | "design" | "vision" | "planner" | "agent";
export const ROLES: Role[] = ["brief", "research", "outline", "plan", "art", "design", "vision", "planner", "agent"];
/** roles where quality decides the deck: only "strong" models may serve them */
export const STRONG_ROLES: Role[] = ["art", "design", "vision"];
/** light roles: fast models first, Gemini quota saved for design */
export const LIGHT_ROLES: Role[] = ["brief", "research", "outline", "plan"];

export interface Route {
  provider: string;
  model: string;
  /** ms we are willing to wait for this route before falling to the next (quality-critical roles) */
  waitMs?: number;
}

export type ContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
  /** provider extras (e.g. Gemini's thought signature) — echoed back unchanged */
  [k: string]: any;
}

export interface Msg {
  role: "system" | "user" | "assistant" | "tool";
  content: string | ContentPart[] | null;
  /** engine v4 tool loop: the assistant's tool calls / the id a tool result answers */
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface LlmResult {
  text: string;
  provider: string;
  model: string;
  ms: number;
  waitedMs: number;
  /** tool calls the model made (only when CallOpts.tools was given) */
  toolCalls?: ToolCall[];
  finishReason?: string;
}

interface Limits {
  /** pacing: at least this many ms between two requests on one key+model (e.g. mistral-small ≤ 1 req/s) */
  minIntervalMs?: number;
  rpm?: number;
  rpd?: number;
  tpm?: number;
  tpd?: number;
}

interface ModelSpec extends Limits {
  vision?: boolean;
  ctx?: number;
  maxOutput?: number;
  /** some reasoning models need a reasoning_effort field */
  reasoning?: boolean;
  /** fixed reasoning effort for this model (e.g. Gemma 4: "minimal" — its thinking otherwise eats the output budget) */
  reasoningEffort?: string;
  /** model rejects response_format json mode (e.g. Gemma on the Gemini API answers HTTP 500) */
  noJsonMode?: boolean;
  /** "strong" = allowed for design/art/vision; "fast" = light roles only (brief/research/outline) */
  tier?: "strong" | "fast";
  /** extra provider-specific request fields (e.g. NVIDIA chat_template_kwargs to switch thinking off) */
  extraBody?: Record<string, unknown>;
  /** hard cap for one request to this model (ms); the smaller of this and the caller's timeout wins */
  timeoutMs?: number;
}

interface ProviderCfg {
  name: string;
  baseUrl: string;
  baseUrlEnv?: string;
  apiKeyEnv: string;
  accountIdEnv?: string;
  enabled: boolean;
  /** account-wide limits shared by all models (e.g. OpenRouter free: 20 rpm, 50 rpd) */
  accountLimits?: Limits;
  concurrency?: number;
  /** when the provider's daily quota resets: "pacific-midnight" | "utc-midnight" | "rolling" */
  dailyReset?: string;
  /** the provider's tokens-per-minute limit counts only input tokens (Gemini) */
  tpmInputOnly?: boolean;
  /** usable ONLY on the /benchmark page, never in production routes (e.g. NVIDIA's free API: trial terms forbid production use) */
  benchmarkOnly?: boolean;
  /** short label shown on the /benchmark page */
  note?: string;
  /** hard cap for one request to this provider (ms) */
  timeoutMs?: number;
  /** abort when no response headers arrive within this many ms (streaming requests) */
  firstByteMs?: number;
  /** abort a stream that sends nothing for this many ms */
  idleMs?: number;
}

const cfg = modelsConfig as any;
const ENV_BASE: Record<string, string> = {
  ollama: "OLLAMA_BASE_URL",
  nvidia: "NVIDIA_BASE_URL",
  google: "GOOGLE_AI_BASE_URL",
  groq: "GROQ_BASE_URL",
  openrouter: "OPENROUTER_BASE_URL",
  cloudflare: "CLOUDFLARE_BASE_URL",
  cerebras: "CEREBRAS_BASE_URL",
  mistral: "MISTRAL_BASE_URL",
  zai: "ZAI_BASE_URL",
  sambanova: "SAMBANOVA_BASE_URL",
  github: "GITHUB_MODELS_BASE_URL",
};

// ── per-call context (job progress hooks, benchmark route overrides) ─────────────
export interface LlmContext {
  /** called when the scheduler has to wait for capacity (shown to the user as "slower progress") */
  onWait?: (message: string) => void;
  /** force routes per role (the /benchmark page uses this) */
  routes?: Partial<Record<Role | "*", Route[]>>;
  /** collects per-call stats for this job */
  stats?: CallStat[];
}
export interface CallStat {
  role: Role;
  provider: string;
  model: string;
  ms: number;
  waitedMs: number;
  ok: boolean;
  tokensIn?: number;
  tokensOut?: number;
  error?: string;
  at: string;
}
export const llmContext = new AsyncLocalStorage<LlmContext>();

// ── providers, keys, routes ────────────────────────────────────────────────────
function providerCfg(id: string): ProviderCfg | null {
  return (cfg.providers?.[id] as ProviderCfg) || null;
}

/** The provider's API key (exactly one per provider; absent env var = provider skipped). */
export function keysFor(id: string): string[] {
  const p = providerCfg(id);
  if (!p || p.enabled === false) return [];
  const key = (process.env[p.apiKeyEnv] || "").trim();
  return key ? [key] : [];
}

function baseUrlFor(id: string): string | null {
  const p = providerCfg(id);
  if (!p) return null;
  let baseUrl = (p.baseUrlEnv && process.env[p.baseUrlEnv]) || process.env[ENV_BASE[id] || ""] || p.baseUrl;
  if (!baseUrl) return null;
  if (baseUrl.includes("{account_id}")) {
    const acc = process.env[p.accountIdEnv || "CLOUDFLARE_ACCOUNT_ID"];
    if (!acc) return null;
    baseUrl = baseUrl.replace("{account_id}", acc);
  }
  return baseUrl.replace(/\/$/, "");
}

function providerReady(id: string) {
  return keysFor(id).length > 0 && !!baseUrlFor(id);
}

export function availableProviders(): string[] {
  return Object.keys(cfg.providers || {}).filter(providerReady);
}

function parseRoute(r: any): Route | null {
  if (typeof r === "string") {
    const i = r.indexOf(":");
    if (i < 0) return null;
    return { provider: r.slice(0, i), model: r.slice(i + 1) };
  }
  if (r && typeof r.provider === "string" && typeof r.model === "string") return { provider: r.provider, model: r.model, waitMs: r.waitMs };
  return null;
}

/** Configured routes for a role (env override → context override → models.json), only providers with keys. */
export function routesFor(role: Role, opts: { all?: boolean } = {}): Route[] {
  let routes: Route[] = (cfg.engineV3?.roles?.[role] || []).map(parseRoute).filter(Boolean);
  const override = process.env.ENGINE_V3_ROUTES;
  if (override) {
    try {
      const o = JSON.parse(override);
      const pick = o[role] || o["*"];
      if (pick) routes = pick.map(parseRoute).filter(Boolean);
    } catch {
      console.warn("[v3/llm] ENGINE_V3_ROUTES is not valid JSON — ignored");
    }
  }
  const ctx = llmContext.getStore();
  const forced = ctx?.routes?.[role] || ctx?.routes?.["*"];
  if (forced?.length) routes = forced;
  else {
    // Opt-in production routes (models.json → engineV3.optInRoutes.<provider>), e.g. ALLOW_NVIDIA_PRODUCTION=true
    // adds NVIDIA as a BACKUP right after the Gemini chain (Gemini stays the main designer).
    const optIn = (cfg.engineV3?.optInRoutes || {}) as Record<string, any>;
    for (const [prov, o] of Object.entries(optIn)) {
      if (prov.startsWith("_") || !o?.env || process.env[o.env] !== "true") continue;
      routes = placeOptIn(routes, role, o);
    }
    // trial-only providers (NVIDIA) never serve production traffic unless their opt-in env is set
    routes = routes.filter((r) => !isBenchmarkOnly(r.provider) || productionOptedIn(r.provider));
    // pay-per-token providers can be pushed to the end of every chain (OLLAMA_PRIORITY=last)
    if (process.env.OLLAMA_PRIORITY === "last") routes = [...routes.filter((r) => r.provider !== "ollama"), ...routes.filter((r) => r.provider === "ollama")];
    routes = routes.filter((r, i, a) => a.findIndex((x) => x.provider === r.provider && x.model === r.model) === i);
    // quality guard: design/art/vision never fall to a model marked "fast" (an explicit ENGINE_V3_ROUTES override is trusted)
    if (!override) routes = applyTierPolicy(role, routes);
  }
  return opts.all ? routes : routes.filter((r) => providerReady(r.provider));
}

/** DESIGN_PRIMARY switch: `value` may be one word or a list (e.g. ["nvidia", "nvidia-kimi"]). */
function primaryOn(prim: any): boolean {
  if (!prim?.env) return false;
  const v = String(process.env[prim.env] || "").trim().toLowerCase();
  const vals = (Array.isArray(prim.value) ? prim.value : [prim.value]).map((x: any) => String(x).toLowerCase());
  return !!v && vals.includes(v);
}

/** The routes the switch puts first for a role: env `listEnv` (comma-separated model ids, e.g. NVIDIA_DESIGN_MODELS) overrides `prepend`. */
export function primaryRoutes(prim: any, role: string): Route[] {
  const fromCfg = ((prim?.prepend?.[role] || []) as any[]).map(parseRoute).filter(Boolean) as Route[];
  const raw = prim?.listEnv ? String(process.env[prim.listEnv] || "").trim() : "";
  if (!raw || !fromCfg.length) return fromCfg; // roles without a prepend list are left alone
  const prov = prim.listProvider || fromCfg[0].provider;
  const fromEnv = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => parseRoute(s.includes(":") ? s : `${prov}:${s}`))
    .filter(Boolean) as Route[];
  return fromEnv.length ? fromEnv : fromCfg;
}

const isGemini = (r: Route) => r.provider === "google" && /^gemini/i.test(r.model);

/**
 * Insert one opt-in provider's routes into a role's chain:
 *  prepend      → tried first
 *  afterGemini  → right after the LAST Gemini route (first backup, e.g. Kimi K2.6 when Gemini's quota is used)
 *  afterAnchors → after the last Gemini route AND the last route of `anchorProviders` (slow free queues go
 *                 behind Mistral / SambaNova)
 *  append       → after everything
 */
export function placeOptIn(routes: Route[], role: string, o: any): Route[] {
  const list = (x: any) => ((x?.[role] || []) as any[]).map(parseRoute).filter(Boolean) as Route[];
  const pre = list(o.prepend), midG = list(o.afterGemini), midA = list(o.afterAnchors), post = list(o.append);
  // a one-setting switch that makes this provider the MAIN model for some roles (e.g. DESIGN_PRIMARY=nvidia-kimi)
  const prim = o.primary;
  if (primaryOn(prim)) pre.unshift(...primaryRoutes(prim, role));
  // anchors: provider ids ("mistral") or exact routes ("sambanova:DeepSeek-V3.1")
  const anchors: string[] = Array.isArray(o.anchorRoutes) ? o.anchorRoutes : Array.isArray(o.anchorProviders) ? o.anchorProviders : [];
  let cutG = -1, cutA = -1;
  routes.forEach((r, i) => {
    if (isGemini(r)) cutG = i;
    if (isGemini(r) || anchors.includes(r.provider) || anchors.includes(`${r.provider}:${r.model}`)) cutA = i;
  });
  if (cutA < cutG) cutA = cutG;
  return [...pre, ...routes.slice(0, cutG + 1), ...midG, ...routes.slice(cutG + 1, cutA + 1), ...midA, ...routes.slice(cutA + 1), ...post];
}

/**
 * Gemini aliases share their target's quota (ai.google.dev/gemini-api/docs/deprecations: "gemini-3.7-flash" is
 * served by gemini-3.8-flash, "gemini-3.5-flash" by gemini-3.6-flash). The scheduler counts an alias and its
 * target as ONE model (models.json → engineV3.aliases), so a used-up target also stops calls to its alias.
 */
export function quotaModel(provider: string, model: string): string {
  const a = cfg.engineV3?.aliases?.[`${provider}:${model}`];
  return typeof a === "string" && a ? a : model;
}

/** Drop "fast"-tier models from strong roles (design, art, vision). Light roles keep every route in config order. */
export function applyTierPolicy(role: Role, routes: Route[]): Route[] {
  if (!STRONG_ROLES.includes(role)) return routes;
  return routes.filter((r) => modelSpec(r.provider, r.model).tier !== "fast");
}

function productionOptedIn(provider: string): boolean {
  const o = (cfg.engineV3?.optInRoutes || {})[provider];
  return !!o?.env && process.env[o.env] === "true";
}

export function isBenchmarkOnly(provider: string): boolean {
  return !!providerCfg(provider)?.benchmarkOnly;
}

export function providerNote(provider: string): string | undefined {
  return providerCfg(provider)?.note;
}

/** Extra candidates offered only on the /benchmark page (models.json → engineV3.benchmarkCandidates). */
export function benchmarkCandidates(role: Role): Route[] {
  return ((cfg.engineV3?.benchmarkCandidates?.[role] || []) as any[]).map(parseRoute).filter(Boolean) as Route[];
}

/** a model the operator put in ENGINE_V3_ROUTES for the vision role is trusted to accept images */
function envVisionRoute(r: { provider: string; model: string }): boolean {
  try {
    const o = JSON.parse(process.env.ENGINE_V3_ROUTES || "{}");
    return (o.vision || []).map(parseRoute).some((x: any) => x && x.provider === r.provider && x.model === r.model);
  } catch {
    return false;
  }
}

export function modelSpec(provider: string, model: string): ModelSpec {
  const m = cfg.engineV3?.models?.[`${provider}:${model}`] || {};
  const p = providerCfg(provider);
  const envRpm = Number(process.env[`V3_LIMIT_${provider.toUpperCase()}_RPM`]);
  return { ...(p as any)?.defaultModelLimits, ...m, ...(envRpm ? { rpm: envRpm } : {}) };
}

// ── budgets ────────────────────────────────────────────────────────────────────
interface Window {
  t: number;
  tokens: number;
}
interface Bucket {
  minute: Window[]; // last 60 s
  day: Window[]; // last 24 h (or since reset)
  coolUntil: number; // short cool-down after 429/5xx
  exhaustedUntil: number; // daily quota gone / key invalid / model missing
  reason?: string;
}

declare global {
  var __v3Budgets: { buckets: Map<string, Bucket>; active: Map<string, number>; loaded: boolean; dirty: boolean; recent: CallStat[]; lastSuccessAt?: number } | undefined;
}
type ProviderHealth = { fails: number; lastAt: number; r429: { model: string; t: number }[] };
type BudgetState = { buckets: Map<string, Bucket>; active: Map<string, number>; loaded: boolean; dirty: boolean; recent: CallStat[]; lastSuccessAt?: number; health?: Map<string, ProviderHealth> };
const G: BudgetState = globalThis.__v3Budgets || (globalThis.__v3Budgets = { buckets: new Map(), active: new Map(), loaded: false, dirty: false, recent: [] as CallStat[] });
const QUOTA_FILE = path.join(DATA_ROOT, "llm-quota.json");

function loadBudgets() {
  if (G.loaded) return;
  G.loaded = true;
  try {
    const raw = JSON.parse(fs.readFileSync(QUOTA_FILE, "utf8"));
    const now = Date.now();
    for (const [k, v] of Object.entries<any>(raw)) {
      G.buckets.set(k, { minute: [], day: (v.day || []).filter((w: Window) => now - w.t < 86_400_000), coolUntil: 0, exhaustedUntil: v.exhaustedUntil > now ? v.exhaustedUntil : 0, reason: v.reason });
    }
  } catch {
    /* first run */
  }
}

let saveTimer: NodeJS.Timeout | null = null;
function saveBudgets() {
  G.dirty = true;
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    if (!G.dirty) return;
    G.dirty = false;
    const out: Record<string, any> = {};
    for (const [k, b] of G.buckets) out[k] = { day: b.day.slice(-3000), exhaustedUntil: b.exhaustedUntil, reason: b.reason };
    try {
      fs.mkdirSync(DATA_ROOT, { recursive: true });
      fs.writeFileSync(QUOTA_FILE, JSON.stringify(out));
    } catch (e) {
      console.warn("[v3/llm] could not save quota file", e);
    }
  }, 2000);
}

function bucket(key: string): Bucket {
  loadBudgets();
  let b = G.buckets.get(key);
  if (!b) {
    b = { minute: [], day: [], coolUntil: 0, exhaustedUntil: 0 };
    G.buckets.set(key, b);
  }
  const now = Date.now();
  b.minute = b.minute.filter((w) => now - w.t < 60_000);
  if (b.day.length && now - b.day[0].t >= 86_400_000) b.day = b.day.filter((w) => now - w.t < 86_400_000);
  return b;
}

function accountLimits(provider: string): Limits {
  const P = provider.toUpperCase();
  const l: Limits = { ...(providerCfg(provider)?.accountLimits || {}) };
  for (const f of ["rpm", "rpd", "tpm", "tpd"] as const) {
    const v = Number(process.env[`V3_ACCOUNT_${P}_${f.toUpperCase()}`]);
    if (v) l[f] = v;
  }
  return l;
}

function keyId(provider: string, keyIdx: number) {
  return `${provider}#${keyIdx}`;
}

/** ms until this key+model can take a request of ~tokens (0 = now, Infinity = not today). */
function waitFor(provider: string, keyIdx: number, model: string, tokensTotal: number, tokensIn: number): number {
  const now = Date.now();
  const spec = modelSpec(provider, model);
  const p = providerCfg(provider);
  // Gemini counts input tokens per minute; Groq counts input + requested output.
  const tokens = p?.tpmInputOnly ? tokensIn : tokensTotal;
  const checks: { b: Bucket; l: Limits }[] = [
    { b: bucket(`${keyId(provider, keyIdx)}|${quotaModel(provider, model)}`), l: spec },
    { b: bucket(`${keyId(provider, keyIdx)}|*`), l: accountLimits(provider) },
  ];
  let wait = 0;
  for (const { b, l } of checks) {
    if (b.exhaustedUntil > now) return Infinity;
    if (b.coolUntil > now) wait = Math.max(wait, b.coolUntil - now);
    if (l.rpd && b.day.length >= l.rpd) return Infinity;
    if (l.tpd && b.day.reduce((s, w) => s + w.tokens, 0) + tokens > l.tpd) return Infinity;
    if (l.minIntervalMs && b.minute.length) {
      const since = now - b.minute[b.minute.length - 1].t;
      if (since < l.minIntervalMs) wait = Math.max(wait, l.minIntervalMs - since);
    }
    if (l.rpm && b.minute.length >= l.rpm) wait = Math.max(wait, 60_000 - (now - b.minute[b.minute.length - l.rpm].t) + 100);
    if (l.tpm) {
      if (tokens > l.tpm) return Infinity; // this request alone is bigger than the per-minute budget
      let used = b.minute.reduce((s, w) => s + w.tokens, 0);
      if (used + tokens > l.tpm) {
        // wait until enough old tokens fall out of the window
        for (const w of b.minute) {
          used -= w.tokens;
          if (used + tokens <= l.tpm) {
            wait = Math.max(wait, 60_000 - (now - w.t) + 100);
            break;
          }
        }
      }
    }
  }
  const conc = p?.concurrency || cfg.engineV3?.concurrency?.[provider] || 3;
  if ((G.active.get(keyId(provider, keyIdx)) || 0) >= conc) wait = Math.max(wait, 1500);
  return wait;
}

function record(provider: string, keyIdx: number, model: string, tokens: number) {
  const now = Date.now();
  for (const k of [`${keyId(provider, keyIdx)}|${quotaModel(provider, model)}`, `${keyId(provider, keyIdx)}|*`]) {
    const b = bucket(k);
    b.minute.push({ t: now, tokens });
    b.day.push({ t: now, tokens });
  }
  saveBudgets();
}

function correctTokens(provider: string, keyIdx: number, model: string, estimated: number, actual: number) {
  for (const k of [`${keyId(provider, keyIdx)}|${quotaModel(provider, model)}`, `${keyId(provider, keyIdx)}|*`]) {
    const b = bucket(k);
    const w = [...b.minute].reverse().find((x) => x.tokens === estimated);
    if (w) w.tokens = actual;
    const d = [...b.day].reverse().find((x) => x.tokens === estimated);
    if (d) d.tokens = actual;
  }
}

function nextDailyReset(provider: string): number {
  const mode = providerCfg(provider)?.dailyReset || "rolling";
  const now = new Date();
  if (mode === "utc-midnight") return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) + 60_000;
  if (mode === "pacific-midnight") {
    // midnight America/Los_Angeles ≈ 07:00 or 08:00 UTC; take 08:05 UTC to be safe on both offsets
    const t = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 8, 5);
    return t > now.getTime() ? t : t + 86_400_000;
  }
  return Date.now() + 60 * 60_000; // unknown: re-probe in an hour
}

function parseDelaySeconds(msg: string, header?: string | null): number | null {
  if (header && /^\d+(\.\d+)?$/.test(header.trim())) return Number(header);
  const rd = msg.match(/retryDelay"?\s*[:=]\s*"?(\d+(?:\.\d+)?)s/i);
  if (rd) return Number(rd[1]);
  const ta = msg.match(/(?:try again|retry) in\s+(?:(\d+)h)?\s*(?:(\d+)m(?!s))?\s*(?:(\d+(?:\.\d+)?)s)?/i);
  if (ta && (ta[1] || ta[2] || ta[3])) return Number(ta[1] || 0) * 3600 + Number(ta[2] || 0) * 60 + Number(ta[3] || 0);
  const ra = msg.match(/retry[- ]after[^0-9]*(\d+)/i);
  if (ra) return Number(ra[1]);
  return null;
}

class HttpError extends Error {
  constructor(public status: number, message: string, public retryAfter: string | null) {
    super(message);
  }
}

// ── provider health (circuit breaker) ──────────────────────────────────────────
function health(provider: string): ProviderHealth {
  if (!G.health) G.health = new Map();
  let h = G.health.get(provider);
  if (!h) G.health.set(provider, (h = { fails: 0, lastAt: 0, r429: [] }));
  return h;
}
function breakerFails() {
  return Math.max(1, Number(process.env.V3_BREAKER_FAILS || 3));
}
function breakerMs() {
  return Math.max(0.1, Number(process.env.V3_BREAKER_MIN || 5)) * 60_000;
}
/** a success clears the provider's failure streak */
function markHealthy(provider: string) {
  const h = health(provider);
  h.fails = 0;
}
/** soft failure (timeout, 5xx, empty reply, bad request): N in a row (within 10 min) benches the whole provider */
function softFailure(provider: string, keyIdx: number, why: string) {
  const now = Date.now();
  const h = health(provider);
  if (now - h.lastAt > 10 * 60_000) h.fails = 0;
  h.fails++;
  h.lastAt = now;
  if (h.fails >= breakerFails()) {
    const acct = bucket(`${keyId(provider, keyIdx)}|*`);
    acct.coolUntil = Math.max(acct.coolUntil, now + breakerMs());
    acct.reason = `provider failing (${h.fails} errors in a row, last: ${why.slice(0, 80)})`;
    console.warn(`[v3/llm] ${provider}: ${h.fails} failures in a row — benched for ${Math.round(breakerMs() / 60000)} min`);
    h.fails = 0;
  }
}
/** 429 on two different models of one provider within a minute = an account-wide limit: cool the whole provider */
function provider429(provider: string, keyIdx: number, model: string, delaySec: number | null) {
  const now = Date.now();
  const h = health(provider);
  h.r429 = h.r429.filter((x) => now - x.t < 60_000);
  h.r429.push({ model, t: now });
  if (new Set(h.r429.map((x) => x.model)).size >= 2) {
    const acct = bucket(`${keyId(provider, keyIdx)}|*`);
    acct.coolUntil = Math.max(acct.coolUntil, now + Math.min(Math.max(delaySec ?? 30, 5), 600) * 1000);
    acct.reason = "rate limited (account-wide)";
  }
}

/** Remove anything that looks like an API key from text that may be logged or shown. */
export function redactSecrets(text: string, ...secrets: (string | undefined)[]): string {
  let t = String(text);
  for (const s of secrets) if (s && s.length >= 8) t = t.split(s).join("[key]");
  return t
    .replace(/Bearer\s+[A-Za-z0-9._\-]{8,}/gi, "Bearer [key]")
    .replace(/\b(nvapi-|gsk_|csk-|sk-or-v1-|sk-|ghp_|github_pat_|AIza)[A-Za-z0-9._\-]{8,}/g, "$1[key]");
}

/** Decide what a failure means for this key+model. Returns true if the same request may go elsewhere. */
function penalize(provider: string, keyIdx: number, model: string, e: any) {
  const now = Date.now();
  const status: number = e instanceof HttpError ? e.status : 0;
  const msg = String(e?.message || e);
  const b = bucket(`${keyId(provider, keyIdx)}|${quotaModel(provider, model)}`);
  const acct = bucket(`${keyId(provider, keyIdx)}|*`);
  if (status === 429 || /rate.?limit|quota|exhausted|too many requests/i.test(msg)) {
    const daily = /per.?day|PerDay|daily|RPD|TPD|requests per day|tokens per day|free-models-per-day|4006|neurons/i.test(msg);
    const delay = parseDelaySeconds(msg, e?.retryAfter);
    if (daily && (delay == null || delay > 600)) {
      const until = delay ? now + delay * 1000 : nextDailyReset(provider);
      const accountWide = /free-models-per-day|neurons|4006/i.test(msg);
      (accountWide ? acct : b).exhaustedUntil = until;
      (accountWide ? acct : b).reason = "daily quota used";
      saveBudgets();
    } else b.coolUntil = now + Math.min(Math.max(delay ?? 20, 2), 300) * 1000;
    // "experiencing high demand / overloaded" is the provider out of capacity, not our quota: it counts toward
    // the circuit breaker, so a provider that keeps saying it is benched for a few minutes instead of being
    // re-asked every 20 s by every slide (SambaNova did this ~40 times in one deck).
    if (!daily && /high demand|overloaded|over capacity|try again later/i.test(msg)) softFailure(provider, keyIdx, msg);
    // A quota error that names its model (Gemini: "Quota exceeded for metric … model: gemini-3.6-flash") is a
    // per-model limit: cool that model (Gemini aliases share one quota, so the named model too), never the
    // whole provider — benching all of Google for one model's per-minute limit once stalled a deck for 8 min.
    const named = msg.match(/\bmodel:\s*([A-Za-z0-9._\-/]+)/);
    if (named) {
      const nb = bucket(`${keyId(provider, keyIdx)}|${quotaModel(provider, named[1])}`);
      if (daily && (delay == null || delay > 600)) nb.exhaustedUntil = Math.max(nb.exhaustedUntil || 0, b.exhaustedUntil || 0);
      else nb.coolUntil = Math.max(nb.coolUntil || 0, b.coolUntil || 0);
      return;
    }
    provider429(provider, keyIdx, model, delay);
    return;
  }
  if (status === 401 || status === 403) {
    acct.exhaustedUntil = now + 6 * 3600_000;
    acct.reason = `key refused (${status})`;
    saveBudgets();
    return;
  }
  if (status === 404 || /model.*(not found|does not exist|decommissioned|deprecated)/i.test(msg)) {
    b.exhaustedUntil = now + 24 * 3600_000;
    b.reason = "model not available";
    saveBudgets();
    return;
  }
  if (status === 413 || /context length|too large|maximum context|reduce the length/i.test(msg)) return; // too big for this model only
  b.coolUntil = now + 30_000; // 5xx, timeouts, empty replies
  softFailure(provider, keyIdx, msg);
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export class NoCapacityError extends Error {}
/** A model answered, but the answer could not be used (cut off, no slide markup, not JSON). */
export class UnusableReplyError extends Error {}
const MAX_UNUSABLE = 4;
function safeValidate(v: (t: string) => boolean, text: string): boolean {
  try {
    return !!v(text);
  } catch {
    return false;
  }
}

export interface CallOpts {
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  timeoutMs?: number;
  /**
   * Checks that a reply is usable (e.g. it contains a complete slide or valid JSON). A reply that fails is
   * treated like a failed call on that model: the next route is tried, so one bad model never sinks a deck.
   */
  validate?: (text: string) => boolean;
  /** kept for compatibility (old round-robin start index) */
  spread?: number;
  label?: string;
  /** reasoning effort for reasoning models (gpt-oss): low | medium | high */
  reasoning?: "low" | "medium" | "high";
  /** stream tokens (default on; V3_STREAM=off disables) */
  stream?: boolean;
  /** engine v4: OpenAI-style function tools; the reply may then be tool calls instead of text (non-streamed) */
  tools?: any[];
  toolChoice?: "auto" | "required" | "none";
  /**
   * "revision" = a polish/fix pass on a slide that already has a first draft. When Gemini's daily quota runs
   * low, revisions start at the strong backups (Kimi, Mistral Large 4, DeepSeek, GLM) so the remaining Gemini
   * calls go to first drafts. Nothing is skipped: the same calls run, only the model order changes.
   */
  pass?: "draft" | "revision";
}

/** Gemini Flash (not Lite) requests still available today across the distinct models in this chain. */
export function geminiQuotaLeft(routes: Route[]): number {
  const now = Date.now();
  const seen = new Set<string>();
  let left = 0;
  for (const r of routes) {
    if (!isGemini(r) || /lite/i.test(r.model)) continue;
    const qm = quotaModel(r.provider, r.model);
    if (seen.has(qm)) continue;
    seen.add(qm);
    const keys = keysFor(r.provider);
    const rpd = modelSpec(r.provider, qm).rpd ?? modelSpec(r.provider, r.model).rpd ?? 20;
    keys.forEach((_, k) => {
      const b = bucket(`${keyId(r.provider, k)}|${qm}`);
      const a = bucket(`${keyId(r.provider, k)}|*`);
      if (b.exhaustedUntil > now || a.exhaustedUntil > now) return;
      left += Math.max(0, rpd - b.day.length);
    });
  }
  return left;
}

/**
 * Model order for a revision pass. V3_REVISION_ROUTE: "auto" (default) = Gemini first while more than
 * V3_GEMINI_DRAFT_RESERVE (default 30) Gemini Flash calls are left today, otherwise the strong backups first;
 * "backup-first" = always backups first; "gemini-first" = never reorder. Gemini stays in the chain either way.
 */
export function revisionRoutes(routes: Route[], mode = (process.env.V3_REVISION_ROUTE || "auto").toLowerCase()): Route[] {
  if (mode === "gemini-first" || mode === "off") return routes;
  if (mode !== "backup-first") {
    const reserve = Number(process.env.V3_GEMINI_DRAFT_RESERVE ?? 30);
    if (geminiQuotaLeft(routes) > reserve) return routes;
  }
  const backups = ((cfg.engineV3?.revisionBackups || []) as any[]).map(parseRoute).filter(Boolean) as Route[];
  const same = (a: Route, b: Route) => a.provider === b.provider && a.model === b.model;
  const first = backups.map((b) => routes.find((r) => same(r, b))).filter(Boolean) as Route[];
  if (!first.length) return routes;
  const firstGemini = routes.findIndex(isGemini);
  const rest = routes.filter((r) => !first.some((f) => same(f, r)));
  // backups go where the first Gemini route was; Gemini follows them, everything weaker stays behind
  const at = firstGemini < 0 ? 0 : rest.findIndex(isGemini);
  return at < 0 ? [...first, ...rest] : [...rest.slice(0, at), ...first, ...rest.slice(at)];
}

function estimateTokens(messages: Msg[]): number {
  let chars = 0,
    images = 0;
  for (const m of messages) {
    if (typeof m.content === "string") chars += m.content.length;
    else if (Array.isArray(m.content)) for (const p of m.content) p.type === "text" ? (chars += p.text.length) : images++;
    if (m.tool_calls) chars += JSON.stringify(m.tool_calls).length;
  }
  return Math.ceil(chars / 3.3) + images * 1300 + 20 * messages.length;
}

const ROLE_WAIT_MS: Record<Role, number> = { brief: 2000, research: 4000, outline: 6000, plan: 4000, art: 15000, design: 20000, vision: 8000, planner: 20000, agent: 20000 };

/**
 * Call the best available route for a role. Never throws because of rate limits unless no route at
 * all has capacity for V3_MAX_CAPACITY_WAIT_MIN minutes.
 */
export async function chat(role: Role, messages: Msg[], opts: CallOpts = {}): Promise<LlmResult> {
  const hasImage = messages.some((m) => Array.isArray(m.content) && m.content.some((p) => p.type === "image_url"));
  let routes = routesFor(role);
  if (opts.pass === "revision" && (role === "design" || role === "art")) routes = revisionRoutes(routes);
  if (hasImage) routes = routes.filter((r) => modelSpec(r.provider, r.model).vision || envVisionRoute(r));
  if (!routes.length) {
    throw new Error(
      `Engine v3: no configured provider for role "${role}". Add at least one key to the server env (GOOGLE_AI_API_KEY, GROQ_API_KEY, MISTRAL_API_KEY, SAMBANOVA_API_KEY, OPENROUTER_API_KEY or CLOUDFLARE_API_TOKEN+CLOUDFLARE_ACCOUNT_ID).`
    );
  }
  const ctx = llmContext.getStore();
  const inTokens = estimateTokens(messages);
  const maxWaitTotal = Number(process.env.V3_MAX_CAPACITY_WAIT_MIN || 20) * 60_000;
  const tStart = Date.now();
  const errors: string[] = [];
  const triedThisRequest = new Set<string>(); // key+model pairs that failed for THIS request (non-429)
  let lastWaitNote = 0;
  let unusable = 0;

  for (;;) {
    // a request whose replies keep failing the usability check on every model is given up after a few tries
    if (unusable >= MAX_UNUSABLE) throw new Error(`no usable reply for ${role}${opts.label ? ` (${opts.label})` : ""} after ${unusable} tries:\n${errors.slice(-4).join("\n")}`);
    // Walk routes in priority order. Take the first key+model that is free now, unless a better route
    // frees up within its tolerance (then wait for it — quality first, but never long).
    type Cand = { r: Route; k: number; key: string; wait: number; out: number };
    let best: Cand | null = null;
    let soonest: Cand | null = null;
        outer: for (let ri = 0; ri < routes.length; ri++) {
      const r = routes[ri];
      const spec = modelSpec(r.provider, r.model);
      const out = Math.min(opts.maxTokens ?? 4000, spec.maxOutput ?? 16000);
      if (spec.ctx && inTokens + out > spec.ctx) continue;
      const keys = keysFor(r.provider);
      const tolerance = r.waitMs ?? (ri === 0 ? ROLE_WAIT_MS[role] : Math.round(ROLE_WAIT_MS[role] / 3));
      let routeBest: Cand | null = null;
      for (let k = 0; k < keys.length; k++) {
        if (triedThisRequest.has(`${keyId(r.provider, k)}|${r.model}`)) continue;
        const w = waitFor(r.provider, k, r.model, inTokens + out, inTokens);
        if (w === Infinity) continue;
        const c = { r, k, key: keys[k], wait: w, out };
        if (!routeBest || w < routeBest.wait) routeBest = c;
        if (!soonest || w < soonest.wait) soonest = c;
      }
      if (routeBest && routeBest.wait <= tolerance) {
        best = routeBest;
        break outer;
      }
    }
    if (!best && soonest) best = soonest;

    if (!best) {
      // give up only after maxWaitTotal with NO successful AI call anywhere in this server (a busy-but-working
      // free tier — e.g. Gemma answering 500 half the time — must slow a deck down, not kill it after 50 minutes)
      if (Date.now() - Math.max(tStart, G.lastSuccessAt || 0) > maxWaitTotal) {
        throw new NoCapacityError(`No AI capacity for ${role}${opts.label ? ` (${opts.label})` : ""} right now:\n${errors.slice(-6).join("\n")}`);
      }
      if (triedThisRequest.size) triedThisRequest.clear(); // everything failed once: allow retries after a pause
      if (Date.now() - lastWaitNote > 20_000) {
        ctx?.onWait?.("Waiting for free AI capacity — your deck continues automatically");
        lastWaitNote = Date.now();
      }
      await sleep(15_000);
      continue;
    }
    if (best.wait > 0) {
      if (best.wait > 8000 && Date.now() - lastWaitNote > 20_000) {
        ctx?.onWait?.("High demand on the free AI models — slowing down a little");
        lastWaitNote = Date.now();
      }
      await sleep(Math.min(best.wait, 10_000));
      continue; // re-evaluate: something better may be free now
    }

    const { r, k, key, out } = best;
    const kid = keyId(r.provider, k);
    const est = inTokens + out;
    G.active.set(kid, (G.active.get(kid) || 0) + 1);
    const recTokens = providerCfg(r.provider)?.tpmInputOnly ? inTokens : est;
    record(r.provider, k, r.model, recTokens);
    const t0 = Date.now();
    try {
      const res = await callOnce(r, key, messages, { ...opts, maxTokens: out });
      if (opts.validate && !res.toolCalls?.length && !safeValidate(opts.validate, res.text)) {
        unusable++;
        throw new UnusableReplyError(`unusable reply (${res.text.length} chars, failed the ${role} check)`);
      }
      G.lastSuccessAt = Date.now();
      markHealthy(r.provider);
      if (res.usage && !providerCfg(r.provider)?.tpmInputOnly) correctTokens(r.provider, k, r.model, est, res.usage);
      const stat: CallStat = { role, provider: r.provider, model: r.model, ms: Date.now() - t0, waitedMs: t0 - tStart, ok: true, tokensIn: inTokens, tokensOut: res.usage ? res.usage - inTokens : undefined, at: new Date().toISOString() };
      ctx?.stats?.push(stat);
      pushRecent(stat);
      return { text: res.text, provider: r.provider, model: r.model, ms: Date.now() - t0, waitedMs: t0 - tStart, toolCalls: res.toolCalls, finishReason: res.finishReason };
    } catch (e: any) {
      const msg = redactSecrets(String(e?.message || e), key);
      // status code + provider's error body (never the key) in the server log, so host logs show WHY a route fails
      console.warn(`[v3/llm] ${role}${opts.label ? ` (${opts.label})` : ""} ${r.provider}/${r.model} failed after ${((Date.now() - t0) / 1000).toFixed(1)}s: ${msg.slice(0, 500)}`);
      errors.push(`${r.provider}/${r.model}: ${msg.slice(0, 220)}`);
      if (!(e instanceof UnusableReplyError)) penalize(r.provider, k, r.model, e);
      if (!(e instanceof HttpError && e.status === 429)) triedThisRequest.add(`${kid}|${r.model}`);
      const stat: CallStat = { role, provider: r.provider, model: r.model, ms: Date.now() - t0, waitedMs: t0 - tStart, ok: false, error: msg.slice(0, 200), at: new Date().toISOString() };
      ctx?.stats?.push(stat);
      pushRecent(stat);
    } finally {
      G.active.set(kid, Math.max(0, (G.active.get(kid) || 1) - 1));
    }
  }
}

/** Tests only: forget every budget, cooldown and provider-health record (no disk read). */
export function resetSchedulerForTests() {
  G.buckets.clear();
  G.active.clear();
  G.health?.clear();
  G.recent.length = 0;
  G.loaded = true;
  G.lastSuccessAt = undefined;
}

function pushRecent(s: CallStat) {
  G.recent.push(s);
  if (G.recent.length > 500) G.recent.splice(0, G.recent.length - 500);
}

/** Live scheduler state (for /benchmark and debugging). */
export function schedulerState() {
  loadBudgets();
  const now = Date.now();
  const rows: any[] = [];
  for (const role of ROLES)
    for (const r of routesFor(role, { all: true })) {
      const keys = keysFor(r.provider);
      const spec = modelSpec(r.provider, r.model);
      const per = keys.map((_, k) => {
        const b = bucket(`${keyId(r.provider, k)}|${quotaModel(r.provider, r.model)}`);
        const a = bucket(`${keyId(r.provider, k)}|*`);
        return { key: k + 1, usedToday: b.day.length, usedThisMinute: b.minute.length, exhausted: Math.max(b.exhaustedUntil, a.exhaustedUntil) > now ? b.reason || a.reason : null };
      });
      rows.push({ role, provider: r.provider, model: r.model, configured: keys.length > 0, limits: { rpm: spec.rpm, rpd: spec.rpd, tpm: spec.tpm }, keys: per });
    }
  return { rows, recent: G.recent.slice(-60) };
}

async function callOnce(route: Route, apiKey: string, messages: Msg[], opts: CallOpts): Promise<{ text: string; usage?: number; toolCalls?: ToolCall[]; finishReason?: string }> {
  const baseUrl = baseUrlFor(route.provider)!;
  const body: any = {
    model: route.model,
    messages,
    temperature: opts.temperature ?? 0.6,
    max_tokens: Math.min(opts.maxTokens ?? 4000, modelSpec(route.provider, route.model).maxOutput ?? Number.MAX_SAFE_INTEGER),
  };
  const stream = opts.tools?.length ? false : opts.stream ?? process.env.V3_STREAM !== "off";
  if (opts.tools?.length) {
    body.tools = opts.tools;
    body.tool_choice = opts.toolChoice || "auto";
    if (route.provider !== "google") body.parallel_tool_calls = true;
  }
  if (stream) {
    body.stream = true;
    body.stream_options = { include_usage: true };
  }
  const spec = modelSpec(route.provider, route.model);
  if (spec.reasoningEffort) body.reasoning_effort = spec.reasoningEffort;
  else if (spec.reasoning) body.reasoning_effort = opts.reasoning || process.env.V3_REASONING_EFFORT || "low";
  if (opts.json && route.provider !== "cloudflare" && !modelSpec(route.provider, route.model).noJsonMode) body.response_format = { type: "json_object" };
  if (spec.extraBody) Object.assign(body, spec.extraBody);

  const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` };
  if (route.provider === "openrouter") {
    headers["HTTP-Referer"] = process.env.PUBLIC_SITE_URL || "https://deckcraft.app";
    headers["X-Title"] = "DeckCraft AI";
  }
  const pcfg = providerCfg(route.provider);
  const totalMs = Math.min(opts.timeoutMs ?? 150_000, spec.timeoutMs ?? Infinity, pcfg?.timeoutMs ?? Infinity);
  const firstByteMs = stream ? pcfg?.firstByteMs : undefined; // only where configured (Gemini may think before its first byte)
  const idleMs = stream ? pcfg?.idleMs : undefined;
  const ctrl = new AbortController();
  let abortReason = "";
  const abort = (why: string) => {
    if (!abortReason) abortReason = why;
    ctrl.abort();
  };
  const timer = setTimeout(() => abort(`timeout: no complete reply within ${Math.round(totalMs / 1000)}s`), totalMs);
  let fbTimer: NodeJS.Timeout | null = null;
  let idleTimer: NodeJS.Timeout | null = null;
  const armIdle = () => {
    if (!idleMs) return;
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => abort(`timeout: stream stalled (nothing for ${Math.round(idleMs / 1000)}s)`), idleMs);
  };
  const post = async () => {
    if (firstByteMs) fbTimer = setTimeout(() => abort(`timeout: no first byte within ${Math.round(firstByteMs / 1000)}s`), firstByteMs);
    try {
      return await fetch(`${baseUrl}/chat/completions`, { method: "POST", headers, body: JSON.stringify(body), signal: ctrl.signal });
    } finally {
      if (fbTimer) clearTimeout(fbTimer);
      fbTimer = null;
    }
  };
  try {
    let res = await post();
    if (!res.ok && res.status >= 500 && body.response_format) {
      // some models fail outright in json mode — retry once without it (JSON is still parsed from the text)
      delete body.response_format;
      res = await post();
    }
    if (!res.ok && res.status === 400 && (body.response_format || body.stream_options)) {
      // some models/providers reject json mode or stream_options — retry once without them
      const t = await res.text();
      if (/response_format|json|stream_options/i.test(t)) {
        delete body.response_format;
        delete body.stream_options;
        res = await post();
      } else throw new HttpError(400, `HTTP 400: ${t.slice(0, 300)}`, null);
    }
    if (!res.ok) {
      const t = await res.text();
      const ra = res.headers.get("retry-after");
      throw new HttpError(res.status, `HTTP ${res.status}${ra ? ` retry-after ${ra}` : ""}: ${t.slice(0, 600)}`, ra);
    }
    if (stream && (res.headers.get("content-type") || "").includes("text/event-stream") && res.body) {
      let text = "",
        finish = "",
        buf = "",
        reasoningChars = 0,
        usage: number | undefined;
      armIdle();
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        armIdle();
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]") continue;
          try {
            const j = JSON.parse(data);
            if (j.error) throw new HttpError(Number(j.error.code) || 500, `stream error: ${JSON.stringify(j.error).slice(0, 300)}`, null);
            const c = j.choices?.[0];
            if (c?.delta?.content) text += typeof c.delta.content === "string" ? c.delta.content : asText(c.delta.content);
            else if (c?.delta?.reasoning_content || c?.delta?.reasoning) reasoningChars += String(c.delta.reasoning_content || c.delta.reasoning).length;
            else if (typeof j.response === "string") text += j.response; // Cloudflare native stream shape
            else if (j.response && typeof j.response === "object") text += JSON.stringify(j.response); // Cloudflare JSON mode
            if (c?.finish_reason) finish = c.finish_reason;
            if (j.usage?.total_tokens) usage = j.usage.total_tokens;
          } catch (err) {
            if (err instanceof HttpError) throw err;
          }
        }
      }
      if (!text.trim())
        throw new Error(reasoningChars ? `empty completion: the model spent its whole budget thinking (finish_reason=${finish || "unknown"})` : `empty completion (finish_reason=${finish || "unknown"})`);
      return { text, usage };
    }
    const json: any = await res.json();
    const choice = json.choices?.[0];
    if (opts.tools?.length) {
      // tool loop: a reply is tool calls and/or text; both may be present
      const tcs: ToolCall[] = (choice?.message?.tool_calls || []).filter((t: any) => t?.function?.name).map((t: any, i: number) => ({ ...t, id: t.id || `call_${Date.now().toString(36)}_${i}`, type: "function", function: { name: String(t.function.name), arguments: typeof t.function.arguments === "string" ? t.function.arguments : JSON.stringify(t.function.arguments ?? {}) } }));
      const txt = asText(choice?.message?.content ?? "");
      if (!tcs.length && !txt.trim()) throw new Error(`empty completion (finish_reason=${choice?.finish_reason})`);
      return { text: txt, usage: json.usage?.total_tokens, toolCalls: tcs, finishReason: choice?.finish_reason };
    }
    let text: any = choice?.message?.content ?? json.result?.response ?? "";
    text = asText(text);
    if (!text || !String(text).trim())
      throw new Error(choice?.message?.reasoning_content || choice?.message?.reasoning ? `empty completion: the model spent its whole budget thinking (finish_reason=${choice?.finish_reason})` : `empty completion (finish_reason=${choice?.finish_reason})`);
    return { text: String(text), usage: json.usage?.total_tokens };
  } catch (e) {
    if (abortReason) throw new HttpError(0, abortReason, null);
    throw e;
  } finally {
    clearTimeout(timer);
    if (fbTimer) clearTimeout(fbTimer);
    if (idleTimer) clearTimeout(idleTimer);
  }
}

/**
 * A reply's content as text. Some providers (Cloudflare JSON mode) hand back an already-parsed object, and
 * String(object) would be "[object Object]" — which once failed whole decks.
 */
export function asText(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map((p: any) => (typeof p === "string" ? p : p?.text ?? (p && typeof p === "object" && !p.type ? JSON.stringify(p) : ""))).join("");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** Extract the first JSON object/array from a model reply. */
export function extractJson<T = any>(text: string): T {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.search(/[\[{]/);
  if (start < 0) throw new Error("no JSON in reply");
  const open = t[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0,
    inStr = false,
    esc = false,
    end = -1;
  for (let i = start; i < t.length; i++) {
    const ch = t[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  let candidate = end > 0 ? t.slice(start, end + 1) : t.slice(start);
  try {
    return JSON.parse(candidate);
  } catch {
    candidate = candidate.replace(/,\s*([}\]])/g, "$1").replace(/[\u201c\u201d]/g, '"');
    return JSON.parse(candidate);
  }
}

/** chat() + JSON parse with one corrective retry. */
export async function chatJson<T = any>(role: Role, messages: Msg[], opts: CallOpts = {}): Promise<{ data: T; meta: LlmResult }> {
  const isJson = (t: string) => {
    extractJson(t);
    return true;
  };
  const first = await chat(role, messages, { ...opts, json: true, validate: opts.validate || isJson });
  try {
    return { data: extractJson<T>(first.text), meta: first };
  } catch {
    const retry = await chat(
      role,
      [...messages, { role: "assistant", content: first.text.slice(0, 6000) }, { role: "user", content: "That was not valid JSON. Reply again with ONLY the JSON object, no prose, no code fences." }],
      { ...opts, json: true, temperature: 0.2 }
    );
    return { data: extractJson<T>(retry.text), meta: retry };
  }
}


// ── per-deck usage + cost (prices per 1M tokens from models.json → engineV3.models[...].price) ──
export interface UsageRow { route: string; calls: number; failed: number; tokensIn: number; tokensOut: number; cost: number | null }
export interface UsageSummary { rows: UsageRow[]; calls: number; failed: number; tokensIn: number; tokensOut: number; cost: number; currency: "USD"; costKnown: boolean }

export function usageSummary(calls: { provider: string; model: string; ok: boolean; tokensIn?: number; tokensOut?: number }[]): UsageSummary {
  const m = new Map<string, UsageRow>();
  for (const c of calls) {
    const key = `${c.provider}:${c.model}`;
    const r = m.get(key) || { route: key, calls: 0, failed: 0, tokensIn: 0, tokensOut: 0, cost: 0 };
    r.calls++;
    if (!c.ok) r.failed++;
    if (c.ok) {
      r.tokensIn += c.tokensIn || 0;
      r.tokensOut += Math.max(0, c.tokensOut || 0);
    }
    m.set(key, r);
  }
  let costKnown = true;
  for (const r of m.values()) {
    const price = cfg.engineV3?.models?.[r.route]?.price as { in: number; out: number } | undefined;
    const free = /:free$/.test(r.route) || ["google", "groq", "cloudflare", "nvidia"].includes(r.route.split(":")[0]);
    if (price) r.cost = (r.tokensIn * price.in + r.tokensOut * price.out) / 1e6;
    else if (free) r.cost = 0;
    else {
      r.cost = null;
      costKnown = false;
    }
  }
  const rows = [...m.values()].sort((a, b) => b.calls - a.calls);
  return {
    rows,
    calls: rows.reduce((s, r) => s + r.calls, 0),
    failed: rows.reduce((s, r) => s + r.failed, 0),
    tokensIn: rows.reduce((s, r) => s + r.tokensIn, 0),
    tokensOut: rows.reduce((s, r) => s + r.tokensOut, 0),
    cost: rows.reduce((s, r) => s + (r.cost || 0), 0),
    currency: "USD",
    costKnown,
  };
}

export function usageLine(u: UsageSummary): string {
  const k = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));
  const parts = u.rows.map((r) => `${r.route} ${r.calls} calls${r.failed ? ` (${r.failed} failed)` : ""} ${k(r.tokensIn)} in/${k(r.tokensOut)} out${r.cost ? ` ~$${r.cost.toFixed(3)}` : r.cost === 0 ? " free" : " price?"}`);
  return `${u.calls} AI calls, ${k(u.tokensIn)} in / ${k(u.tokensOut)} out tokens, paid cost ~$${u.cost.toFixed(3)}${u.costKnown ? "" : " (+ routes without a price)"} — ${parts.join(" | ")}`;
}
