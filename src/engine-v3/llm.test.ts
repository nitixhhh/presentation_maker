/**
 * Router unit tests (no network): run with `npm test`.
 * fetch is mocked; provider keys are fake strings set per test.
 */
import { test as nodeTest, before, beforeEach } from "node:test";
const test = (name: string, fn: () => unknown) => nodeTest(name, { timeout: 15_000 }, fn as any);
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PROVIDER_ENVS = [
  "CEREBRAS_API_KEY", "GOOGLE_AI_API_KEY", "GROQ_API_KEY", "GROQ_API_KEY_2", "GROQ_API_KEYS", "MISTRAL_API_KEY", "SAMBANOVA_API_KEY",
  "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "GITHUB_MODELS_TOKEN", "OPENROUTER_API_KEY", "NVIDIA_NIM_API_KEY", "OLLAMA_API_KEY",
  "CUSTOM_LLM_API_KEY", "CUSTOM_LLM_BASE_URL", "ALLOW_NVIDIA_PRODUCTION", "ENGINE_V3_ROUTES", "OLLAMA_PRIORITY",
  "ZAI_API_KEY", "DESIGN_PRIMARY", "V3_REVISION_ROUTE", "V3_GEMINI_DRAFT_RESERVE",
];

type Llm = typeof import("./llm");
let llm: Llm;
const realFetch = globalThis.fetch;

before(async () => {
  process.env.DECKCRAFT_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "dc-llm-test-"));
  llm = await import("./llm");
});

beforeEach(() => {
  for (const k of PROVIDER_ENVS) delete process.env[k];
  globalThis.fetch = realFetch;
  llm.resetSchedulerForTests();
});

function setKeys(...envs: string[]) {
  for (const e of envs) process.env[e] = e === "CLOUDFLARE_ACCOUNT_ID" ? "acc123" : `test-${e.toLowerCase()}-0123456789`;
}

const ALL = ["GOOGLE_AI_API_KEY", "GROQ_API_KEY", "MISTRAL_API_KEY", "SAMBANOVA_API_KEY", "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "GITHUB_MODELS_TOKEN", "OPENROUTER_API_KEY", "NVIDIA_NIM_API_KEY"];

function okReply(text = '{"ok":true}') {
  return new Response(JSON.stringify({ choices: [{ message: { content: text }, finish_reason: "stop" }], usage: { total_tokens: 10 } }), { status: 200, headers: { "content-type": "application/json" } });
}

/** route fetches by provider host; records which hosts were called */
function mockFetch(handlers: Record<string, (init: RequestInit) => Response | Promise<Response>>) {
  const calls: string[] = [];
  globalThis.fetch = (async (url: any, init: any) => {
    const u = String(url);
    const host = Object.keys(handlers).find((h) => u.includes(h));
    calls.push(host || u);
    if (!host) throw new Error(`unexpected fetch ${u}`);
    return handlers[host](init);
  }) as typeof fetch;
  return calls;
}

const msgs = [{ role: "user" as const, content: "hi" }];

test("absent providers are skipped: only providers with a key appear in any role", () => {
  for (const role of llm.ROLES) assert.equal(llm.routesFor(role).length, 0, `no keys -> no routes for ${role}`);
  setKeys("GROQ_API_KEY");
  for (const role of llm.ROLES) {
    const rs = llm.routesFor(role);
    assert.ok(rs.length > 0, `groq serves ${role}`);
    assert.ok(rs.every((r) => r.provider === "groq"), `${role}: only groq routes`);
  }
  setKeys("MISTRAL_API_KEY");
  assert.ok(llm.routesFor("brief").some((r) => r.provider === "mistral"));
  // providers checked 31 Oct 2026 that do not qualify (card needed / retired) are not configured at all
  process.env.CEREBRAS_API_KEY = "x".repeat(20);
  process.env.GITHUB_MODELS_TOKEN = "x".repeat(20);
  for (const role of llm.ROLES) assert.ok(!llm.routesFor(role).some((r) => r.provider === "cerebras" || r.provider === "github"));
  // Cloudflare's free neurons are kept for AI images: no text role routes there (1 Nov 2026)
  setKeys("CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID");
  for (const role of llm.ROLES) assert.ok(!llm.routesFor(role).some((r) => r.provider === "cloudflare"), `${role} must not use cloudflare`);
});

test("exactly one key per provider (no rotation)", () => {
  setKeys("GROQ_API_KEY", "GROQ_API_KEY_2", "GROQ_API_KEYS");
  assert.equal(llm.keysFor("groq").length, 1);
  assert.equal(llm.keysFor("groq")[0], process.env.GROQ_API_KEY);
});

test("tier routing: design/art/vision never use fast-tier models and Gemini stays first for design", () => {
  setKeys(...ALL);
  process.env.ALLOW_NVIDIA_PRODUCTION = "true";
  for (const role of llm.STRONG_ROLES) {
    const rs = llm.routesFor(role);
    assert.ok(rs.length > 0);
    for (const r of rs) assert.notEqual(llm.modelSpec(r.provider, r.model).tier, "fast", `${role} must not use ${r.provider}:${r.model}`);
  }
  assert.equal(llm.routesFor("design")[0].provider, "google");
  assert.equal(llm.routesFor("art")[0].provider, "google");
  // light roles: a fast provider before Gemini (saves Gemini quota for design)
  for (const role of ["brief", "research", "outline"] as const) {
    const rs = llm.routesFor(role);
    const firstGoogle = rs.findIndex((r) => r.provider === "google");
    assert.ok(firstGoogle > 0, `${role}: something before Gemini`);
  }
  // light roles + planner + vision never spend the Gemini FLASH (design) quota
  for (const role of ["brief", "research", "outline", "plan", "vision"] as const)
    assert.ok(!llm.routesFor(role).some((r) => r.provider === "google" && /^gemini/.test(r.model) && !/lite/.test(r.model)), `${role} uses Gemini Flash`);
  // applyTierPolicy drops a model explicitly marked fast from a strong role
  const fast = { provider: "mistral", model: "mistral-small-2603" };
  assert.equal(llm.modelSpec(fast.provider, fast.model).tier, "fast");
  assert.equal(llm.applyTierPolicy("design", [fast]).length, 0);
  assert.equal(llm.applyTierPolicy("vision", [fast]).length, 0);
  assert.equal(llm.applyTierPolicy("brief", [fast]).length, 1);
  // Kimi K2.6 is the first backup right after the Gemini Flash models; the slower NVIDIA models stay after Mistral/SambaNova
  const dr = llm.routesFor("design");
  const d = dr.map((r) => r.provider);
  const lastGemini = dr.map((r) => r.provider === "google" && /^gemini/.test(r.model)).lastIndexOf(true);
  assert.equal(dr[lastGemini + 1].model, "moonshotai/kimi-k2.6");
  const minimax = dr.findIndex((r) => r.model === "minimaxai/minimax-m3.1-flash");
  const at = (m: string) => dr.findIndex((r) => r.model === m);
  assert.ok(at("mistral-large-4") < minimax && at("DeepSeek-V3.1") < minimax);
  assert.ok(minimax < d.indexOf("openrouter"));
});

test("NVIDIA dead models are gone from production routes", () => {
  setKeys("NVIDIA_NIM_API_KEY");
  process.env.ALLOW_NVIDIA_PRODUCTION = "true";
  for (const role of llm.ROLES)
    for (const r of llm.routesFor(role)) assert.ok(!/mistral-large-4|glm-5\.3-flash/.test(r.model), `${role}: ${r.model} should be dropped`);
});

test("429 cools that route: the next request skips it without calling it", async () => {
  setKeys("GROQ_API_KEY", "MISTRAL_API_KEY");
  const calls = mockFetch({
    "api.groq.com": () => new Response(JSON.stringify({ error: { message: "Rate limit reached for requests per minute. Please try again in 40s" } }), { status: 429, headers: { "retry-after": "40" } }),
    "api.mistral.ai": () => okReply(),
  });
  const routes = { brief: [{ provider: "groq", model: "openai/gpt-oss-120b" }, { provider: "mistral", model: "mistral-small-2603" }] };
  const r1 = await llm.llmContext.run({ routes }, () => llm.chat("brief", msgs, { stream: false }));
  assert.equal(r1.provider, "mistral");
  assert.deepEqual(calls, ["api.groq.com", "api.mistral.ai"]);
  const r2 = await llm.llmContext.run({ routes }, () => llm.chat("brief", msgs, { stream: false }));
  assert.equal(r2.provider, "mistral");
  assert.deepEqual(calls, ["api.groq.com", "api.mistral.ai", "api.mistral.ai"], "cooled groq is not called again");
});

test("daily-quota 429 marks the route used up until reset", async () => {
  setKeys("GROQ_API_KEY", "MISTRAL_API_KEY");
  const calls = mockFetch({
    "api.groq.com": () => new Response(JSON.stringify({ error: { message: "Rate limit reached on tokens per day (TPD): Limit 200000. Please try again in 7h12m" } }), { status: 429 }),
    "api.mistral.ai": () => okReply(),
  });
  const routes = { brief: [{ provider: "groq", model: "openai/gpt-oss-120b" }, { provider: "mistral", model: "mistral-small-2603" }] };
  await llm.llmContext.run({ routes }, () => llm.chat("brief", msgs, { stream: false }));
  await llm.llmContext.run({ routes }, () => llm.chat("brief", msgs, { stream: false }));
  assert.equal(calls.filter((c) => c === "api.groq.com").length, 1);
});

test("429 on two models of one provider benches the whole provider", async () => {
  setKeys("GROQ_API_KEY", "MISTRAL_API_KEY");
  const calls = mockFetch({
    "api.groq.com": () => new Response("{}", { status: 429, headers: { "retry-after": "50" } }),
    "api.mistral.ai": () => okReply(),
  });
  const routes = { brief: [{ provider: "groq", model: "a" }, { provider: "groq", model: "b" }, { provider: "groq", model: "c" }, { provider: "mistral", model: "mistral-small-2603" }] };
  await llm.llmContext.run({ routes }, () => llm.chat("brief", msgs, { stream: false }));
  assert.deepEqual(calls, ["api.groq.com", "api.groq.com", "api.mistral.ai"], "model c is not tried once the account is cooling");
});

test("circuit breaker: a provider failing 3 times in a row is skipped (seconds, not minutes)", async () => {
  setKeys("NVIDIA_NIM_API_KEY", "GROQ_API_KEY");
  const calls = mockFetch({
    "integrate.api.nvidia.com": () => new Response("upstream error", { status: 502 }),
    "api.groq.com": () => okReply(),
  });
  const routes = { brief: [{ provider: "nvidia", model: "m1" }, { provider: "nvidia", model: "m2" }, { provider: "nvidia", model: "m3" }, { provider: "groq", model: "x" }] };
  const r1 = await llm.llmContext.run({ routes }, () => llm.chat("brief", msgs, { stream: false }));
  assert.equal(r1.provider, "groq");
  assert.equal(calls.filter((c) => c.includes("nvidia")).length, 3);
  const routes2 = { brief: [{ provider: "nvidia", model: "m4" }, { provider: "groq", model: "x" }] };
  const t0 = Date.now();
  const r2 = await llm.llmContext.run({ routes: routes2 }, () => llm.chat("brief", msgs, { stream: false }));
  assert.equal(r2.provider, "groq");
  assert.equal(calls.filter((c) => c.includes("nvidia")).length, 3, "benched provider not called");
  assert.ok(Date.now() - t0 < 2000);
});

test("a request with no reply is abandoned at its timeout and the next route answers", async () => {
  setKeys("NVIDIA_NIM_API_KEY", "GROQ_API_KEY");
  mockFetch({
    "integrate.api.nvidia.com": (init) =>
      new Promise<Response>((_, rej) => init.signal?.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" })))),
    "api.groq.com": () => okReply(),
  });
  const routes = { brief: [{ provider: "nvidia", model: "slow" }, { provider: "groq", model: "x" }] };
  const t0 = Date.now();
  const r = await llm.llmContext.run({ routes }, () => llm.chat("brief", msgs, { stream: false, timeoutMs: 300 }));
  assert.equal(r.provider, "groq");
  assert.ok(Date.now() - t0 < 3000);
});

test("a reply that is all thinking and no content counts as a failure", async () => {
  setKeys("NVIDIA_NIM_API_KEY", "GROQ_API_KEY");
  const calls = mockFetch({
    "integrate.api.nvidia.com": () => new Response(JSON.stringify({ choices: [{ message: { content: null, reasoning_content: "let me think..." }, finish_reason: "length" }] }), { status: 200 }),
    "api.groq.com": () => okReply(),
  });
  const routes = { brief: [{ provider: "nvidia", model: "thinker" }, { provider: "groq", model: "x" }] };
  const r = await llm.llmContext.run({ routes }, () => llm.chat("brief", msgs, { stream: false }));
  assert.equal(r.provider, "groq");
  assert.deepEqual(calls, ["integrate.api.nvidia.com", "api.groq.com"]);
});

test("streamed replies are read; reasoning-only streams fail over", async () => {
  setKeys("NVIDIA_NIM_API_KEY", "GROQ_API_KEY");
  const sse = (chunks: object[]) =>
    new Response(chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join("") + "data: [DONE]\n\n", { status: 200, headers: { "content-type": "text/event-stream" } });
  mockFetch({
    "integrate.api.nvidia.com": () => sse([{ choices: [{ delta: { reasoning_content: "hmm" } }] }, { choices: [{ delta: {}, finish_reason: "length" }] }]),
    "api.groq.com": () => sse([{ choices: [{ delta: { content: '{"a":' } }] }, { choices: [{ delta: { content: "1}" }, finish_reason: "stop" }] }]),
  });
  const routes = { brief: [{ provider: "nvidia", model: "thinker" }, { provider: "groq", model: "x" }] };
  const r = await llm.llmContext.run({ routes }, () => llm.chat("brief", msgs, { stream: true }));
  assert.equal(r.provider, "groq");
  assert.equal(r.text, '{"a":1}');
});

test("error text is logged without the key", () => {
  const k = ["nvapi", "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"].join("-"); // fake, assembled so no scanner mistakes it for a key
  const out = llm.redactSecrets(`HTTP 401: bad key ${k} / Authorization: Bearer ${"sk-or-v1"}-abcdefghijkl / ${"gsk"}_abcdefghijklmnop`, k);
  assert.ok(!out.includes("ABCDEFGHIJ"));
  assert.ok(!out.includes("abcdefghijkl"));
  assert.ok(out.includes("[key]"));
});

test("mistral-small is paced to at most 1 request per second; zai-glm-5-3 is gone (403 on the free tier)", async () => {
  setKeys("MISTRAL_API_KEY");
  for (const role of llm.ROLES) for (const r of llm.routesFor(role)) assert.notEqual(r.model, "zai-glm-5-3", `${role} still routes zai-glm-5-3`);
  assert.equal(llm.modelSpec("mistral", "mistral-small-2603").minIntervalMs, 1000);
  const at: number[] = [];
  mockFetch({ "api.mistral.ai": () => (at.push(Date.now()), okReply()) });
  const routes = { brief: [{ provider: "mistral", model: "mistral-small-2603" }] };
  await llm.llmContext.run({ routes }, () => llm.chat("brief", msgs, { stream: false }));
  await llm.llmContext.run({ routes }, () => llm.chat("brief", msgs, { stream: false }));
  assert.equal(at.length, 2);
  assert.ok(at[1] - at[0] >= 950, `second call came ${at[1] - at[0]} ms after the first`);
});

test("an unusable reply (fails the caller's check) moves to the next model instead of failing", async () => {
  setKeys("NVIDIA_NIM_API_KEY", "GROQ_API_KEY");
  const calls = mockFetch({
    "integrate.api.nvidia.com": () => okReply("Sure! Here is a description of the slide, but no markup."),
    "api.groq.com": () => okReply("<slide><div>ok</div></slide>"),
  });
  const routes = { design: [{ provider: "nvidia", model: "chatty" }, { provider: "groq", model: "x" }] };
  const r = await llm.llmContext.run({ routes }, () => llm.chat("design", msgs, { stream: false, validate: (t) => t.includes("<slide>") }));
  assert.equal(r.provider, "groq");
  assert.deepEqual(calls, ["integrate.api.nvidia.com", "api.groq.com"]);
});

test("a reply whose content is an already-parsed object is read as JSON, not '[object Object]'", async () => {
  setKeys("CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID");
  mockFetch({ "api.cloudflare.com": () => new Response(JSON.stringify({ result: { response: { name: "Deck", n: 1 } } }), { status: 200 }) });
  const routes = { art: [{ provider: "cloudflare", model: "m" }] };
  const { data } = await llm.llmContext.run({ routes }, () => llm.chatJson<any>("art", msgs, { stream: false }));
  assert.deepEqual(data, { name: "Deck", n: 1 });
  assert.equal(llm.asText([{ type: "text", text: "a" }, { type: "text", text: "b" }]), "ab");
});

test("chatJson: a reply that is not JSON moves to the next model", async () => {
  setKeys("NVIDIA_NIM_API_KEY", "GROQ_API_KEY");
  mockFetch({ "integrate.api.nvidia.com": () => okReply("[object Object]"), "api.groq.com": () => okReply('{"ok":1}') });
  const routes = { art: [{ provider: "nvidia", model: "bad" }, { provider: "groq", model: "x" }] };
  const { data, meta } = await llm.llmContext.run({ routes }, () => llm.chatJson<any>("art", msgs, { stream: false }));
  assert.deepEqual(data, { ok: 1 });
  assert.equal(meta.provider, "groq");
});

test("a Gemini quota 429 that names its model cools only that model, not all of Google", async () => {
  setKeys("GOOGLE_AI_API_KEY");
  const quota = (m: string) => new Response(JSON.stringify([{ error: { code: 429, message: `Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 5, model: ${m}, description: Generate content requests per minute limit exceeded`, details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "45s" }] } }]), { status: 429 });
  const calls: string[] = [];
  globalThis.fetch = (async (_u: any, init: any) => {
    const model = JSON.parse(init.body).model;
    calls.push(model);
    return model.includes("lite") ? okReply() : quota(model);
  }) as typeof fetch;
  const routes = { design: [{ provider: "google", model: "flash-a" }, { provider: "google", model: "flash-b" }, { provider: "google", model: "flash-lite" }] };
  const r = await llm.llmContext.run({ routes }, () => llm.chat("design", msgs, { stream: false }));
  assert.equal(r.model, "flash-lite");
  assert.deepEqual(calls, ["flash-a", "flash-b", "flash-lite"]);
});

test("a provider that keeps answering 429 'high demand' is benched by the circuit breaker", async () => {
  setKeys("SAMBANOVA_API_KEY", "GROQ_API_KEY");
  let samba = 0;
  mockFetch({
    "api.sambanova.ai": () => {
      samba++;
      return new Response(JSON.stringify({ error: { message: "gpt-oss-120b-32k is currently experiencing high demand. Please try again later!" } }), { status: 429 });
    },
    "api.groq.com": () => okReply(),
  });
  const routes = { brief: [{ provider: "sambanova", model: "a" }, { provider: "sambanova", model: "b" }, { provider: "sambanova", model: "c" }, { provider: "groq", model: "x" }] };
  for (let i = 0; i < 3; i++) await llm.llmContext.run({ routes }, () => llm.chat("brief", msgs, { stream: false }));
  const before = samba;
  const r = await llm.llmContext.run({ routes }, () => llm.chat("brief", msgs, { stream: false }));
  assert.equal(r.provider, "groq");
  assert.equal(samba, before, "benched provider is not asked again");
});
