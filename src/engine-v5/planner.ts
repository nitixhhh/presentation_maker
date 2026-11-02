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
- Photos make a deck feel premium: put a real photo on 2–3 slides (the title slide + 1–2 content slides) whenever the subject has a concrete, photographable side — a named person (e.g. "Nick Bostrom"), a famous work (e.g. "The Matrix film"), a place, an organism, an instrument, a building, an event. "photo_query" = 1–3 plain English words naming ONE concrete, photographable thing as it would be titled on Wikimedia Commons (never a map, chart, graph, curve, index or statistic — those are not photos) (good: "MRI scanner", "stethoscope", "Mahatma Gandhi", "Bombay Stock Exchange", "chloroplast"; bad: "AI driven MRI medical device hospital" — adjectives and abstractions find nothing); "photo_alt" = a second, different query for the same slide. Never for abstract ideas. Only on templates that take a photo.
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

export function factsBlock(research: ResearchPack): string {
  // each fact says what kind of source backs it, so the planner can prefer papers over encyclopedia entries
  const kindOf = new Map((research.sources || []).map((s) => [s.id, s.kind === "wikipedia" ? "encyclopedia" : "paper"]));
  const tag = (ids: string[] = []) => (ids.some((id) => kindOf.get(id) === "paper") ? " (paper)" : ids.length ? " (encyclopedia)" : "");
  const facts = research.facts.map((f) => `${f.id}${tag(f.sources)}: ${f.text}`).join("\n");
  const terms = research.keyTerms.map((k) => `${k.term} — ${k.meaning}`).join("\n");
  return `FACTS (cite ids):\n${facts}\n\nKEY TERMS:\n${terms}`;
}

export async function runPlannerV5(brief: Brief, research: ResearchPack, log: (m: string) => void): Promise<Plan> {
  const N = brief.slideCount;
  const sys = SYSTEM.replace("{CATALOG}", catalogText()).replace("{THEMES}", THEMES.map((t) => `${t.id} (${t.mood})`).join("; "));
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
        label: "v5 planner",
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
  for (const s of slides) {
    resolveIcons(s);
    if (s.template === "timeline" && sortChronologically(s)) repaired.push(`slide ${s.n}: timeline put in date order`);
  }
  return { theme: typeof data?.theme === "string" ? data.theme : undefined, slides, requests, repaired };
}

// ── normalisation ─────────────────────────────────────────────────────────
/** fact ids ("F12", "[F3, F36]", "(S2)") belong in fact_ids, never in slide text */
export const stripIds = (t: string) => t.replace(/\s*[\[(]\s*(?:[FS]\d{1,3}\s*[,;/]?\s*(?:and\s*)?)+[\])]/g, "").replace(/\s+\b[FS]\d{1,3}(?:\s*,\s*[FS]\d{1,3})*\b(?=[\s.,;:]|$)/g, "").replace(/\s+([.,;:!?।])/g, "$1").trim();
// every slot is natural language: links, wiki paths, citation markers and fact ids are removed (sources live on the references slide)
const str = (v: unknown, max = 400) => (typeof v === "string" || typeof v === "number" ? naturalText(stripIds(String(v).replace(/\s+/g, " ").trim())).slice(0, max) : "");

/** cut to a limit at a word boundary (only when a model ignored the limit by a lot) */
export function clamp(s: string | undefined, max: number): string {
  const t = String(s || "").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sent = cut.match(/^(.+[.!?।])\s/);
  if (sent && sent[1].length > max * 0.55) return sent[1];
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
      title: clamp(str(r.title, 200), LIMIT_TITLE),
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
  timeline: { title: 34, text: 100 }, process: { title: 30, text: 100 }, cycle: { title: 24, text: 34 }, hub: { title: 28, text: 80 },
  layers: { title: 26, text: 110 }, definition: { title: 30, text: 90 }, matrix: { title: 26, text: 70 }, diagram: { title: 26, text: 56 },
  "text-focus": { title: 36, text: 140 }, takeaways: { title: 40, text: 110 }, agenda: { title: 44, text: 80 },
};

function clampSlots(s: PlannedSlide) {
  const L = LIMITS[s.template] || { title: 40, text: 140 };
  const ledeMax = s.template === "definition" ? 260 : s.template === "photo-full" ? 190 : s.template.startsWith("title") || s.template === "closing" ? 130 : 190;
  if (s.lede) s.lede = clamp(s.lede, ledeMax);
  s.items = (s.items || []).map((i) => ({ ...i, title: i.title ? clamp(i.title, (L.title || 40) + 8) : i.title, text: i.text ? clamp(i.text, Math.round((L.text || 140) * 1.4)) : i.text, label: i.label ? clamp(i.label, 60) : i.label, value: i.value ? clamp(i.value, 18) : i.value }));
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
  if (!t) return ["unknown template"];
  const p: string[] = [];
  const n = (s.items || []).length;
  if (t.minItems && n < t.minItems && !["title-split"].includes(t.id)) p.push(`${n} items (needs ${t.minItems}–${t.maxItems})`);
  if (t.id === "comparison" || t.id === "pros-cons") if (!s.left?.points.length || !s.right?.points.length) p.push("left/right points missing");
  if (t.id === "chart" && (!s.chart || s.chart.items.length < 2)) p.push("chart data missing");
  if (t.id === "table" && (!s.table || s.table.columns.length < 2 || s.table.rows.length < 2)) p.push("table missing");
  if (t.id === "quote" && !s.quote?.text) p.push("quote missing");
  if (t.id === "big-stat" && !s.stat?.value) p.push("stat missing");
  if (t.id === "stats-row" && (s.items || []).some((i) => !i.value)) p.push("stat values missing");
  if (t.id === "timeline" && (s.items || []).some((i) => !i.label && !i.value)) p.push("timeline dates missing");
  if (!s.title) p.push("title missing");
  const hasBody = (s.items || []).some((i) => i.title || i.text || i.value) || s.lede || s.stat?.value || s.quote?.text || s.left?.points.length || s.chart?.items.length || s.table?.rows.length || s.takeaway;
  if (!hasBody && !["references", "closing", "section"].includes(t.id) && !/^title-/.test(t.id)) p.push("empty slide");
  return p;
}

const SLOT_HELP: Record<string, string> = {};
for (const t of TEMPLATES) SLOT_HELP[t.id] = t.slots;

async function repairSlide(s: PlannedSlide, brief: Brief, research: ResearchPack, others: PlannedSlide[] = []): Promise<PlannedSlide | null> {
  if (s.missing || !templateById(s.template)) {
    const ids = TEMPLATES.filter((t) => t.family !== "title" && !["references", "closing", "section", "agenda"].includes(t.id)).map((t) => `${t.id}: ${t.slots}`).join("\n");
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
    if (s.template === prev || used >= cap(s.template)) {
      const alt = (ALTERNATIVES[s.template] || []).find((a) => a !== prev && a !== slides[i + 1]?.template && (count.get(a) || 0) < cap(a) && fitsTemplate(s, a));
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
