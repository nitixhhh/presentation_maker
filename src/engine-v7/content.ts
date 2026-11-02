/**
 * Engine v7 — content: brief, research and the story. Facts and sources come from the existing research pipeline
 * (engine v3 brief + research, the shared deepen step and v5's scholarly boost). The story step writes what each
 * slide SAYS — one idea per slide, real words and numbers — and nothing about how it looks.
 */
import { chatJson } from "../engine-v3/llm";
import { runBrief } from "../engine-v3/agents/brief";
import { runResearch } from "../engine-v3/agents/research";
import { deepenResearch } from "../engine-common/deepen";
import { boostScholarly } from "../engine-v5/scholarly";
import { buildReferences } from "../engine-v5/cite";
import type { Brief, ResearchPack } from "../engine-v3/types";
import type { V7Request, V7Slide } from "./types";

export async function research(req: V7Request, log: (m: string) => void): Promise<{ brief: Brief; pack: ResearchPack }> {
  const brief = await runBrief({ topic: req.topic, slideCount: req.slideCount, audience: req.audience, language: req.language, styleHint: req.styleHint } as any);
  log(`brief: "${brief.title}" (${brief.deckType}, ${brief.slideCount} slides)`);
  let pack = await runResearch(brief, log, req.topic);
  try {
    pack = await deepenResearch(brief, pack, req.topic, log);
  } catch (e: any) {
    log(`deepen skipped: ${String(e?.message || e).slice(0, 120)}`);
  }
  try {
    pack = await boostScholarly(brief, pack, req.topic, log);
  } catch (e: any) {
    log(`scholarly boost skipped: ${String(e?.message || e).slice(0, 120)}`);
  }
  log(`research: ${pack.facts.length} facts from ${pack.sources.length} sources`);
  return { brief, pack };
}

const STORY_SYSTEM = `You write the story of a presentation: what each slide SAYS. A separate designer will later design every slide from scratch, so write content only, never layout.
Rules:
- One clear idea per slide. Each slide's "idea" is the single sentence the audience must walk away with.
- "body" holds the actual words the slide shows: a few short lines, real numbers with units, names, steps, a formula, a short code snippet or a worked example when it explains the idea best. Keep it lean: what fits on a slide read from the back of a room (usually 15–45 words; a cover needs only a subtitle line).
- Be concrete: real numbers with units, named examples, a worked example with actual values, the actual formula or steps. Vague lines like "input the values into the formula" are not allowed — show the values.
- Use ONLY facts from the FACTS list for numbers, dates, names and claims, and list the fact ids each slide uses. Common textbook knowledge (a formula's standard form, a worked arithmetic example with round numbers) is allowed and needs no fact id.
- Tell a story: hook → build understanding step by step → why it matters / limits → close. Do not use generic section names like "Introduction" or "Conclusion" as titles; titles are short, specific and human (max 8 words).
- Slide 1 is the cover (title + one-line subtitle). The LAST slide is "References" with empty body (the engine fills the list). Optionally the slide before references is a short closing thought.
- Plain English (or the requested language). No emoji. No markdown symbols like ** or #.
- notes: 1–3 sentences the presenter can say.
Reply with ONLY JSON: {"slides":[{"n":1,"title":"","idea":"","body":"","facts":["F1"],"notes":""}]}`;

export async function writeStory(req: V7Request, brief: Brief, pack: ResearchPack, log: (m: string) => void): Promise<V7Slide[]> {
  const count = Math.max(6, Math.min(14, req.slideCount || brief.slideCount || 10));
  const user = `Topic: ${req.topic}
Deck title (you may improve it): ${brief.title}
Audience: ${req.audience || brief.level}
Goal: ${brief.goal}
Language: ${req.language || brief.language || "English"}
Exactly ${count} slides (cover and references included).
FACTS:
${pack.facts.map((f) => `${f.id}: ${f.text}`).join("\n")}
KEY TERMS:
${pack.keyTerms.map((k) => `${k.term}: ${k.meaning}`).join("\n")}`;
  // the story decides what every slide can show, so it runs on the strong "art" chain (falls back to the light models)
  const { data, meta } = await chatJson<{ slides: V7Slide[] }>("art", [
    { role: "system", content: STORY_SYSTEM },
    { role: "user", content: user },
  ], { temperature: 0.5, maxTokens: 12000, timeoutMs: 240_000, label: "v7 story" });
  log(`story: ${data.slides?.length} slides (${meta.provider}:${meta.model}, ${Math.round(meta.ms / 1000)} s)`);
  const known = new Set(pack.facts.map((f) => f.id));
  return (data.slides || []).slice(0, count).map((s, i) => ({
    n: i + 1,
    title: String(s.title || "").trim(),
    idea: String(s.idea || "").trim(),
    body: String(s.body || "").replace(/\*\*/g, "").trim(),
    facts: (s.facts || []).map(String).filter((id) => known.has(id)),
    notes: String(s.notes || "").trim(),
  }));
}

/** Reference list in first-use order of the sources behind the story's facts (falls back to all sources). */
export function referencesFor(slides: V7Slide[], pack: ResearchPack, lang = "English") {
  const order: string[] = [];
  for (const s of slides) for (const fid of s.facts) {
    const f = pack.facts.find((x) => x.id === fid);
    for (const sid of f?.sources || []) if (!order.includes(sid)) order.push(sid);
  }
  const ids = order.length >= 3 ? order : pack.sources.map((s) => s.id);
  const { refs } = buildReferences(ids.slice(0, 8), pack.sources, lang);
  return refs.map((r) => ({ n: r.n, text: r.text, url: r.url }));
}
