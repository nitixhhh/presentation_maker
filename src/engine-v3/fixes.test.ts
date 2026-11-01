/**
 * Tests for the 1 Nov 2026 fixes (no network): route order, alias quota, Kimi switch, revision routing,
 * student-detail privacy, source relevance, "still building" downloads. Run with `npm test`.
 */
import { test as nodeTest, before, beforeEach } from "node:test";
const test = (name: string, fn: () => unknown) => nodeTest(name, { timeout: 15_000 }, fn as any);
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ENVS = [
  "GOOGLE_AI_API_KEY", "GROQ_API_KEY", "MISTRAL_API_KEY", "SAMBANOVA_API_KEY", "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID",
  "OPENROUTER_API_KEY", "NVIDIA_NIM_API_KEY", "OLLAMA_API_KEY", "ZAI_API_KEY", "ALLOW_NVIDIA_PRODUCTION", "ENGINE_V3_ROUTES",
  "DESIGN_PRIMARY", "V3_REVISION_ROUTE", "V3_GEMINI_DRAFT_RESERVE",
];
const ALL = ["GOOGLE_AI_API_KEY", "GROQ_API_KEY", "MISTRAL_API_KEY", "SAMBANOVA_API_KEY", "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "OPENROUTER_API_KEY", "NVIDIA_NIM_API_KEY", "OLLAMA_API_KEY", "ZAI_API_KEY"];

type Llm = typeof import("./llm");
let llm: Llm;
const realFetch = globalThis.fetch;
before(async () => {
  process.env.DECKCRAFT_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "dc-fix-test-"));
  llm = await import("./llm");
});
beforeEach(() => {
  for (const k of ENVS) delete process.env[k];
  globalThis.fetch = realFetch;
  llm.resetSchedulerForTests();
});
function setKeys(...envs: string[]) {
  for (const e of envs) process.env[e] = e === "CLOUDFLARE_ACCOUNT_ID" ? "acc123" : `test-${e.toLowerCase()}-0123456789`;
}
const ids = (rs: { provider: string; model: string }[]) => rs.map((r) => `${r.provider}:${r.model}`);
const isFlash = (id: string) => /^google:gemini/.test(id) && !/lite/.test(id);

test("route fix: no alias duplicates, no pay-per-token, no Cloudflare/OpenRouter-Gemma in design; Z.ai optional", () => {
  setKeys(...ALL);
  const design = ids(llm.routesFor("design"));
  assert.deepEqual(design.filter(isFlash), ["google:gemini-3.8-flash", "google:gemini-3.6-flash", "google:gemini-3-flash-preview"]);
  for (const role of llm.ROLES) {
    const rs = ids(llm.routesFor(role));
    assert.ok(!rs.some((r) => /gemini-3\.7-flash$|gemini-3\.5-flash$/.test(r)), `${role}: alias route`);
    assert.ok(!rs.some((r) => r.startsWith("ollama:")), `${role}: pay-per-token route`);
    assert.ok(!rs.some((r) => r.startsWith("cloudflare:")), `${role}: cloudflare text route`);
  }
  assert.ok(!design.some((r) => /openrouter:google\/gemma|groq:qwen/.test(r)));
  assert.ok(design.includes("zai:glm-4.7-flash"));
  assert.ok(ids(llm.routesFor("vision")).includes("zai:glm-4.6v-flash"));
  // light roles: Groq gpt-oss-120b first, then Flash-Lite, Gemma-4-26B early; no SambaNova Llama / OpenRouter
  for (const role of ["brief", "research", "outline"] as const) {
    const rs = ids(llm.routesFor(role));
    assert.equal(rs[0], "groq:openai/gpt-oss-120b");
    assert.equal(rs[1], "google:gemini-3.5-flash-lite");
    assert.ok(rs.indexOf("google:gemma-4-26b-a4b-it") <= 3, `${role}: gemma-4-26b early`);
    assert.ok(!rs.some((r) => /sambanova:Meta-Llama|^openrouter:/.test(r)));
  }
  // planner (image director) and reviewer (vision) start on Flash-Lite, never Gemini Flash
  assert.equal(ids(llm.routesFor("plan"))[0], "google:gemini-3.5-flash-lite");
  assert.equal(ids(llm.routesFor("vision"))[0], "google:gemini-3.5-flash-lite");
  // no Z.ai key → skipped
  delete process.env.ZAI_API_KEY;
  assert.ok(!llm.routesFor("design").some((r) => r.provider === "zai"));
});

test("alias and target share one quota counter", () => {
  assert.equal(llm.quotaModel("google", "gemini-3.7-flash"), "gemini-3.8-flash");
  assert.equal(llm.quotaModel("google", "gemini-3.5-flash"), "gemini-3.6-flash");
  assert.equal(llm.quotaModel("google", "gemini-3.8-flash"), "gemini-3.8-flash");
  assert.equal(llm.quotaModel("groq", "openai/gpt-oss-120b"), "openai/gpt-oss-120b");
});

test("a daily 429 on the target model also stops its alias", async () => {
  setKeys("GOOGLE_AI_API_KEY", "MISTRAL_API_KEY");
  const calls: string[] = [];
  globalThis.fetch = (async (url: any, init: any) => {
    const body = JSON.parse(init.body);
    calls.push(body.model);
    if (String(url).includes("googleapis")) return new Response(JSON.stringify({ error: { message: "Quota exceeded for metric: generate_content_free_tier_requests, limit: 20, model: gemini-3.8-flash. Please retry in 9h. PerDay" } }), { status: 429 });
    return new Response(JSON.stringify({ choices: [{ message: { content: "ok" }, finish_reason: "stop" }] }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  const routes = { brief: [{ provider: "google", model: "gemini-3.8-flash" }, { provider: "google", model: "gemini-3.7-flash" }, { provider: "mistral", model: "mistral-small-2603" }] };
  const r = await llm.llmContext.run({ routes }, () => llm.chat("brief", [{ role: "user", content: "hi" }], { stream: false }));
  assert.equal(r.provider, "mistral");
  assert.deepEqual(calls, ["gemini-3.8-flash", "mistral-small-2603"], "the alias 3.7 is not called once 3.8's day is used");
});

test("DESIGN_PRIMARY=nvidia-kimi makes Kimi the main designer; unset = Gemini first, Kimi first backup", () => {
  setKeys(...ALL);
  process.env.ALLOW_NVIDIA_PRODUCTION = "true";
  let d = ids(llm.routesFor("design"));
  assert.ok(isFlash(d[0]));
  assert.equal(d[3], "nvidia:moonshotai/kimi-k2.6", "right after the 3 Gemini Flash models");
  process.env.DESIGN_PRIMARY = "nvidia-kimi";
  for (const role of ["design", "art"] as const) {
    d = ids(llm.routesFor(role));
    assert.equal(d[0], "nvidia:moonshotai/kimi-k2.6");
    assert.ok(isFlash(d[1]), `${role}: Gemini right after Kimi`);
    assert.equal(d.filter((x) => x === "nvidia:moonshotai/kimi-k2.6").length, 1);
  }
  process.env.DESIGN_PRIMARY = "gemini";
  assert.ok(isFlash(ids(llm.routesFor("design"))[0]));
  // without the NVIDIA opt-in the switch does nothing (trial terms)
  process.env.DESIGN_PRIMARY = "nvidia-kimi";
  delete process.env.ALLOW_NVIDIA_PRODUCTION;
  assert.ok(!llm.routesFor("design").some((r) => r.provider === "nvidia"));
});

test("revisions: Gemini first while quota is plentiful, strong backups first when it runs low — same chain, nothing dropped", () => {
  setKeys(...ALL);
  process.env.ALLOW_NVIDIA_PRODUCTION = "true";
  const chain = llm.routesFor("design");
  assert.equal(llm.geminiQuotaLeft(chain), 60, "3 real Gemini Flash models x 20/day");
  process.env.V3_GEMINI_DRAFT_RESERVE = "30";
  assert.deepEqual(llm.revisionRoutes(chain), chain, "plenty left: unchanged");
  process.env.V3_GEMINI_DRAFT_RESERVE = "100";
  const low = ids(llm.revisionRoutes(chain));
  assert.deepEqual(low.slice(0, 4), ["nvidia:moonshotai/kimi-k2.6", "mistral:mistral-large-4", "sambanova:DeepSeek-V3.1", "zai:glm-4.7-flash"]);
  assert.ok(isFlash(low[5]), "Gemini follows the backups");
  assert.deepEqual([...low].sort(), [...ids(chain)].sort(), "same routes, only the order changes");
  assert.deepEqual(llm.revisionRoutes(chain, "gemini-first"), chain);
  assert.deepEqual(ids(llm.revisionRoutes(chain, "backup-first")), low);
});

test("privacy: student details never reach the brief prompt; title fields are exact text from the form", async () => {
  setKeys("GROQ_API_KEY");
  const bodies: string[] = [];
  globalThis.fetch = (async (_u: any, init: any) => {
    bodies.push(String(init.body));
    const content = JSON.stringify({ title: "Photosynthesis", deckType: "subject seminar", requiredSections: ["Title", "Intro"], researchQueries: ["photosynthesis"] });
    return new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: "stop" }] }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  const { runBrief } = await import("./agents/brief");
  const brief = await runBrief({ topic: "Photosynthesis", presenter: { names: "Priyanka Dey", rollNo: "BWU/BBA/26/025", guide: "Dr. A. Kumar" } } as any);
  assert.ok(bodies.length >= 1);
  for (const b of bodies) for (const secret of ["Priyanka", "BWU/BBA/26/025", "Kumar"]) assert.ok(!b.includes(secret), `prompt leaked ${secret}`);
  assert.deepEqual(brief.titleSlideFields, [
    { label: "Presented by", value: "Priyanka Dey" },
    { label: "Roll No.", value: "BWU/BBA/26/025" },
    { label: "Under the guidance of", value: "Dr. A. Kumar" },
  ]);
});

test("privacy: placeholders are filled in code and masked again before a slide goes back to an AI", async () => {
  const pv = await import("./privacy");
  const fields = [{ label: "Presented by", value: "Priya & Rahul" }, { label: "Roll No.", value: "23CSE041" }];
  const html = `<div><h1>T</h1><p>${pv.token(0)}</p><p>${pv.token(1)}</p></div>`;
  const filled = pv.fillPlaceholders(html, fields);
  assert.ok(filled.includes("Priya &amp; Rahul") && filled.includes("23CSE041") && !filled.includes("{{P"));
  assert.equal(pv.maskText(filled, fields), html);
  assert.ok(!pv.maskedFieldLines(fields).includes("Priya"));
  // a designer that dropped a placeholder: the engine adds the missing detail itself
  const dropped = `<div><h1>T</h1><p>${pv.token(0)}</p></div>`;
  const missing = pv.missingPlaceholders(dropped, fields);
  assert.deepEqual(missing, [1]);
  assert.ok(pv.fillPlaceholders(pv.ensureFields(dropped, fields, missing), fields).includes("23CSE041"));
  const { designerUserPrompt } = await import("./agents/designer");
  const deck: any = { brief: { title: "X", titleSlideFields: fields, language: "English" }, outline: { slides: [{ n: 1, role: "title", title: "X", points: [], visual: { kind: "none" } }] }, assets: [], references: [], research: { facts: [], sources: [] } };
  const prompt = designerUserPrompt(deck, deck.outline.slides[0], new Map());
  assert.ok(prompt.includes(pv.token(0)) && !prompt.includes("Priya") && !prompt.includes("23CSE041"));
});

test("sources: off-topic and niche results are dropped, on-topic kept", async () => {
  const { filterSources, isRelevantSource, topicWordsOf } = await import("./research/relevance");
  const w = topicWordsOf("Blockchain in Supply Chain");
  assert.deepEqual(w, ["blockchain", "supply", "chain"]);
  const wiki = (title: string, text: string) => ({ kind: "wikipedia", title, text });
  assert.equal(isRelevantSource(wiki("Supply chain attack", "A supply chain attack is a cyber-attack that seeks to damage an organization by targeting less secure elements in the supply chain."), w), false);
  assert.equal(isRelevantSource(wiki("Polygon", "Polygon is a blockchain platform for supply chain and other apps."), w), false);
  assert.equal(isRelevantSource(wiki("Blockchain", "A blockchain is a distributed ledger with growing lists of records (blocks) securely linked together; used in supply chain tracking."), w), true);
  const p = topicWordsOf("Photosynthesis");
  const paper = (title: string, citations: number) => ({ kind: "openalex", title, text: "photosynthesis ...", citations });
  assert.equal(isRelevantSource(paper("Photosynthesis of Stipa grandis in Inner Mongolian grassland under winter conditions", 3), p), false);
  assert.equal(isRelevantSource(paper("Photosynthesis: a review of light reactions", 3), p), true);
  assert.equal(isRelevantSource(paper("Photosynthetic efficiency of crops", 900), p), true);
  // never starve the deck: with too few sources the best-cited matching papers come back
  const { kept } = filterSources([paper("Photosynthesis in grassland A", 4), paper("Photosynthesis in grassland B", 9), wiki("Terra", "Terra is a planet")], p, 2);
  assert.equal(kept.length, 2);
  assert.ok(!kept.some((s) => s.title === "Terra"));
  assert.ok(topicWordsOf("Difference Between Sukh and Suvidha").join(",") === "sukh,suvidha");
});

test("download: a deck still being built is reported as building, not served empty", async () => {
  const { deckIncomplete } = await import("./store");
  const outline = { slides: [{ n: 1 }, { n: 2 }] } as any;
  assert.equal(deckIncomplete({ slides: [], outline }), true);
  assert.equal(deckIncomplete({ slides: [{ n: 1 }] as any, outline }), true);
  assert.equal(deckIncomplete({ slides: [{ n: 1 }, { n: 2 }] as any, outline }), false);
});
