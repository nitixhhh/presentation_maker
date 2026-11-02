/**
 * Engine v5 — the PLANNER: one JSON call plans the whole deck as (template id + filled slots) per slide.
 * The model never writes HTML/CSS: it chooses from the designer-made template catalog and writes copy into typed,
 * length-limited slots. Code then enforces the slide count, the opening/closing/references slots, layout variety,
 * slot limits and icon ids, and asks again (one small call per slide) only for a slide whose slots are unusable.
 */
import { naturalText } from "./text";
import { chatJson } from "../engine-v3/llm";
import type { Brief, ResearchPack } from "../engine-v3/types";
import { TEMPLATES, templateById, catalogText, type SlideContent, type SlotItem } from "./templates";
import { THEMES } from "./themes";
import { resolveIconName } from "../engine-v4/iconRender";

export interface PlannedSlide extends SlideContent {
  n: number;
  photoAlt?: string;
  /** a slot the planner did not write (filled by one small call) */
  missing?: boolean;
  factIds?: string[];
  role: string;
}

export interface Plan {
  theme?: string;
  slides: PlannedSlide[];
  requests: number;
  repaired: string[];
}

const SYSTEM = `You are the lead designer and writer of a premium presentation studio (like Beautiful.ai / Gamma). You plan a whole deck by choosing, for every slide, ONE designer-made TEMPLATE from the catalog and writing its content into the template's slots. You never write HTML, CSS, colours or positions — the engine renders every template perfectly. Your job is the story, the choice of the best template for each slide's content, and excellent, specific, concise copy.

RULES
- Exactly the requested number of slides, numbered 1..N.
- Slide 1 uses a title template (title-hero if a strong real photo of the subject exists, else title-split or title-type).
- If N ≥ 6: slide N-1 is "references" (title only, engine fills it) and slide N is "closing". If N is 5 or less: last slide is "references" and no closing.
- Use "agenda" as slide 2 only when N ≥ 8. Use "section" only when N ≥ 12.
- Pick the template that matches the SHAPE of the content: dates → timeline; ordered steps → process; loop → cycle; parts around a centre → hub (4–6 parts); levels → layers; A vs B → comparison; good vs bad → pros-cons; striking real number → big-stat; several real numbers → stats-row or chart; 2/3/4 parallel ideas → cards-2/cards-3/cards-4; concept intro → definition; summary → takeaways; a real concrete subject to show → icon-rows-photo / photo-split / photo-full.
- VARIETY: never the same template on two neighbouring slides; each card grid (cards-2/3/4) at most ONCE per deck, other templates at most twice; use at least 6 different templates in 8 slides. Prefer shaped, visual templates (hub, process, timeline, cycle, stats-row, big-stat, chart, comparison, photo-split, icon-rows-photo, diagram) over plain cards and text-focus (max once). A deck with a real number should show it big (big-stat / stats-row / chart).
- Fact ids (F1, F12…) go ONLY in "fact_ids" — never inside titles, text or notes.
- NATURAL LANGUAGE: the FACTS are research notes, not slide copy. Rewrite each fact you use in your own clear words (paraphrase, keep the real number/name/date) so it reads like a teacher explaining it. Never paste a URL, a web address, a website or source name ("Wikipedia", "OpenAlex"), "[12]"-style markers or "Source: …" into any slot or note — the engine builds the references slide with proper citations. Always fill "fact_ids" with the facts each slide uses. When a "(paper)" fact and an "(encyclopedia)" fact make the same point, use the paper's.
- COPY: slide titles are short ACTION titles that state the point ("Gravity bends light around black holes", not "Gravitational lensing"). Respect every character limit in the slots — shorter is better. No filler, no generic statements; concrete facts, names, numbers, examples from the research. Never invent numbers, dates, quotes or names: use only the FACTS given (cite their ids in fact_ids). A quote slide only for a real quote found in the facts.
- Numbers in stat/stats-row/chart must come from the facts. If there are no real numbers, do not use those templates.
- Icons: for every item give "icon" = ONE simple English noun that literally depicts THAT item's meaning (chloroplast → "leaf", ATP → "battery", water → "droplet", light → "sun", law → "scale", money → "coins", school → "graduation-cap", experiment → "flask", growth → "trending-up", risk → "alert-triangle", people → "users", idea → "lightbulb", protest → "megaphone", history → "landmark", data → "database", security → "lock"). Never a computer/tech icon for a non-tech idea. All icons on a slide different.
- Photos make a deck feel premium: put a real photo on 2–3 slides (the title slide + 1–2 content slides) whenever the subject has a concrete, photographable side — a named person from the facts, a famous work, a place, an organism, an instrument, a building, an event. "photo_query" = 1–3 plain English words naming ONE concrete, photographable thing as it would be titled on Wikimedia Commons (never a map, chart, graph, curve, index or statistic — those are not photos) (good: "MRI scanner", "stethoscope", "Mahatma Gandhi", "Bombay Stock Exchange", "chloroplast"; bad: "AI driven MRI medical device hospital" — adjectives and abstractions find nothing); "photo_alt" = a second, different query for the same slide. Never for abstract ideas. Only on templates that take a photo.
- eyebrow: a 1–3 word section label for the slide (e.g. "Background", "How it works", "Evidence", "Impact").
- notes: 2–3 sentences the presenter says, in the deck language.
- LANGUAGE: write all slide text and notes in the deck language (Hindi = Devanagari script; Hinglish = Hindi words in Roman script). photo_query and icon stay in English.
- Presenter details (names, roll no, institute…) are added by the engine on the title slide — never write them.

TEMPLATE CATALOG (id [photo] — when to use — SLOTS)
{CATALOG}

THEMES (suggest one id that suits the subject): {THEMES}

Reply with ONLY JSON:
{"theme":"id","slides":[{"n":1,"template":"title-split","eyebrow":"","title":"","lede":"","items":[{"icon":"","title":"","text":"","value":"","label":""}],"stat":{"value":"","label":"","text":""},"quote":{"text":"","author":"","role":""},"left":{"title":"","icon":"","points":[""]},"right":{"title":"","icon":"","points":[""]},"chart":{"kind":"bars","unit":"","items":[{"label":"","value":0}]},"table":{"columns":[""],"rows":[[""]]},"takeaway":"","term":"","center":"","axes":{"x":"","y":""},"diagram":"flow","photo_query":"","photo_alt":"","fact_ids":["F1"],"notes":""}]}
Include only the slots the chosen template uses.`;

/**
 * Engine v6: the same slot-filling planner, told to build an ARGUMENT (question → evidence → implications → answer)
 * with full-sentence action titles, the v6 data/diagram layouts, and a closing slide that recaps the answer.
 * The style is not the planner's business in v6 (a separate style director designs it for the topic).
 */
export const V6_STORY = `STORY (this matters most)
- Build the deck as an ARGUMENT, not a list of topics. The content slides walk: QUESTION (why this matters / the debate) → CONTEXT (what the key idea means) → EVIDENCE (real numbers, data, studies) → MECHANISM (how / why it happens) → IMPLICATIONS or COUNTERPOINT (trade-offs, the other side) → ANSWER (what the evidence says). For a "how it works" topic: PHENOMENON → PARTS → PROCESS → EVIDENCE → APPLICATIONS → WHY IT MATTERS.
- Give every slide "beat": one of question, context, evidence, mechanism, implication, counterpoint, answer (title slide: "title"; references: "references"; closing: "closing").
- ACTION TITLES: every content title is a complete sentence (≤ 70 chars) that states the slide's conclusion, so reading only the titles tells the whole story — e.g. "Extreme inequality can weaken the next round of growth", "Chlorophyll turns sunlight into chemical energy". Never a bare label ("Introduction", "Causes", "Conclusion", "Key Statistics").
- Slide 2 opens the argument with the driving question or the most surprising real fact (big-stat, text-focus or definition) — use "agenda" only when N ≥ 10.
- The last content slide before references gives the ANSWER plainly (takeaways or text-focus), consistent with the evidence.
- Closing slide: title = a short thanks/questions line; lede = the one-sentence answer; items = exactly 3 key takeaways [{icon, title ≤ 44 chars}].
- CHART VALUES are copied from the RESEARCHED FACTS (each value appears in a fact you cite); a theoretical curve or an "illustrative" shape is a diagram/process slide, never a chart with made-up values.
- VISUALS: if the facts hold 3+ comparable numbers (same unit, across years or across categories/countries/groups), one slide MUST be a chart-trend (line for years, bars for categories) or a donut (shares of a whole) — a drawn chart beats a row of stat tiles. When the facts hold real numbers, show at least one as a data visual — chart-trend (a number changing over years: a growth chart), donut (shares of a whole), chart, stats-row or big-stat. Show at least one idea as a diagram — flowchart (cause → effect with branches or a decision), process, cycle, hub, timeline, matrix, layers, or diagram with "tree" (a hierarchy/classification). Data visuals use ONLY numbers from the facts. A stat is a measured real-world quantity with its unit ("32.5%", "$4.2 tn", "1.4 bn people", "0.41 Gini") — never a definitional constant ("0", "1"), a year alone, or words ("much more"). A chart-trend's stat is the change shown in ITS chart (e.g. "+6.9 pts" since 1989), not another fact.
- PHOTOS: the title slide ALWAYS has photo_query + photo_alt — one concrete, photographable scene that stands for THIS topic even when the topic is abstract — a person, place, object or event named in the facts, or an everyday scene the topic is about. Never reuse a name from these instructions; every query must come from this topic. Add a photo template (photo-split, icon-rows-photo, photo-full) on 1–2 content slides where a real person, place, object or event is named in the facts (e.g. a famous economist, a city, a protest, a machine). 1–3 words, as titled on Wikimedia Commons.
- Keep every real number, name and date from the facts; cite them in fact_ids.`;

function v6System(N: number): string {
  return SYSTEM.replace("{CATALOG}", catalogText("v6"))
    .replace("- Use \"agenda\" as slide 2 only when N ≥ 8. Use \"section\" only when N ≥ 12.", "- Use \"agenda\" only when N ≥ 10 (as slide 2). Use \"section\" only when N ≥ 12.")
    .replace("- COPY: slide titles are short ACTION titles that state the point (\"Gravity bends light around black holes\", not \"Gravitational lensing\").", "- COPY: titles follow the ACTION TITLES rule below.")
    .replace("THEMES (suggest one id that suits the subject): {THEMES}\n", `${V6_STORY}\n`)
    .replace('{"theme":"id","slides":[{"n":1,"template":"title-split",', '{"slides":[{"n":1,"beat":"title","template":"title-split",')
    .replace('"diagram":"flow",', '"diagram":"flow","flow":{"nodes":[{"id":"a","label":"","type":"step"}],"edges":[{"from":"a","to":"b","label":""}]},');
}

export function factsBlock(research: ResearchPack): string {
  // each fact says what kind of source backs it, so the planner can prefer papers over encyclopedia entries
  const kindOf = new Map((research.sources || []).map((s) => [s.id, s.kind === "wikipedia" ? "encyclopedia" : "paper"]));
  const tag = (ids: string[] = []) => (ids.some((id) => kindOf.get(id) === "paper") ? " (paper)" : ids.length ? " (encyclopedia)" : "");
  const facts = research.facts.map((f) => `${f.id}${tag(f.sources)}: ${f.text}`).join("\n");
  const terms = research.keyTerms.map((k) => `${k.term} — ${k.meaning}`).join("\n");
  return `FACTS (cite ids):\n${facts}\n\nKEY TERMS:\n${terms}`;
}

export async function runPlannerV5(brief: Brief, research: ResearchPack, log: (m: string) => void, opts: { v6?: boolean } = {}): Promise<Plan> {
  const N = brief.slideCount;
  const sys = opts.v6 ? v6System(N) : SYSTEM.replace("{CATALOG}", catalogText()).replace("{THEMES}", THEMES.map((t) => `${t.id} (${t.mood})`).join("; "));
  const user = `BRIEF
Title: ${brief.title}${brief.subtitle ? ` — ${brief.subtitle}` : ""}
Deck type: ${brief.deckType}; level: ${brief.level}; goal: ${brief.goal}; tone: ${brief.tone}
Language: ${brief.language}
Slide count N = ${N}
Required sections (in order): ${brief.requiredSections.join(" → ")}
Imagery: ${brief.imagery}
${brief.styleHint ? `Style hint: ${brief.styleHint}\n` : ""}
${factsBlock(research)}

Plan all ${N} slides now.`;
  let requests = 0;
  const repaired: string[] = [];
  let data: any = null;
  let lastErr = "";
  for (let attempt = 0; attempt < 2 && !data; attempt++) {
    try {
      requests++;
      const msgs: any[] = [{ role: "system", content: sys }, { role: "user", content: attempt ? `${user}\n\nIMPORTANT: your previous answer was unusable (${lastErr}). Return exactly ${N} slides as valid JSON.` : user }];
      const r = await chatJson<any>("planner", msgs, {
        temperature: 0.55,
        maxTokens: 12000,
        label: opts.v6 ? "v6 planner" : "v5 planner",
        validate: (t) => {
          try {
            const j = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
            return Array.isArray(j.slides) && j.slides.length >= Math.max(2, N - 2);
          } catch {
            return false;
          }
        },
      });
      if (!Array.isArray(r.data?.slides) || !r.data.slides.length) throw new Error("no slides");
      data = r.data;
      log(`planned ${data.slides.length} slides with ${r.meta.provider}/${r.meta.model}`);
    } catch (e: any) {
      lastErr = String(e?.message || e).slice(0, 120);
      log(`planner attempt ${attempt + 1} failed: ${lastErr}`);
    }
  }
  const raw: any[] = Array.isArray(data?.slides) ? data.slides : [];
  const slides = normalizePlan(raw, brief, research, repaired);
  // engine v6: the title slide always looks for a photo (the planner's scene, else the topic's own name)
  if (opts.v6 && slides[0] && !slides[0].photoQuery && !/none/i.test(brief.imagery || "")) {
    const core = String(brief.title || "").split(/[:–—(|?]/)[0].replace(/^(the|an?)\s+/i, "").trim();
    if (/^[\x20-\x7E]{3,40}$/.test(core)) {
      slides[0].photoQuery = core;
      if (slides[0].template === "title-type") slides[0].template = "title-hero";
      repaired.push(`slide 1: photo search for the topic itself (“${core}”)`);
    }
  }
  // a chart's values must be numbers the research holds (no "illustrative" curves)
  const factNums = new Set((research.facts || []).flatMap((f) => (String(f.text).match(/\d[\d,]*\.?\d*/g) || []).map((x) => String(parseFloat(x.replace(/,/g, ""))))));
  for (const s of slides) {
    if ((s.template !== "chart-trend" && s.template !== "donut") || !s.chart?.items?.length) continue;
    const vals = s.chart.items.map((i: any) => String(parseFloat(String(i.value ?? "").replace(/[^0-9.\-]/g, "")))).filter((v: string) => v !== "NaN");
    const found = vals.filter((v: string) => factNums.has(v)).length;
    if (vals.length && found < Math.ceil(vals.length / 2)) { (s as any).ungrounded = true; repaired.push(`slide ${s.n}: chart values not in the facts (${found}/${vals.length})`); }
  }
  // repair slides whose slots are unusable (one small call each, in parallel)
  const bad = slides.filter((s) => problemsOf(s).length);
  if (bad.length) {
    const fixed = await Promise.all(
      bad.map(async (s) => {
        try {
          requests++;
          return await repairSlide(s, brief, research, slides);
        } catch (e: any) {
          return null;
        }
      })
    );
    fixed.forEach((f, i) => {
      if (f && !problemsOf(f).length) {
        slides[slides.indexOf(bad[i])] = f;
        repaired.push(`slide ${f.n}: slots re-written`);
      } else {
        const fb = fallbackFor(bad[i], research, brief);
        slides[slides.indexOf(bad[i])] = fb;
        repaired.push(`slide ${fb.n}: ${problemsOf(bad[i]).join(", ")} → ${fb.template}`);
      }
    });
  }
  enforceVariety(slides, repaired);
  if (opts.v6) closingRecap(slides, repaired);
  for (const s of slides) {
    resolveIcons(s);
    if (s.template === "timeline" && sortChronologically(s)) repaired.push(`slide ${s.n}: timeline put in date order`);
  }
  return { theme: typeof data?.theme === "string" ? data.theme : undefined, slides, requests, repaired };
}

/** engine v6: the closing slide always answers the deck — its lede is the answer and it recaps three points.
 *  When the planner left them out, they come from the deck's own action titles (no extra AI). */
export function closingRecap(slides: PlannedSlide[], repaired: string[]): void {
  const close = slides.find((x) => x.template === "closing");
  if (!close) return;
  const content = slides.filter((x) => x.n > 1 && !["references", "closing", "agenda", "section"].includes(x.template));
  const short = (t: string) => {
    const one = String(t || "").replace(/\s+/g, " ").trim().replace(/[.!]$/, "");
    if (one.length <= 88) return one;
    const m = one.slice(0, 88).match(/^(.{30,}?)(?:[,;:—–]\s)/);
    return m ? m[1] : clamp(one, 88);
  };
  if ((close.items || []).filter((i) => i.title || i.text).length < 3) {
    const pick = [...content.filter((x) => ["answer", "evidence", "mechanism", "implication"].includes(String(x.beat || ""))), ...content].filter((x, k, a) => a.indexOf(x) === k).slice(0, 3).sort((a, b) => a.n - b.n);
    if (pick.length >= 2) {
      close.items = pick.map((x) => ({ title: short(x.title), icon: x.items?.[0]?.icon || "" }));
      repaired.push(`closing: recap built from slides ${pick.map((x) => x.n).join(", ")}`);
    }
  }
  if (!close.lede || /^(questions?|thank|any questions|questions and discussion)/i.test(close.lede)) {
    const ans = [...content].reverse().find((x) => x.beat === "answer") || content[content.length - 1];
    if (ans) close.lede = ans.title;
  }
}

// ── normalisation ─────────────────────────────────────────────────────────
/** fact ids ("F12", "[F3, F36]", "(S2)") belong in fact_ids, never in slide text */
export const stripIds = (t: string) => t.replace(/\s*[\[(]\s*(?:[FS]\d{1,3}\s*[,;/]?\s*(?:and\s*)?)+[\])]/g, "").replace(/\s+\b[FS]\d{1,3}(?:\s*,\s*[FS]\d{1,3})*\b(?=[\s.,;:]|$)/g, "").replace(/\s+([.,;:!?।])/g, "$1").trim();
// every slot is natural language: links, wiki paths, citation markers and fact ids are removed (sources live on the references slide)
const str = (v: unknown, max = 400) => (typeof v === "string" || typeof v === "number" ? naturalText(stripIds(String(v).replace(/\s+/g, " ").trim())).slice(0, max) : "");

/** cut to a limit at a word boundary (only when a model ignored the limit by a lot) */
/** a real quantity: has a digit, and is not a bare year, a bare 0/1/2 or a lone digit */
export function measured(v: unknown): boolean {
  const t = String(v ?? "").trim();
  return /\d/.test(t) && !/^(1[0-9]|20)\d\d$/.test(t) && !/^[0-9]$/.test(t);
}

export function titleClamp(s: string): string {
  const t = String(s || "").trim();
  if (t.length <= Math.max(LIMIT_TITLE, 130)) return t;
  const m = t.slice(0, 120).match(/^(.{40,}?)(?:[,;:—–]\s|\s[-—–]\s)(?!.*(?:[,;:—–]\s|\s[-—–]\s))/);
  return m ? m[1].trim() : clamp(t, 120);
}

export function clamp(s: string | undefined, max: number): string {
  const t = String(s || "").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sent = cut.match(/^(.+[.!?।])\s/);
  if (sent && sent[1].length > max * 0.55) return sent[1];
  // a whole clause reads as finished; an ellipsis is the last resort
  const clause = cut.match(/^(.+?)[,;:–—]\s(?!.*[,;:–—]\s)/);
  if (clause && clause[1].length > max * 0.6) return clause[1].replace(/\s+(and|or|the|a|an|of|to|in|for|with|by)$/i, "");
  return cut.replace(/[\s,;:–—-]+\S*$/, "").replace(/[,;:–—-]$/, "") + "…";
}

function item(x: any): SlotItem {
  return { icon: str(x?.icon, 40), title: str(x?.title, 120), text: str(x?.text ?? x?.desc, 300), value: str(x?.value, 24), label: str(x?.label, 120) };
}

const LIMIT_TITLE = 90;

/**
 * A photo query names something photographable. Maps, charts, graphs and indices are rejected by the photo editor
 * and the vision vet anyway (live deck 2026-11-02: "World map" and "Gini coefficient map" → no photo at all), so such
 * a query is dropped here and the slide uses its no-photo layout or the alternative query.
 */
export const NOT_A_PHOTO = /\b(maps?|charts?|graphs?|diagrams?|curves?|plots?|infographics?|coefficients?|index|indices|statistics)\b/i;
const photoQ = (v: unknown) => {
  const q = str(v, 80);
  return q && !NOT_A_PHOTO.test(q) ? q : "";
};

function normSlide(r: any, n: number, factIds: Set<string>): PlannedSlide {
    let template = str(r.template, 40).toLowerCase();
    if (!templateById(template)) template = "";
    const s: PlannedSlide = {
      n,
      template,
      role: "",
      // action titles are sentences: kept whole up to 100 chars (auto-fit sizes them), cut at a clause only beyond
      title: titleClamp(str(r.title, 200)),
      eyebrow: clamp(str(r.eyebrow, 60), 32),
      lede: str(r.lede, 400),
      items: Array.isArray(r.items) ? r.items.map(item).filter((i: SlotItem) => i.title || i.text || i.value || i.icon) : [],
      stat: r.stat && (r.stat.value || r.stat.label) ? { value: str(r.stat.value, 16), label: str(r.stat.label, 120), text: str(r.stat.text, 300) } : undefined,
      quote: r.quote && r.quote.text ? { text: str(r.quote.text, 400), author: str(r.quote.author, 80), role: str(r.quote.role, 120) } : undefined,
      left: r.left && (r.left.title || r.left.points) ? { title: str(r.left.title, 60), icon: str(r.left.icon, 40), points: (Array.isArray(r.left.points) ? r.left.points : []).map((p: any) => str(p, 200)).filter(Boolean).slice(0, 5) } : undefined,
      right: r.right && (r.right.title || r.right.points) ? { title: str(r.right.title, 60), icon: str(r.right.icon, 40), points: (Array.isArray(r.right.points) ? r.right.points : []).map((p: any) => str(p, 200)).filter(Boolean).slice(0, 5) } : undefined,
      chart: r.chart && Array.isArray(r.chart.items) ? { kind: (["bars", "line", "donut"].includes(r.chart.kind) ? r.chart.kind : "bars") as any, unit: str(r.chart.unit, 12), items: r.chart.items.map((i: any) => ({ label: str(i?.label ?? i?.title, 30), value: parseFloat(String(i?.value).replace(/[^\d.\-]/g, "")) })).filter((i: any) => i.label && Number.isFinite(i.value)).slice(0, 8) } : undefined,
      table: r.table && Array.isArray(r.table.columns) && Array.isArray(r.table.rows) ? { columns: r.table.columns.map((c: any) => str(c, 40)).slice(0, 4), rows: r.table.rows.filter(Array.isArray).map((row: any[]) => row.map((c) => str(c, 90))).slice(0, 6) } : undefined,
      takeaway: str(r.takeaway, 300) || undefined,
      term: str(r.term, 60) || undefined,
      center: str(r.center, 60) || undefined,
      axes: r.axes ? { x: str(r.axes.x, 30), y: str(r.axes.y, 30) } : undefined,
      diagram: r.diagram === "tree" ? "tree" : "flow",
      photoQuery: photoQ(r.photo_query ?? r.photoQuery) || photoQ(r.photo_alt ?? r.photoAlt) || undefined,
      photoAlt: photoQ(r.photo_alt ?? r.photoAlt) || undefined,
      notes: str(r.notes, 900),
      factIds: (Array.isArray(r.fact_ids) ? r.fact_ids : Array.isArray(r.factIds) ? r.factIds : []).map(String).filter((f: string) => factIds.has(f)),
    };
    // engine v6: story beat + flowchart nodes/edges (plain data — the engine draws them)
    if (r.beat) s.beat = str(r.beat, 20).toLowerCase();
    if (r.flow && Array.isArray(r.flow.nodes)) {
      const nodes = r.flow.nodes.map((x: any, k: number) => ({ id: str(x?.id, 12) || String.fromCharCode(97 + k), label: clamp(str(x?.label ?? x?.title, 60), 32), type: ["step", "decision", "end", "start"].includes(String(x?.type)) ? String(x.type) : "step" })).filter((x: any) => x.label).slice(0, 8);
      const ids = new Set(nodes.map((x: any) => x.id));
      const edges = (Array.isArray(r.flow.edges) ? r.flow.edges : []).map((e: any) => ({ from: str(e?.from, 12), to: str(e?.to, 12), label: clamp(str(e?.label, 30), 14) })).filter((e: any) => ids.has(e.from) && ids.has(e.to) && e.from !== e.to).slice(0, 12);
      if (nodes.length) s.flow = { nodes, edges };
    }
    // items may carry the item's own parent for trees
    if (Array.isArray(r.items)) r.items.forEach((x: any, k: number) => { if (s.items![k] && x?.parent) (s.items![k] as any).parent = str(x.parent, 60); });
    return s;
}

export function normalizePlan(raw: any[], brief: Brief, research: ResearchPack, repaired: string[]): PlannedSlide[] {
  const N = brief.slideCount;
  const factIds = new Set(research.facts.map((f) => f.id));
  // title first, references + closing last, the planner's content slides in its order between them;
  // a short plan leaves marked gaps (written by one small call each later), a long one drops surplus content
  const hasClosing = N >= 6;
  const tplOf = (r: any) => String(r?.template || "").toLowerCase();
  const sorted = raw.filter(Boolean).map((r, i) => ({ r, k: Number(r?.n) || i + 1 })).sort((a, b) => a.k - b.k).map((x) => x.r);
  const titleRaw = sorted.find((r, i) => i === 0 || /^title-/.test(tplOf(r)));
  const closingRaw = sorted.find((r) => tplOf(r) === "closing");
  const content = sorted.filter((r) => r !== titleRaw && r !== closingRaw && tplOf(r) !== "references" && !/^title-/.test(tplOf(r)));
  const slotsN = N - 1 - (hasClosing ? 2 : 1);
  const body: any[] = content.slice(0, Math.max(0, slotsN));
  while (body.length < slotsN) body.push({ __missing: true });
  const ordered = [titleRaw || {}, ...body, { template: "references" }, ...(hasClosing ? [closingRaw || {}] : [])].slice(0, N);
  const out: PlannedSlide[] = [];
  for (let n = 1; n <= N; n++) {
    const r = ordered[n - 1] || { __missing: true };
    const sl = normSlide(r, n, factIds);
    if (r.__missing) { sl.missing = true; sl.template = ""; sl.title = ""; }
    out.push(sl);
  }
  if (body.some((r) => r.__missing)) repaired.push(`${body.filter((r) => r.__missing).length} slide(s) missing from the plan → written separately`);
  // fixed slots
  const refN = hasClosing ? N - 1 : N;
  out[0].template = /^title-/.test(out[0].template) ? out[0].template : out[0].photoQuery ? "title-hero" : "title-split";
  if (!out[0].title) out[0].title = brief.title;
  if (!out[0].lede && brief.subtitle) out[0].lede = brief.subtitle;
  const refs = out[refN - 1];
  if (refs.template === "references" && !refs.title) refs.title = brief.language === "Hindi" ? "संदर्भ" : "References";
  if (refs.template !== "references") {
    if (refs.template && refs.template !== "closing" && refs.template !== "references") repaired.push(`slide ${refN}: references slot enforced`);
    out[refN - 1] = { n: refN, template: "references", role: "references", title: brief.language === "Hindi" ? "संदर्भ" : "References", notes: refs.notes || "" };
  }
  if (hasClosing) {
    const c = out[N - 1];
    if (c.template !== "closing") out[N - 1] = { ...c, template: "closing", title: c.template === "closing" ? c.title : brief.language === "Hindi" ? "धन्यवाद" : "Thank you", lede: c.lede || (brief.language === "Hindi" ? "आपके प्रश्न आमंत्रित हैं" : "Questions and discussion") };
  }
  for (const s of out) {
    if (s.missing) continue;
    if (!s.template) s.template = guessTemplate(s);
    const t = templateById(s.template)!;
    s.role = s.n === 1 ? "title" : t.family === "summary" ? "summary" : t.family;
    if (!s.title) s.title = s.items?.[0]?.title || brief.title;
    s.eyebrow = s.eyebrow || undefined;
    clampSlots(s);
  }
  return out;
}

/** a template that fits the slots the model filled */
function guessTemplate(s: PlannedSlide): string {
  const n = (s.items || []).length;
  if (s.left && s.right) return "comparison";
  if (s.chart?.items.length) return "chart";
  if (s.table?.rows.length) return "table";
  if (s.quote?.text) return "quote";
  if (s.stat?.value) return "big-stat";
  if (n === 2) return "cards-2";
  if (n === 3) return "cards-3";
  if (n === 4) return "cards-4";
  if (n >= 5) return "process";
  return "text-focus";
}

const LIMITS: Record<string, { title?: number; text?: number; lede?: number }> = {
  "cards-3": { title: 36, text: 150 }, "cards-4": { title: 34, text: 120 }, "cards-2": { title: 40, text: 200 },
  "stats-row": { title: 40, text: 100 }, "icon-rows-photo": { title: 38, text: 120 }, "photo-split": { title: 40, text: 130 },
  timeline: { title: 34, text: 100 }, process: { title: 30, text: 100 }, cycle: { title: 24, text: 50 }, hub: { title: 28, text: 80 },
  layers: { title: 26, text: 110 }, definition: { title: 30, text: 90 }, matrix: { title: 26, text: 70 }, diagram: { title: 26, text: 56 },
  "text-focus": { title: 36, text: 140 }, takeaways: { title: 40, text: 110 }, agenda: { title: 44, text: 80 }, closing: { title: 80, text: 80 },
};

function clampSlots(s: PlannedSlide) {
  const L = LIMITS[s.template] || { title: 40, text: 140 };
  const ledeMax = s.template === "definition" ? 260 : s.template === "photo-full" ? 190 : s.template.startsWith("title") || s.template === "closing" ? 130 : 190;
  if (s.lede) s.lede = clamp(s.lede, ledeMax);
  s.items = (s.items || []).map((i) => ({ ...i, title: i.title ? clamp(i.title, (L.title || 40) + 14) : i.title, text: i.text ? clamp(i.text, Math.round((L.text || 140) * 1.7)) : i.text, label: i.label ? clamp(i.label, 60) : i.label, value: i.value ? clamp(i.value, 18) : i.value }));
  const t = templateById(s.template);
  if (t?.maxItems && s.items.length > t.maxItems) s.items = s.items.slice(0, t.maxItems);
  if (s.stat) s.stat = { value: clamp(s.stat.value, 14), label: clamp(s.stat.label, 80), text: s.stat.text ? clamp(s.stat.text, 230) : undefined };
  for (const side of [s.left, s.right]) if (side) side.points = side.points.map((p) => clamp(p, 130)).slice(0, 4);
  if (s.takeaway) s.takeaway = clamp(s.takeaway, 170);
  if (s.quote) s.quote.text = clamp(s.quote.text, 230);
}

/** what makes a slide's slots unusable for its template */
export function problemsOf(s: PlannedSlide): string[] {
  if (s.missing) return ["missing from the plan"];
  const t = templateById(s.template);
  if ((s as any).ungrounded && (s.template === "chart-trend" || s.template === "donut")) return ["chart values are not in the researched facts — use the facts' own numbers, or a diagram"];
  if (!t) return ["unknown template"];
  const p: string[] = [];
  const n = (s.items || []).length;
  if (t.minItems && n < t.minItems && !["title-split"].includes(t.id)) p.push(`${n} items (needs ${t.minItems}–${t.maxItems})`);
  if (t.id === "comparison" || t.id === "pros-cons") if (!s.left?.points.length || !s.right?.points.length) p.push("left/right points missing");
  if (t.id === "chart" && (!s.chart || s.chart.items.length < 2)) p.push("chart data missing");
  const realVals = (s.chart?.items || []).map((i: any) => (typeof i.value === "number" ? i.value : parseFloat(String(i.value ?? "").replace(/[^0-9.\-]/g, "")))).filter((v: number) => Number.isFinite(v));
  const flat = realVals.length > 0 && (Math.max(...realVals.map(Math.abs)) === 0 || new Set(realVals).size === 1);
  if (t.id === "chart-trend" && (!s.chart || realVals.length < 3 || flat)) p.push("trend data missing (needs 3+ real, different values from the facts)");
  if (t.id === "donut" && (!s.chart || realVals.length < 2 || flat)) p.push("donut parts missing (needs 2+ real shares)");
  if (t.id === "flowchart" && (!s.flow || s.flow.nodes.length < 3 || s.flow.edges.length < 2)) p.push("flowchart boxes/arrows missing");
  if (t.id === "table" && (!s.table || s.table.columns.length < 2 || s.table.rows.length < 2)) p.push("table missing");
  if (t.id === "quote" && !s.quote?.text) p.push("quote missing");
  if (t.id === "big-stat" && !s.stat?.value) p.push("stat missing");
  else if (t.id === "big-stat" && !measured(s.stat?.value)) p.push("stat is not a measured number (a bare year, 0/1 or words)");
  if (t.id === "stats-row" && (s.items || []).filter((i) => measured(i.value)).length < Math.min(2, (s.items || []).length)) p.push("stats are not measured numbers (bare years, 0/1 or words)");
  if (t.id === "stats-row" && (s.items || []).some((i) => !i.value)) p.push("stat values missing");
  if (t.id === "timeline" && (s.items || []).some((i) => !i.label && !i.value)) p.push("timeline dates missing");
  if (!s.title) p.push("title missing");
  const hasBody = (s.items || []).some((i) => i.title || i.text || i.value) || s.lede || s.stat?.value || s.quote?.text || s.left?.points.length || s.chart?.items.length || s.flow?.nodes.length || s.table?.rows.length || s.takeaway;
  if (!hasBody && !["references", "closing", "section"].includes(t.id) && !/^title-/.test(t.id)) p.push("empty slide");
  return p;
}

const SLOT_HELP: Record<string, string> = {};
for (const t of TEMPLATES) SLOT_HELP[t.id] = t.slots;

async function repairSlide(s: PlannedSlide, brief: Brief, research: ResearchPack, others: PlannedSlide[] = []): Promise<PlannedSlide | null> {
  if (s.missing || !templateById(s.template)) {
    const ids = TEMPLATES.filter((t) => !t.v6 && t.family !== "title" && !["references", "closing", "section", "agenda"].includes(t.id)).map((t) => `${t.id}: ${t.slots}`).join("\n");
    const { data } = await chatJson<any>("planner", [
      { role: "system", content: `You write ONE new content slide for a premium presentation: pick the template whose shape fits the content best and fill its slots. Reply with ONLY JSON. Templates and slots:\n${ids}\nRespect the limits. Use only the facts given; write in ${brief.language}.` },
      { role: "user", content: `Deck: ${brief.title}. This is slide ${s.n} of ${brief.slideCount}. The other slides (do NOT repeat them, cover something they miss):\n${others.filter((o) => o.n !== s.n && !o.missing).map((o) => `${o.n}. [${o.template}] ${o.title}`).join("\n")}\nRequired sections: ${brief.requiredSections.join(" → ")}\n\n${factsBlock(research).slice(0, 7000)}\n\nReturn the slide JSON (keys: template, title, eyebrow, lede, items, stat, left, right, chart, table, quote, takeaway, term, center, photo_query, photo_alt, fact_ids, notes).` },
    ], { temperature: 0.5, maxTokens: 2500, label: `v5 missing slide ${s.n}` });
    const one = normalizeOne({ ...data, n: s.n }, brief, research);
    if (one && (/^title-/.test(one.template) || ["references", "closing"].includes(one.template))) return null;
    return one;
  }
  const { data } = await chatJson<any>("planner", [
    { role: "system", content: `You fill the content slots of ONE slide template for a premium presentation. Reply with ONLY JSON for that one slide (same keys as before). Template "${s.template}" SLOTS: ${SLOT_HELP[s.template]}. Respect the limits. Use only the facts given; write in ${brief.language}.` },
    { role: "user", content: `Deck: ${brief.title}. Slide ${s.n}. Current (broken: ${problemsOf(s).join(", ")}):\n${JSON.stringify({ template: s.template, title: s.title, lede: s.lede, items: s.items, stat: s.stat, left: s.left, right: s.right, chart: s.chart, table: s.table, quote: s.quote })}\n\n${factsBlock(research).slice(0, 7000)}\n\nReturn the fixed slide JSON (keys: template, title, eyebrow, lede, items, stat, left, right, chart, table, quote, takeaway, term, center, axes, photo_query, fact_ids, notes).` },
  ], { temperature: 0.4, maxTokens: 2500, label: `v5 slot repair ${s.n}` });
  const fixed = normalizeOne({ ...data, n: s.n, notes: data?.notes || s.notes, eyebrow: data?.eyebrow || s.eyebrow }, brief, research);
  return fixed;
}

/**
 * One extra call for a slide that rendered half empty: same template, fuller slots (more items up to the template's
 * maximum, a full sentence per item, a lede where the template has one) — from the research facts, in natural words.
 */
export async function growSlide(s: PlannedSlide, why: string[], brief: Brief, research: ResearchPack, others: PlannedSlide[] = []): Promise<PlannedSlide | null> {
  const t = templateById(s.template);
  if (!t) return null;
  const used = new Set(others.filter((o) => o.n !== s.n).flatMap((o) => o.factIds || []));
  const facts = research.facts.filter((f) => !used.has(f.id) || (s.factIds || []).includes(f.id));
  const { data } = await chatJson<any>("planner", [
    {
      role: "system",
      content: `You improve ONE slide of a premium presentation. On screen it looks half empty: ${why.join("; ")}. Keep the template "${s.template}" and its topic, and write FULLER content into its slots so it fills the layout: ${t.maxItems ? `use ${Math.max(t.minItems || 0, Math.min(t.maxItems, Math.max((s.items || []).length + 1, 4)))}–${t.maxItems} items, ` : ""}give every item a complete, specific sentence close to its character limit (a real number, name, date or example from the facts), and fill the lede if the template has one. SLOTS: ${t.slots}. Respect every character limit. Use only the facts given, paraphrased in natural ${brief.language} — never URLs, website names, "[1]" markers or fact ids in the text (ids only in fact_ids). Reply with ONLY JSON for the slide.`,
    },
    {
      role: "user",
      content: `Deck: ${brief.title}. Slide ${s.n} of ${brief.slideCount}. Other slides (do not repeat them): ${others.filter((o) => o.n !== s.n).map((o) => `${o.n}. ${o.title}`).join(" | ")}\nCurrent slide:\n${JSON.stringify({ template: s.template, eyebrow: s.eyebrow, title: s.title, lede: s.lede, items: s.items, stat: s.stat, left: s.left, right: s.right, takeaway: s.takeaway, term: s.term, center: s.center, fact_ids: s.factIds })}\n\n${factsBlock({ ...research, facts }).slice(0, 7000)}\n\nReturn the fuller slide JSON (keys: template, title, eyebrow, lede, items, stat, left, right, takeaway, term, center, fact_ids, notes).`,
    },
  ], { temperature: 0.45, maxTokens: 2500, label: `v5 fill sparse ${s.n}` });
  const g = normalizeOne({ ...data, template: s.template, n: s.n, notes: data?.notes || s.notes, eyebrow: data?.eyebrow || s.eyebrow, title: data?.title || s.title, photo_query: s.photoQuery }, brief, research);
  if (!g || problemsOf(g).length) return null;
  resolveIcons(g);
  g.factIds = [...new Set([...(s.factIds || []), ...(g.factIds || [])])];
  return g;
}

export function normalizeOne(r: any, brief: Brief, research: ResearchPack): PlannedSlide | null {
  const s = normSlide(r, Number(r.n) || 1, new Set(research.facts.map((f) => f.id)));
  if (!templateById(s.template)) return null;
  const t = templateById(s.template)!;
  s.role = t.family;
  if (!s.title) return null;
  clampSlots(s);
  return s;
}

/** a robust template for a slide whose slots could not be repaired */
function fallbackFor(s: PlannedSlide, research?: ResearchPack, brief?: Brief): PlannedSlide {
  // a big number that is "only" a year or a count still reads better as its designed slide than as a text block
  // when the rewrite could not run (e.g. the model was busy)
  if ((s.template === "big-stat" && /\d/.test(String(s.stat?.value || ""))) || (s.template === "stats-row" && (s.items || []).filter((i) => /\d/.test(String(i.value || ""))).length >= 2)) return s;
  if (s.missing || !templateById(s.template) || (!(s.items || []).length && !s.lede && !s.left)) {
    // nothing usable: the strongest facts as takeaways
    const facts = (research?.facts || []).slice(0, 4);
    return { n: s.n, role: "summary", template: facts.length >= 3 ? "takeaways" : "text-focus", title: s.title || (brief?.language === "Hindi" ? "मुख्य तथ्य" : "Key facts"), items: facts.map((f) => ({ icon: "lightbulb", title: clamp(f.text.split(/[,.;।]/)[0], 40), text: clamp(f.text, 150) })), notes: s.notes || "" };
  }
  const its = (s.items || []).filter((i) => i.title || i.text);
  const pts = [...its, ...(s.left?.points || []).map((t) => ({ text: t })), ...(s.right?.points || []).map((t) => ({ text: t }))];
  if (pts.length >= 3) {
    const t = pts.length === 3 ? "cards-3" : pts.length === 4 ? "cards-4" : "takeaways";
    return { ...s, template: t, items: pts.slice(0, t === "takeaways" ? 5 : pts.length).map((p: any) => ({ icon: p.icon || p.title || p.text, title: p.title || clamp(p.text, 34), text: p.title ? p.text : "" })) };
  }
  return { ...s, template: "text-focus", lede: s.lede || s.title, items: pts.slice(0, 4) as SlotItem[] };
}

/** neighbours never share a template; no content template more than twice */
const ALTERNATIVES: Record<string, string[]> = {
  "chart-trend": ["chart", "stats-row"], donut: ["chart", "stats-row"], flowchart: ["diagram", "process"],
  "cards-3": ["hub", "takeaways", "process", "text-focus"], "cards-4": ["hub", "process", "takeaways", "matrix"], "cards-2": ["comparison", "text-focus"],
  process: ["timeline", "cards-3", "hub", "cards-4", "takeaways"], timeline: ["process", "cards-4"], hub: ["cards-4", "cards-3", "cycle"], cycle: ["hub", "process"],
  takeaways: ["cards-3", "cards-4"], "text-focus": ["cards-3", "takeaways"], "stats-row": ["big-stat", "chart"], "big-stat": ["stats-row"],
  "icon-rows-photo": ["photo-split", "cards-3", "cards-4"], "photo-split": ["icon-rows-photo", "text-focus"], definition: ["text-focus", "cards-3"],
  layers: ["process", "cards-4"], comparison: ["pros-cons", "cards-2"], "pros-cons": ["comparison"], matrix: ["cards-4", "hub"], diagram: ["process", "hub"],
};

function fitsTemplate(s: PlannedSlide, id: string): boolean {
  const t = templateById(id)!;
  const n = (s.items || []).length;
  if (t.photo === "required" && !s.photoQuery) return false;
  if (t.minItems && n < t.minItems) return false;
  if (t.maxItems && n > t.maxItems) return false;
  return problemsOf({ ...s, template: id }).length === 0;
}

export function enforceVariety(slides: PlannedSlide[], repaired: string[]) {
  const fixedIds = new Set(["references", "closing", "section"]);
  const count = new Map<string, number>();
  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];
    if (fixedIds.has(s.template) || s.n === 1) continue;
    const prev = slides[i - 1]?.template;
    const used = count.get(s.template) || 0;
    // the plain card grids read as repetition sooner than the shaped layouts: once per deck each
    const cap = (id: string) => (/^cards-|^text-focus$/.test(id) || slides.length <= 10 ? 1 : 2);
    // two plain card grids side by side read as the same slide twice: the second one takes a shaped layout
    const GRID = new Set(["cards-2", "cards-3", "cards-4", "takeaways", "text-focus"]);
    const gridRun = GRID.has(s.template) && !!prev && GRID.has(prev);
    if (s.template === prev || used >= cap(s.template) || gridRun) {
      const alts = [...(ALTERNATIVES[s.template] || []), ...(gridRun ? ["hub", "process", "timeline", "matrix", "cycle"] : [])];
      const alt = alts.find((a) => a !== prev && a !== slides[i + 1]?.template && (!gridRun || !GRID.has(a)) && (count.get(a) || 0) < cap(a) && fitsTemplate(s, a));
      if (alt) {
        repaired.push(`slide ${s.n}: ${s.template} → ${alt} (variety)`);
        s.template = alt;
        if (alt === "takeaways" && !s.takeaway) s.takeaway = undefined;
      }
    }
    count.set(s.template, (count.get(s.template) || 0) + 1);
  }
}

/** concept words → real icon ids from the 8,272-icon library; all icons on a slide distinct */
export function resolveIcons(s: PlannedSlide) {
  const seen = new Set<string>();
  const pick = (concept?: string, alt?: string): string | undefined => {
    for (const q of [concept, alt].filter(Boolean) as string[]) {
      const id = resolveIconName(q);
      if (id && !seen.has(id)) {
        seen.add(id);
        return id;
      }
    }
    for (const q of [concept, alt].filter(Boolean) as string[]) {
      for (const w of q.split(/\s+/).filter((x) => x.length > 2)) {
        const id = resolveIconName(w);
        if (id && !seen.has(id)) {
          seen.add(id);
          return id;
        }
      }
    }
    const generic = ["lucide:circle-dot", "lucide:sparkles", "lucide:star", "lucide:hexagon", "lucide:diamond", "lucide:triangle"].find((g) => !seen.has(g));
    if (generic) seen.add(generic);
    return generic;
  };
  s.items = (s.items || []).map((i) => ({ ...i, icon: pick(i.icon, i.title) }));
  if (s.left) s.left.icon = pick(s.left.icon, s.left.title);
  if (s.right) s.right.icon = pick(s.right.icon, s.right.title);
}

/** a timeline whose every label carries a year is put in date order ("c. 300 BCE" < "1641" < "1969") */
export function sortChronologically(s: PlannedSlide): boolean {
  const its = s.items || [];
  const year = (l?: string): number | null => {
    const t = String(l || "");
    const m = t.match(/(\d{1,4})\s*(BCE|BC|ईसा पूर्व)?/i);
    if (!m) return /ancient|प्राचीन/i.test(t) ? -100000 : null;
    const y = Number(m[1]);
    return m[2] ? -y : y;
  };
  const ys = its.map((i) => year(i.label || i.value));
  if (its.length < 2 || ys.some((y) => y == null)) return false;
  const order = its.map((it, k) => ({ it, y: ys[k]!, k })).sort((a, b) => a.y - b.y || a.k - b.k);
  if (order.every((o, k) => o.k === k)) return false;
  s.items = order.map((o) => o.it);
  return true;
}
