/**
 * Engine v3 — LLM provider pool.
 *
 * - Role-based routes with fallbacks (src/config/models.json → engineV3.roles)
 * - Per-provider rate limiter: requests/minute + max concurrency + cool-down after 429
 * - OpenAI-compatible chat API for every provider (Gemini, Groq, OpenRouter, Cloudflare, custom)
 * - Vision messages (image_url data URIs)
 * - Robust JSON extraction for models that wrap JSON in prose / code fences
 *
 * Runtime overrides (no code change needed):
 *   ENGINE_V3_ROUTES='{"design":[{"provider":"groq","model":"openai/gpt-oss-120b"}]}'
 *   GOOGLE_AI_BASE_URL / GROQ_BASE_URL / OPENROUTER_BASE_URL / CLOUDFLARE_BASE_URL
 *   CUSTOM_LLM_BASE_URL + CUSTOM_LLM_API_KEY  (any OpenAI-compatible provider, route provider "custom")
 */
import modelsConfig from "@/config/models.json";

export type Role = "brief" | "research" | "outline" | "art" | "design" | "vision";

export interface Route {
  provider: string;
  model: string;
}

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface Msg {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

export interface LlmResult {
  text: string;
  provider: string;
  model: string;
  ms: number;
}

interface ProviderCfg {
  name: string;
  baseUrl: string;
  baseUrlEnv?: string;
  apiKeyEnv: string;
  accountIdEnv?: string;
  enabled: boolean;
  limits?: { rpm?: number };
}

const ENV_BASE: Record<string, string> = {
  google: "GOOGLE_AI_BASE_URL",
  groq: "GROQ_BASE_URL",
  openrouter: "OPENROUTER_BASE_URL",
  cloudflare: "CLOUDFLARE_BASE_URL",
  nvidia: "NVIDIA_NIM_BASE_URL",
};

const cfg = modelsConfig as any;

function providerCfg(id: string): ProviderCfg | null {
  return (cfg.providers?.[id] as ProviderCfg) || null;
}

function resolveProvider(id: string): { baseUrl: string; apiKey: string } | null {
  const p = providerCfg(id);
  if (!p || p.enabled === false) return null;
  const apiKey = process.env[p.apiKeyEnv] || "";
  if (!apiKey) return null;
  let baseUrl = (p.baseUrlEnv && process.env[p.baseUrlEnv]) || process.env[ENV_BASE[id] || ""] || p.baseUrl;
  if (!baseUrl) return null;
  if (baseUrl.includes("{account_id}")) {
    const acc = process.env[p.accountIdEnv || "CLOUDFLARE_ACCOUNT_ID"];
    if (!acc) return null;
    baseUrl = baseUrl.replace("{account_id}", acc);
  }
  return { baseUrl: baseUrl.replace(/\/$/, ""), apiKey };
}

export function routesFor(role: Role): Route[] {
  let routes: Route[] = cfg.engineV3?.roles?.[role] || [];
  const override = process.env.ENGINE_V3_ROUTES;
  if (override) {
    try {
      const o = JSON.parse(override);
      if (o[role]) routes = o[role];
      else if (o["*"]) routes = o["*"];
    } catch {
      console.warn("[v3/llm] ENGINE_V3_ROUTES is not valid JSON — ignored");
    }
  }
  return routes.filter((r) => resolveProvider(r.provider));
}

export function availableProviders(): string[] {
  return Object.keys(cfg.providers || {}).filter((id) => resolveProvider(id));
}

// ── Rate limiter per provider ────────────────────────────────────────────
class Limiter {
  private stamps: number[] = [];
  private active = 0;
  private queue: (() => void)[] = [];
  coolUntil = 0;
  constructor(public rpm: number, public concurrency: number) {}

  async acquire(): Promise<void> {
    for (;;) {
      const now = Date.now();
      this.stamps = this.stamps.filter((t) => now - t < 60_000);
      if (now >= this.coolUntil && this.active < this.concurrency && this.stamps.length < this.rpm) {
        this.active++;
        this.stamps.push(now);
        return;
      }
      const waitRpm = this.stamps.length >= this.rpm ? 60_000 - (now - this.stamps[0]) + 50 : 0;
      const waitCool = Math.max(0, this.coolUntil - now);
      const wait = Math.max(waitRpm, waitCool);
      if (wait > 0) await sleep(Math.min(wait, 5000));
      else await new Promise<void>((res) => this.queue.push(res));
    }
  }
  release() {
    this.active = Math.max(0, this.active - 1);
    const next = this.queue.shift();
    if (next) next();
  }
  /** queue pressure, used to prefer idle providers */
  load(): number {
    return this.active / this.concurrency + (Date.now() < this.coolUntil ? 10 : 0);
  }
}

const limiters = new Map<string, Limiter>();
function limiter(provider: string): Limiter {
  let l = limiters.get(provider);
  if (!l) {
    const p = providerCfg(provider);
    const rpm = Number(process.env[`V3_RPM_${provider.toUpperCase()}`]) || p?.limits?.rpm || 20;
    const conc = Number(process.env[`V3_CONCURRENCY_${provider.toUpperCase()}`]) || cfg.engineV3?.concurrency?.[provider] || 3;
    l = new Limiter(rpm, conc);
    limiters.set(provider, l);
  }
  return l;
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export interface CallOpts {
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  timeoutMs?: number;
  /** route index to start from (spreads parallel designer calls over providers) */
  spread?: number;
  label?: string;
  /** reasoning effort for reasoning models (gpt-oss): low | medium | high */
  reasoning?: "low" | "medium" | "high";
  /** stream tokens (default on; V3_STREAM=off disables) */
  stream?: boolean;
}

/** Call the first healthy route for a role, failing over on errors. */
export async function chat(role: Role, messages: Msg[], opts: CallOpts = {}): Promise<LlmResult> {
  let routes = routesFor(role);
  if (!routes.length) {
    throw new Error(
      `Engine v3: no configured provider for role "${role}". Add at least one key to .env (GROQ_API_KEY, GOOGLE_AI_API_KEY, OPENROUTER_API_KEY or CLOUDFLARE_API_TOKEN+CLOUDFLARE_ACCOUNT_ID).`
    );
  }
  // Prefer providers that are not cooling down / overloaded, keep config order otherwise.
  routes = [...routes].sort((a, b) => {
    const la = limiter(a.provider).load() >= 10 ? 1 : 0;
    const lb = limiter(b.provider).load() >= 10 ? 1 : 0;
    return la - lb;
  });
  const errors: string[] = [];
  for (let attempt = 0; attempt < routes.length * 2; attempt++) {
    const route = routes[attempt % routes.length];
    const lim = limiter(route.provider);
    await lim.acquire();
    const t0 = Date.now();
    try {
      const text = await callOnce(route, messages, opts);
      return { text, provider: route.provider, model: route.model, ms: Date.now() - t0 };
    } catch (e: any) {
      const msg = String(e?.message || e);
      errors.push(`${route.provider}/${route.model}: ${msg.slice(0, 200)}`);
      if (/\b429\b|rate|quota|exceeded/i.test(msg)) {
        const retryAfter = Number((msg.match(/retry[- ]after[^0-9]*(\d+)/i) || [])[1]) || 20;
        lim.coolUntil = Date.now() + Math.min(retryAfter, 90) * 1000;
      }
      if (attempt >= routes.length - 1) await sleep(1500);
    } finally {
      lim.release();
    }
  }
  throw new Error(`All providers failed for ${role}${opts.label ? ` (${opts.label})` : ""}:\n${errors.join("\n")}`);
}

async function callOnce(route: Route, messages: Msg[], opts: CallOpts): Promise<string> {
  const prov = resolveProvider(route.provider)!;
  const body: any = {
    model: route.model,
    messages,
    temperature: opts.temperature ?? 0.6,
    max_tokens: opts.maxTokens ?? 4000,
  };
  // Streaming keeps long generations alive through proxies / gateways that time out on a silent connection.
  const stream = opts.stream ?? process.env.V3_STREAM !== "off";
  if (stream) body.stream = true;
  if (/gpt-oss/i.test(route.model)) body.reasoning_effort = opts.reasoning || process.env.V3_REASONING_EFFORT || "low";
  if (opts.json && route.provider !== "cloudflare") body.response_format = { type: "json_object" };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${prov.apiKey}`,
  };
  if (route.provider === "openrouter") {
    headers["HTTP-Referer"] = "https://deckcraft.app";
    headers["X-Title"] = "DeckCraft AI";
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 150_000);
  try {
    let res = await fetch(`${prov.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok && res.status === 400 && body.response_format) {
      // Some models reject json mode — retry once without it.
      delete body.response_format;
      res = await fetch(`${prov.baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
    }
    if (!res.ok) {
      const t = await res.text();
      const ra = res.headers.get("retry-after");
      throw new Error(`HTTP ${res.status}${ra ? ` retry-after ${ra}` : ""}: ${t.slice(0, 300)}`);
    }
    if (stream && (res.headers.get("content-type") || "").includes("text/event-stream") && res.body) {
      let text = "", finish = "", buf = "";
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
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
            const c = j.choices?.[0];
            if (c?.delta?.content) text += c.delta.content;
            else if (typeof j.response === "string") text += j.response; // Cloudflare native stream shape
            if (c?.finish_reason) finish = c.finish_reason;
          } catch {
            /* partial line */
          }
        }
      }
      if (!text.trim()) throw new Error(`empty completion (finish_reason=${finish || "unknown"})`);
      return text;
    }
    const json: any = await res.json();
    const choice = json.choices?.[0];
    let text: string = choice?.message?.content ?? json.result?.response ?? "";
    if (Array.isArray(text)) text = (text as any[]).map((p) => p.text || "").join("");
    if (!text || !String(text).trim()) throw new Error(`empty completion (finish_reason=${choice?.finish_reason})`);
    return String(text);
  } finally {
    clearTimeout(timer);
  }
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
    // light repair: trailing commas, smart quotes
    candidate = candidate.replace(/,\s*([}\]])/g, "$1").replace(/[\u201c\u201d]/g, '"');
    return JSON.parse(candidate);
  }
}

/** chat() + JSON parse with one corrective retry. */
export async function chatJson<T = any>(role: Role, messages: Msg[], opts: CallOpts = {}): Promise<{ data: T; meta: LlmResult }> {
  const first = await chat(role, messages, { ...opts, json: true });
  try {
    return { data: extractJson<T>(first.text), meta: first };
  } catch {
    const retry = await chat(
      role,
      [
        ...messages,
        { role: "assistant", content: first.text.slice(0, 6000) },
        { role: "user", content: "That was not valid JSON. Reply again with ONLY the JSON object, no prose, no code fences." },
      ],
      { ...opts, json: true, temperature: 0.2 }
    );
    return { data: extractJson<T>(retry.text), meta: retry };
  }
}
